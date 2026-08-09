import { ethers } from "hardhat";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
dotenv.config({ path: "../.env" });

async function main() {
  const network = process.env.NEXT_PUBLIC_NETWORK || "celoSepolia";
  const deployFile = path.join(__dirname, "..", "deployments", "ClusterFunds", `${network}.json`);
  if (!fs.existsSync(deployFile)) {
    throw new Error(`ClusterFunds not deployed. Run bin/deployClusterFunds first.\n  Missing: ${deployFile}`);
  }
  const { address: addr } = JSON.parse(fs.readFileSync(deployFile, "utf8"));

  const ClusterFunds = await ethers.getContractFactory("ClusterFunds");
  const cf = ClusterFunds.attach(addr);

  console.log(`Verifying ClusterFunds at: ${addr}`);

  // Verify ownership
  const owner = await cf.owner();
  const signers = await ethers.getSigners();
  const deployer = await signers[0].getAddress();
  console.log(`  Owner: ${owner} ${owner.toLowerCase() === deployer.toLowerCase() ? '✓' : '✗'}`);

  // Verify pdJ treasury
  const treasury = await cf.pdjTreasury();
  console.log(`  pdJ Treasury: ${treasury} ${treasury !== ethers.ZeroAddress ? '✓' : '✗'}`);

  // Verify percentage
  const percentage = await cf.pdjPercentage();
  console.log(`  pdJ Percentage: ${percentage}% ${percentage === 15n ? '✓' : '✗'}`);

  // Verify tokens set
  const usdt = await cf.usdtToken();
  const slearn = await cf.slearnToken();
  console.log(`  USDT: ${usdt} ${usdt !== ethers.ZeroAddress ? '✓' : '✗'}`);
  console.log(`  SLEARN: ${slearn} ${slearn !== ethers.ZeroAddress ? '✓' : '✗'}`);

  // Verify not paused
  const paused = await cf.paused();
  console.log(`  Paused: ${paused} ${!paused ? '✓' : '✗'}`);

  console.log("\n✓ Verification complete");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
