import { ethers } from "hardhat";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
dotenv.config({ path: "../.env" });

async function main() {
  const network = process.env.NEXT_PUBLIC_NETWORK || "celoSepolia";
  const deployFile = path.join(__dirname, "..", "deployments", "ClusterFundsV2", `${network}.json`);
  if (!fs.existsSync(deployFile)) {
    throw new Error(`ClusterFundsV2 not deployed. Run bin/deployClusterFundsV2 first.\n  Missing: ${deployFile}`);
  }
  const { address: addr } = JSON.parse(fs.readFileSync(deployFile, "utf8"));

  const ClusterFundsV2 = await ethers.getContractFactory("ClusterFundsV2");
  const cf = ClusterFundsV2.attach(addr);

  console.log(`Verifying ClusterFundsV2 at: ${addr}`);

  // Verify ownership: https://github.com/pasosdeJesus/learn.tg/issues/214 transfiere la propiedad al backend wallet
  // (0x01a72816...) — el deployer ya no es owner por diseño.
  const owner = await cf.owner();
  const signers = await ethers.getSigners();
  const deployer = await signers[0].getAddress();
  const BACKEND = "0x01a72816110a88883F79026C0199827fCF9184c8";
  const ownerOk = owner.toLowerCase() === deployer.toLowerCase() || owner.toLowerCase() === BACKEND.toLowerCase();
  console.log(`  Owner: ${owner} ${ownerOk ? '✓' : '✗'}`);
  if (owner.toLowerCase() === BACKEND) console.log(`         (backend wallet — transferencia https://github.com/pasosdeJesus/learn.tg/issues/214)`);

  // Verify fee config
  const cfg = await cf.getFeeConfig();
  console.log(`  Fee wallets: ${cfg.wallets.length}, percentages: ${cfg.percentages}`);
  console.log(`  Fee config ${cfg.wallets.length > 0 && cfg.percentages[0] === 10n ? '✓' : '✗'}`);

  // Verify cashback
  const cashback = await cf.donorCashbackPct();
  console.log(`  Donor cashback: ${cashback}% ${cashback === 10n ? '✓' : '✗'}`);

  // Verify tokens set
  const usdt = await cf.usdtToken();
  const slearn = await cf.slearnToken();
  console.log(`  USDT: ${usdt} ${usdt !== ethers.ZeroAddress ? '✓' : '✗'}`);
  console.log(`  SLEARN: ${slearn} ${slearn !== ethers.ZeroAddress ? '✓' : '✗'}`);

  // Verify contribution functions exist in the ABI (https://github.com/pasosdeJesus/learn.tg/issues/214)
  const hasCountry = !!cf.interface.getFunction('processCountryContribution');
  const hasCluster = !!cf.interface.getFunction('processClusterContribution');
  console.log(`  processCountryContribution ${hasCountry ? '✓ presente' : '✗ ausente'}`);
  console.log(`  processClusterContribution ${hasCluster ? '✓ presente' : '✗ ausente'}`);

  // Verify not paused
  const paused = await cf.paused();
  console.log(`  Paused: ${paused} ${!paused ? '✓' : '✗'}`);

  console.log("\n✓ Verification complete");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
