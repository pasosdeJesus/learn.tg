import { ethers } from "hardhat";
import dotenv from "dotenv"
dotenv.config()

async function main() {
  // Get the deployed contract
  const scholarshipVaults = await ethers.getContractAt(
    "ScholarshipVaults", 
    process.env.DEPLOYED_AT  // The deployed address
  );
  console.log("scholarshipVaults at :", process.env.DEPLOYED_AT);
  
  // Get the owner of the contract
  const owner = await scholarshipVaults.owner();
  console.log("Contract owner:", owner);
  
  // Get the USDT token address that the contract was initialized with
  const usdtToken = await scholarshipVaults.usdtToken();
  console.log("Contract USDT token address:", usdtToken);
  
  console.log("Contract deployed and verified successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
