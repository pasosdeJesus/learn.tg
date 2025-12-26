import { ethers } from "hardhat";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  // Get the deployed contract address from environment variables
  const celoUbiAddress = process.env.CELOUBI_ADDRESS;
  if (!celoUbiAddress) {
    throw new Error("CELOUBI_ADDRESS not found in .env file");
  }

  // Get the contract instance for the already deployed CeloUbi contract
  const celoUbi = await ethers.getContractAt("CeloUbi", celoUbiAddress);
  console.log(`Attached to CeloUbi contract at: ${await celoUbi.getAddress()}`);

  // Get the owner of the contract
  const owner = await celoUbi.owner();
  console.log("Contract owner:", owner);

  // Get the backend address that the contract was initialized with
  const backendAddress = await celoUbi.backendAddress();
  console.log("Contract backend address:", backendAddress);

  console.log("Contract state verified successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
