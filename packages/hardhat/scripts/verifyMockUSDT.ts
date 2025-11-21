import { ethers } from "hardhat";

async function main() {
  // Get the MockUSDT address from environment variables
  const mockUSDTAddress = process.env.MOCK_USDT_ADDRESS;
  
  if (!mockUSDTAddress) {
    throw new Error("MOCK_USDT_ADDRESS not found in environment variables");
  }
  
  // Get the contract factory for MockUSDT
  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  
  // Connect to the deployed contract
  const mockUSDT = MockUSDT.attach(mockUSDTAddress);
  
  console.log("Verifying MockUSDT deployment at:", mockUSDTAddress);
  
  // Check token details
  const name = await mockUSDT.name();
  const symbol = await mockUSDT.symbol();
  const decimals = await mockUSDT.decimals();
  const totalSupply = await mockUSDT.totalSupply();
  
  console.log("Token Name:", name);
  console.log("Token Symbol:", symbol);
  console.log("Decimals:", decimals);
  console.log("Total Supply:", ethers.formatUnits(totalSupply, decimals), symbol);
  
  // Check owner's balance
  const deployer = (await ethers.getSigners())[0];
  const deployerAddress = await deployer.getAddress();
  const balance = await mockUSDT.balanceOf(deployerAddress);
  
  console.log("Owner Address:", deployerAddress);
  console.log("Owner Balance:", ethers.formatUnits(balance, decimals), symbol);
  
  // Verify that the owner has tokens
  const expectedBalance = ethers.parseUnits("10000000000", decimals);
  if (balance > 0) {
    console.log("✓ Verification successful: Owner has tokens");
  } else {
    console.log("✗ Verification failed: Owner does not have the expected balance");
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
