import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { tokenAddresses } from "./lib/token-addresses";

async function main() {
  // Get the contract factory for MockUSDT
  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  
  console.log("Deploying MockUSDT token...");
  
  // Deploy the contract
  const deployer = (await ethers.getSigners())[0];
  const deployerAddress = await deployer.getAddress();
  const mockUSDT = await MockUSDT.deploy(deployerAddress);
  
  // Wait for the deployment transaction to be mined
  await mockUSDT.waitForDeployment();
  
  const mockUSDTAddress = await mockUSDT.getAddress();
  console.log("MockUSDT deployed to:", mockUSDTAddress);
  
  // Mint 1,000,000 tokens to the deployer (owner)
  // USDT has 6 decimals, so we need to multiply by 10^6
  const amount = ethers.parseUnits("10000000000", 6); // 10,000,000,000 tokens with 6 decimals
  
  console.log("Minting 10,000,000,000 tokens to:", deployerAddress);
  const tx = await mockUSDT.mint(deployerAddress, amount);
  await tx.wait();
  
  console.log("Minted 10,000,000,000 tokens to the owner's account");
  
  // Verify the balance
  const balance = await mockUSDT.balanceOf(deployerAddress);
  console.log("Owner's balance:", ethers.formatUnits(balance, 6), "MUSDT");
  
  // Also check the total supply
  const totalSupply = await mockUSDT.totalSupply();
  console.log("Total supply:", ethers.formatUnits(totalSupply, 6), "MUSDT");
  
  // Save the deployment (source of truth for the verify/test scripts)
  const { network } = await tokenAddresses();
  const dir = path.join(__dirname, "..", "deployments", "MockUSDT");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${network}.json`);
  const deployment = {
    contract: "MockUSDT",
    address: mockUSDTAddress,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    network,
    owner: deployerAddress,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(file, JSON.stringify(deployment, null, 2));
  console.log("Deployment completed successfully!");
  console.log(`Deployment saved to ${file}`);
  console.log("To use this token instead of the canonical Sepolia USDT, add:");
  console.log(`NEXT_PUBLIC_USDT_TESTNET="${mockUSDTAddress}"`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
