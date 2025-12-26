import { ethers } from "hardhat";
import dotenv from "dotenv"
dotenv.config()

async function main() {
  const celoUbiAddress = process.env.CELOUBI_ADDRESS;

  if (!celoUbiAddress) {
    throw new Error("CELOUBI_ADDRESS not found in environment variables");
  }

  console.log("Verifying CeloUbi at:", celoUbiAddress);

  await hre.run("verify:verify", {
    address: celoUbiAddress,
    constructorArguments: [],
  });

  console.log("Contract verified successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
