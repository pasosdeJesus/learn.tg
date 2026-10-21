import { ethers } from "hardhat";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
dotenv.config({ path: "../.env" });

/**
 * Migrate ClusterFunds (V1) country/cluster balances to ClusterFundsV2.
 *
 * Uses the PRIVATE_KEY from ../.env (loaded by hardhat.config.ts) — the
 * signer must be the OWNER of both contracts. Per doc/environments.md, the
 * backend wallet (owner) lives in the REMOTE dev server's own .env, distinct
 * from this repo's apps/.env — run this where the backend key is available.
 *
 * Idempotent: safe to re-run any number of times.
 *   - Countries already migrated (V1 balance 0 and V2 mapping credited) are
 *     skipped.
 *   - If a previous run released V1 but crashed before crediting V2, the
 *     release hash is recovered from the state file and the credit retried.
 *   - V2.processCountryContribution is replay-protected (processedTx), so a
 *     hash is never credited twice.
 *
 * Shows progress step by step as each transaction is broadcast and mined.
 */

const network = (process.env.NEXT_PUBLIC_NETWORK || "celoSepolia") as "celoSepolia" | "celo";
const deploysDir = path.join(__dirname, "..", "deployments");
const stateFile = path.join(deploysDir, `.migration-v1-to-v2-${network}.json`);
const v1File = path.join(deploysDir, "ClusterFunds", `${network}.json`);
const v2File = path.join(deploysDir, "ClusterFundsV2", `${network}.json`);

interface CountryState {
  releaseTxHash: string;
  usdt: string; // raw wei units
  slearn: string;
}

function readState(): Record<string, CountryState> {
  if (!fs.existsSync(stateFile)) return {};
  return JSON.parse(fs.readFileSync(stateFile, "utf8"));
}

function writeState(state: Record<string, CountryState>) {
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

const step = (msg: string) => console.log(`  · ${msg}`);
const ok = (msg: string) => console.log(`  ✓ ${msg}`);

async function main() {
  if (!fs.existsSync(v1File)) throw new Error(`V1 deployment not found: ${v1File}`);
  if (!fs.existsSync(v2File)) throw new Error(`V2 deployment not found: ${v2File}`);
  const v1Addr = JSON.parse(fs.readFileSync(v1File, "utf8")).address;
  const v2Addr = JSON.parse(fs.readFileSync(v2File, "utf8")).address;

  const [signer] = await ethers.getSigners();
  console.log(`Network: ${network}`);
  console.log(`Signer:  ${signer.address} (from ../.env PRIVATE_KEY)`);
  console.log(`V1:      ${v1Addr}`);
  console.log(`V2:      ${v2Addr}`);

  const v1 = await ethers.getContractAt("ClusterFunds", v1Addr);
  const v2 = await ethers.getContractAt("ClusterFundsV2", v2Addr);

  if ((await v1.owner()).toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`Signer is not the V1 owner (${await v1.owner()}) — PRIVATE_KEY in ../.env must be the backend key`);
  }
  if ((await v2.owner()).toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`Signer is not the V2 owner (${await v2.owner()}) — PRIVATE_KEY in ../.env must be the backend key`);
  }

  const state = readState();
  const countryCodes = ["CO", "SL"];
  const total = countryCodes.length;
  let done = 0;
  let migrated = 0;
  let recovered = 0;
  let skipped = 0;

  for (let i = 0; i < total; i++) {
    const code = countryCodes[i];
    console.log(`\n[${i + 1}/${total}] ${code}`);

    const [usdt, slearn] = await v1.getCountryBalance(code);
    const v1Empty = usdt === 0n && slearn === 0n;
    const pending = state[code];

    if (v1Empty) {
      const [v2Usdt, v2Slearn] = await v2.getCountryBalance(code);
      const credited = v2Usdt > 0n || v2Slearn > 0n;

      if (credited) {
        if (pending) {
          delete state[code];
          writeState(state);
          ok(`already migrated (${ethers.formatUnits(v2Usdt, 6)} USDT, ${ethers.formatUnits(v2Slearn, 2)} SLEARN) — state cleaned`);
        } else {
          ok(`already migrated (${ethers.formatUnits(v2Usdt, 6)} USDT, ${ethers.formatUnits(v2Slearn, 2)} SLEARN)`);
        }
        skipped++;
      } else if (pending) {
        step(`recovering pending credit from release ${pending.releaseTxHash.slice(0, 18)}...`);
        const tx = await v2.processCountryContribution(
          pending.releaseTxHash,
          code,
          BigInt(pending.usdt),
          BigInt(pending.slearn),
        );
        step(`broadcasting contribution... (${tx.hash.slice(0, 18)}...)`);
        const receipt = await tx.wait();
        ok(`contribution mined: ${receipt.hash}`);
        delete state[code];
        writeState(state);
        recovered++;
      } else {
        console.log(`  – no balances to migrate`);
        skipped++;
      }
      done++;
      continue;
    }

    // V1 has balances — release to V2, then credit the mapping.
    console.log(`  V1 balance: ${ethers.formatUnits(usdt, 6)} USDT, ${ethers.formatUnits(slearn, 2)} SLEARN`);
    step("broadcasting release (V1 → V2)...");
    const releaseTx = await v1.releaseCountryFunds(code, v2Addr);
    ok(`release broadcast: ${releaseTx.hash}`);
    step("waiting for release confirmation...");
    const releaseReceipt = await releaseTx.wait();
    ok(`release mined: ${releaseReceipt.hash}`);

    // Persist BEFORE crediting so a crash mid-way is recoverable.
    state[code] = { releaseTxHash: releaseReceipt.hash, usdt: usdt.toString(), slearn: slearn.toString() };
    writeState(state);
    step("state saved (recovery point)");

    step("broadcasting contribution (V2 credit)...");
    const contributionTx = await v2.processCountryContribution(releaseReceipt.hash, code, usdt, slearn);
    ok(`contribution broadcast: ${contributionTx.hash}`);
    step("waiting for contribution confirmation...");
    const contributionReceipt = await contributionTx.wait();
    ok(`contribution mined: ${contributionReceipt.hash}`);

    delete state[code];
    writeState(state);

    const [v2Usdt, v2Slearn] = await v2.getCountryBalance(code);
    ok(`V2 ${code} balance: ${ethers.formatUnits(v2Usdt, 6)} USDT, ${ethers.formatUnits(v2Slearn, 2)} SLEARN`);
    migrated++;
    done++;
  }

  console.log(`\n──────────────────────────────`);
  console.log(`Progress: ${done}/${total} countries processed`);
  console.log(`  migrated: ${migrated} · recovered: ${recovered} · skipped/clean: ${skipped}`);
  console.log(`Migration complete. V1 balances should now be 0 and V2 mappings match.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
