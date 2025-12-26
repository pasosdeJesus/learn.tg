import { ethers } from "hardhat";

async function main() {
  const CeloUbi = await ethers.getContractFactory("CeloUbi");

  console.log("Deploying CeloUbi...");

  const deployer = (await ethers.getSigners())[0];
  const deployerAddress = await deployer.getAddress();
  const celoUbi = await CeloUbi.deploy(deployerAddress, deployerAddress);

  await celoUbi.waitForDeployment();

  console.log("CeloUbi deployed to:", await celoUbi.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
