import { ethers } from "hardhat";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
dotenv.config({ path: "../.env" });

async function main() {
  const ClusterFunds = await ethers.getContractFactory("ClusterFunds");

  const usdtAddress = process.env.NEXT_PUBLIC_USDT_ADDRESS;
  const slearnAddress = process.env.NEXT_PUBLIC_SLEARN_ADDRESS;
  const pdjTreasury = process.env.NEXT_PUBLIC_PDJ_TREASURY_ADDRESS || process.env.PDJ_TREASURY_ADDRESS;
  const [deployer] = await ethers.getSigners();
  const initialOwner = await deployer.getAddress();

  if (!usdtAddress) throw new Error("NEXT_PUBLIC_USDT_ADDRESS not found in env");
  if (!slearnAddress) throw new Error("NEXT_PUBLIC_SLEARN_ADDRESS not found in env");

  const network = process.env.NEXT_PUBLIC_NETWORK || "celoSepolia";
  console.log(`Deploying ClusterFunds to ${network}`);
  console.log(`  USDT: ${usdtAddress}`);
  console.log(`  SLEARN: ${slearnAddress}`);
  console.log(`  Owner: ${initialOwner}`);

  const clusterFunds = await ClusterFunds.deploy(
    usdtAddress,
    slearnAddress,
    initialOwner
  );
  await clusterFunds.waitForDeployment();

  const addr = await clusterFunds.getAddress();
  console.log(`ClusterFunds deployed to: ${addr}`);

  // Save deployment
  const dir = path.join(__dirname, "..", "deployments", "ClusterFunds");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${network}.json`);
  const deployment = {
    contract: "ClusterFunds",
    address: addr,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    network,
    usdtAddress,
    slearnAddress,
    initialOwner,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(file, JSON.stringify(deployment, null, 2));
  console.log(`Deployment saved to: ${file}`);

  // Set fee config: 10% pdJ treasury, 10% donor (configured at runtime via setFeeConfig)
  // Default: no fees — 100% to cluster. Admin calls setFeeConfig after deployment.
  console.log("Fee config must be set via setFeeConfig([pdjTreasury, donor], [10, 10]) after deployment");
  console.log("pdJ Treasury for reference:", pdjTreasury);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
