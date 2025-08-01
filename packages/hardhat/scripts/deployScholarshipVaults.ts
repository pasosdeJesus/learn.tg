import { ethers } from "hardhat";
import dotenv from "dotenv"
dotenv.config()

async function main() {
  // Get the contract factory for ScholarshipVaults
  const ScholarshipVaults = await ethers.getContractFactory("ScholarshipVaults");
  
  // Get the USDT address from environment variables
  const usdtAddress = process.env.USDT_ADDRESS;
  
  if (!usdtAddress) {
    throw new Error("USDT_ADDRESS not found in environment variables");
  }
  
  console.log("Deploying ScholarshipVaults with USDT address:", usdtAddress);
  
  // Deploy the contract
  const scholarshipVaults = await ScholarshipVaults.deploy(usdtAddress);
  
  // Wait for the deployment transaction to be mined
  await scholarshipVaults.waitForDeployment();
  
  console.log("ScholarshipVaults deployed to:", await scholarshipVaults.getAddress());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
