/**
 * Migration: Grant MINTER_ROLE on SLEARN to ClusterFunds contract.
 *
 * Required for ClusterFunds to call SLEARN.mintAndReserve() for donor cashback.
 * Fee config and cashback percentage are now set in the constructor (10% each).
 *
 * Usage:
 *   cd apps/hardhat
 *   npx hardhat run scripts/setClusterFundsFees.ts --network celoSepolia
 */
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

async function main() {
  const network = process.env.NEXT_PUBLIC_NETWORK || "celoSepolia";

  const deploymentsDir = path.join(__dirname, "..", "deployments", "ClusterFunds");
  const deploymentFile = path.join(deploymentsDir, `${network}.json`);
  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`ClusterFunds deployment not found at ${deploymentFile}`);
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const cfAddress = deployment.address;
  console.log(`ClusterFunds: ${cfAddress}`);

  // Verify defaults
  const signer = (await ethers.getSigners())[0];
  const cf = await ethers.getContractAt("ClusterFunds", cfAddress, signer);
  console.log(`Donor cashback: ${await cf.donorCashbackPct()}%`);
  const cfg = await cf.getFeeConfig();
  console.log(`Fee wallets: ${cfg.wallets.length}, percentages: ${cfg.percentages}`);

  // Grant MINTER_ROLE on SLEARN to ClusterFunds
  const slearnAddr = process.env.NEXT_PUBLIC_SLEARN_ADDRESS;
  if (slearnAddr) {
    const slearn = await ethers.getContractAt("SLEARN", slearnAddr, signer);
    const MINTER_ROLE = await slearn.MINTER_ROLE();
    const hasRole = await slearn.hasRole(MINTER_ROLE, cfAddress);
    if (!hasRole) {
      const tx = await slearn.grantRole(MINTER_ROLE, cfAddress);
      await tx.wait();
      console.log("MINTER_ROLE granted to ClusterFunds");
    } else {
      console.log("ClusterFunds already has MINTER_ROLE");
    }
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
