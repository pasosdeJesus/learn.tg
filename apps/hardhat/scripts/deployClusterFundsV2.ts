import { ethers } from "hardhat";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
dotenv.config({ path: "../.env" });

async function main() {
  const ClusterFundsV2 = await ethers.getContractFactory("ClusterFundsV2");

  const usdtAddress = process.env.NEXT_PUBLIC_USDT_ADDRESS;
  const slearnAddress = process.env.NEXT_PUBLIC_SLEARN_ADDRESS;
  const pdjTreasury = process.env.NEXT_PUBLIC_PDJ_TREASURY_ADDRESS || process.env.PDJ_TREASURY_ADDRESS;
  const [deployer] = await ethers.getSigners();
  const initialOwner = await deployer.getAddress();

  if (!usdtAddress) throw new Error("NEXT_PUBLIC_USDT_ADDRESS not found in env");
  if (!slearnAddress) throw new Error("NEXT_PUBLIC_SLEARN_ADDRESS not found in env");

  const network = process.env.NEXT_PUBLIC_NETWORK || "celoSepolia";
  console.log(`Deploying ClusterFundsV2 to ${network}`);
  console.log(`  USDT: ${usdtAddress}`);
  console.log(`  SLEARN: ${slearnAddress}`);
  console.log(`  Owner: ${initialOwner}`);

  const clusterFundsV2 = await ClusterFundsV2.deploy(
    usdtAddress,
    slearnAddress,
    pdjTreasury,
    initialOwner
  );
  await clusterFundsV2.waitForDeployment();

  const addr = await clusterFundsV2.getAddress();
  console.log(`ClusterFundsV2 deployed to: ${addr}`);
  console.log(`Default config: 10% pdJ treasury, 10% donor cashback, 80% cluster/country`);
  console.log(`Contribution functions credit funds 100% (course payments / migration)`);

  // Save deployment
  const dir = path.join(__dirname, "..", "deployments", "ClusterFundsV2");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${network}.json`);
  const deployment = {
    contract: "ClusterFundsV2",
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
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
