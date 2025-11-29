import { ethers } from "hardhat";
import dotenv from "dotenv"
dotenv.config()

async function main() {
  // Get the contract factory for LearnTGVaults
  const LearnTGVaults = await ethers.getContractFactory("LearnTGVaults");
  
  // Get the USDT address from environment variables
  const usdtAddress = process.env.USDT_ADDRESS;
  if (!usdtAddress) {
    throw new Error("USDT_ADDRESS not found in environment variables");
  }
  const cCopAddress = process.env.CCOP_ADDRESS;
   if (!cCopAddress) {
    throw new Error("CCOP_ADDRESS not found in environment variables");
  }
  const gooddollarAddress = process.env.GOODDOLLAR_ADDRESS;
   if (!gooddollarAddress) {
    throw new Error("CCOP_ADDRESS not found in environment variables");
  }
  
  console.log(
    "Deploying LearnTGVaults with USDT address:", usdtAddress,
    "cCop address:", cCopAddress,
    "goodDollar address:", gooddollarAddress
  );
  
  // Deploy the contract
  const learnTGVaults = await LearnTGVaults.deploy(
    usdtAddress, cCopAddress, gooddollarAddress
  );
  
  // Wait for the deployment transaction to be mined
  await learnTGVaults.waitForDeployment();
  
  console.log(
    "LearnTGVaults deployed to:", await learnTGVaults.getAddress()
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
