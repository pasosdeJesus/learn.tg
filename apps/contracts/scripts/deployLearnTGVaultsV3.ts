import { ethers } from "hardhat";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { tokenAddresses } from "./lib/token-addresses";
dotenv.config({ path: "../.env" });

async function main() {
  const LearnTGVaultsV3 = await ethers.getContractFactory("contracts/LearnTGVaultsV3.sol:LearnTGVaultsV3");

  // USDT y red desde `mpdj` (por red), no del `.env`.
  const { network, usdt: usdtAddress } = await tokenAddresses();
  if (!usdtAddress) throw new Error("USDT address not found (mpdj USDT_ADDRESSES / NEXT_PUBLIC_USDT_TESTNET)");

  // Read SLEARN address from deployment
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
  console.log(`NEXT_PUBLIC_SLEARN_TESTNET="${slearnAddress}"`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
