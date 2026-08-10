/**
 * Migration: Configure ClusterFunds fee recipients.
 *
 * Sets feeWallets = [pdjTreasury] with percentages [10].
 * 10% → pdJ treasury, 90% → cluster/country fund.
 * Donor cashback (10%) is handled by the backend:
 *   - USDT donation: mint SLEARN equivalent
 *   - SLEARN donation: return SLEARN to donor
 *
 * Usage:
 *   cd apps/hardhat
 *   npx hardhat run scripts/migrations/setClusterFundsFees.ts --network celoSepolia
 */
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

async function main() {
  const network = process.env.NEXT_PUBLIC_NETWORK || "celoSepolia";

  const deploymentsDir = path.join(__dirname, "..", "..", "deployments", "ClusterFunds");
  const deploymentFile = path.join(deploymentsDir, `${network}.json`);
  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`ClusterFunds deployment not found at ${deploymentFile}`);
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const cfAddress = deployment.address;
  console.log(`ClusterFunds address: ${cfAddress}`);

  const signer = (await ethers.getSigners())[0];
  const cf = await ethers.getContractAt("ClusterFunds", cfAddress, signer);

  const pdjTreasury = process.env.NEXT_PUBLIC_PDJ_TREASURY_ADDRESS || process.env.PDJ_TREASURY_ADDRESS;
  if (!pdjTreasury) throw new Error("PDJ_TREASURY_ADDRESS not set in env");
  console.log(`pdJ Treasury: ${pdjTreasury}`);

  const currentCfg = await cf.getFeeConfig();
  console.log(`Current fee wallets: ${currentCfg.wallets.length}`);

  const tx = await cf.setFeeConfig([pdjTreasury], [10]);
  await tx.wait();

  const newCfg = await cf.getFeeConfig();
  console.log(`Fee config updated: ${newCfg.wallets.length} wallet(s)`);
  console.log(`  [0] ${newCfg.wallets[0]} → ${newCfg.percentages[0]}%`);
  console.log("Done: 10% pdJ treasury, 90% cluster/country, 10% donor cashback via backend");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
