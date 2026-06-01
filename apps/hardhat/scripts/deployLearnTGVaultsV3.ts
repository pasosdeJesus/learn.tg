import { ethers } from "hardhat";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
dotenv.config();

async function main() {
  const LearnTGVaultsV3 = await ethers.getContractFactory("contracts/LearnTGVaultsV3.sol:LearnTGVaultsV3");

  const usdtAddress = process.env.USDT_ADDRESS;
  if (!usdtAddress) throw new Error("USDT_ADDRESS not found in env");

  // Read SLEARN address from deployment
  const network = process.env.NETWORK || "celoSepolia";
  const slearnFile = path.join(__dirname, "..", "deployments", "SLEARN", `${network}.json`);
  if (!fs.existsSync(slearnFile)) {
    throw new Error(`SLEARN deployment not found at ${slearnFile}. Deploy SLEARN first.`);
  }
  const slearnDeployment = JSON.parse(fs.readFileSync(slearnFile, "utf8"));
  const slearnAddress = slearnDeployment.address;
  console.log(`SLEARN address: ${slearnAddress}`);

  console.log(`Deploying LearnTGVaultsV3 to ${network} with USDT: ${usdtAddress}, SLEARN: ${slearnAddress}`);

  const vault = await LearnTGVaultsV3.deploy(usdtAddress, slearnAddress);
  await vault.waitForDeployment();

  const addr = await vault.getAddress();
  console.log(`LearnTGVaultsV3 deployed to: ${addr}`);

  // Save deployment
  const dir = path.join(__dirname, "..", "deployments", "LearnTGVaults", "V3");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${network}.json`);
  const deployment = {
    contract: "LearnTGVaultsV3",
    version: 3,
    address: addr,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    network,
    usdtAddress,
    slearnAddress,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(file, JSON.stringify(deployment, null, 2));
  console.log(`Deployment saved to ${file}`);

  // Update .env
  console.log(`\nAdd to .env:`);
  console.log(`NEXT_PUBLIC_DEPLOYED_AT_V3="${addr}"`);
  console.log(`NEXT_PUBLIC_SLEARN_ADDRESS="${slearnAddress}"`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
