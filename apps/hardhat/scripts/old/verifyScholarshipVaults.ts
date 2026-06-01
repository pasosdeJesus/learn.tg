import { run } from "hardhat";

async function main() {
  // Get the deployed contract address
  const deployedAddress = process.env.DEPLOYED_AT;
  
  if (!deployedAddress) {
    throw new Error("DEPLOYED_AT not found in environment variables");
  }
  
  console.log("Verifying ScholarshipVaults contract at:", deployedAddress);
  
  // Get the USDT address from environment variables
  const usdtAddress = process.env.USDT_ADDRESS;
  
  if (!usdtAddress) {
    throw new Error("USDT_ADDRESS not found in environment variables");
  }
  
  try {
    // Run the verification
    await run("verify:verify", {
      address: deployedAddress,
      constructorArguments: [usdtAddress],
    });
    
    console.log("Contract verified successfully!");
  } catch (error: any) {
    if (error.message.includes("already verified")) {
      console.log("Contract is already verified on CeloScan!");
    } else if (error.message.includes("no API token was found")) {
      console.log("API token issue. Let's check the hardhat config and .env file.");
      console.log("Make sure CELOSCAN_API_KEY is set correctly in your .env file.");
    } else {
      console.error("Error verifying contract:", error.message);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});