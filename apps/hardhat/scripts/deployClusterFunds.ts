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
  console.log(`  pdJ Treasury: ${pdjTreasury}`);
  console.log(`  Owner: ${initialOwner}`);

  const clusterFunds = await ClusterFunds.deploy(
    usdtAddress,
    slearnAddress,
    pdjTreasury,
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
    pdjTreasury,
    initialOwner,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(file, JSON.stringify(deployment, null, 2));
  console.log(`Deployment saved to: ${file}`);

  // Set pdJPercentage to 15%
  const tx = await clusterFunds.setPdJPercentage(15);
  await tx.wait();
  console.log("pdJPercentage set to 15%");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
