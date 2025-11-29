import { ethers } from "hardhat";
import dotenv from "dotenv"
dotenv.config()

async function main() {
  // Get the deployed contract
  const learnTGVaults = await ethers.getContractAt(
    "LearnTGVaults", 
    process.env.DEPLOYED_AT  // The deployed address
  );
  console.log("learnTGVaults at :", process.env.DEPLOYED_AT);
  
  // Get the owner of the contract
  const owner = await learnTGVaults.owner();
  console.log("Contract owner:", owner);
  
  // Get the USDT token address that the contract was initialized with
  const usdtToken = await learnTGVaults.usdtToken();
  console.log("Contract USDT token address:", usdtToken);
 
  // Get the cCop token address that the contract was initialized with
  const cCopToken = await learnTGVaults.cCopToken();
  console.log("Contract cCop token address:", cCopToken);
  
  // Get the gooddollar token address that the contract was initialized with
  const gooddollarToken = await learnTGVaults.gooddollarToken();
  console.log("Contract gooddollar token address:", gooddollarToken);

  console.log("Contract deployed and verified successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
