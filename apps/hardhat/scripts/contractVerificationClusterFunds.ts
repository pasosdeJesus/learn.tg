import hre from "hardhat";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
dotenv.config({ path: "../.env" });

async function main() {
  const network = process.env.NEXT_PUBLIC_NETWORK || "celoSepolia";
  const deployFile = path.join(__dirname, "..", "deployments", "ClusterFunds", `${network}.json`);
  if (!fs.existsSync(deployFile)) {
    throw new Error(`ClusterFunds deployment not found at ${deployFile}`);
  }
  const deployment = JSON.parse(fs.readFileSync(deployFile, "utf8"));
  const addr = deployment.address;

  // Read constructor args from deployment JSON (saved at deploy time)
  const usdtAddress = deployment.usdtAddress;
  const slearnAddress = deployment.slearnAddress;
  const pdjTreasury = deployment.pdjTreasury || process.env.NEXT_PUBLIC_PDJ_TREASURY_ADDRESS || process.env.PDJ_TREASURY_ADDRESS;
  const initialOwner = deployment.initialOwner;

  if (!pdjTreasury) throw new Error("pdjTreasury not found in deployment JSON or env");

  console.log(`Verifying ClusterFunds at ${addr} on ${network}`);
  console.log(`Constructor args: USDT=${usdtAddress} SLEARN=${slearnAddress} Treasury=${pdjTreasury} Owner=${initialOwner}`);

  await hre.run("verify:verify", {
    address: addr,
    constructorArguments: [usdtAddress, slearnAddress, pdjTreasury, initialOwner],
  });
  console.log("ClusterFunds verified!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
