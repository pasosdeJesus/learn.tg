import { ethers } from "hardhat";

async function main() {
  // Get signers
  const [deployer] = await ethers.getSigners();

  // Attach to existing ERC-20 token contract
  const tokenAddress = process.env.USDT_ADDRES;
  const TokenABI = ["function approve(address spender, uint256 amount) returns (bool)"];
  const token = new ethers.Contract(tokenAddress, TokenABI, deployer);

  const spenderAddress = process.env.DEPLOYED_ADDRESS; 

  // Approve 1 token (adjust decimals as needed)
  const amount = ethers.parseUnits("1000", 18);

  console.log("Approving...");
  const tx = await token.approve(spenderAddress, amount);
  await tx.wait();

  console.log("Approved! Transaction hash:", tx.hash);
}
