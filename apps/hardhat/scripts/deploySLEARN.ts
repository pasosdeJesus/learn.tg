import { ethers } from "hardhat";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
dotenv.config({ path: "../.env" });

async function main() {
  const SLEARN = await ethers.getContractFactory("SLEARN");

  const usdtAddress = process.env.NEXT_PUBLIC_USDT_ADDRESS;
  if (!usdtAddress) throw new Error("NEXT_PUBLIC_USDT_ADDRESS not found in env");

  const network = process.env.NEXT_PUBLIC_NETWORK || "celoSepolia";
  console.log(`Deploying SLEARN to ${network} with USDT: ${usdtAddress}`);

  const slearn = await SLEARN.deploy(usdtAddress);
  await slearn.waitForDeployment();

  const addr = await slearn.getAddress();
  console.log(`SLEARN deployed to: ${addr}`);

  // Save deployment (sivel3-style)
  const dir = path.join(__dirname, "..", "deployments", "SLEARN");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${network}.json`);
  const deployment = {
    contract: "SLEARN",
    address: addr,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    network,
    usdtAddress,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(file, JSON.stringify(deployment, null, 2));
  console.log(`Deployment saved to ${file}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
