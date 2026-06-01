import hre from "hardhat";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
dotenv.config();

async function main() {
  const network = process.env.NETWORK || "celoSepolia";
  const v3File = path.join(__dirname, "..", "deployments", "LearnTGVaults", "V3", `${network}.json`);
  if (!fs.existsSync(v3File)) {
    throw new Error(`LearnTGVaultsV3 deployment not found at ${v3File}`);
  }
  const deployment = JSON.parse(fs.readFileSync(v3File, "utf8"));
  const usdtAddress = deployment.usdtAddress;
  const slearnAddress = deployment.slearnAddress;

  console.log(`Verifying LearnTGVaultsV3 at ${deployment.address} on ${network}`);
  console.log(`Constructor args: ${usdtAddress} ${slearnAddress}`);

  await hre.run("verify:verify", {
    address: deployment.address,
    constructorArguments: [usdtAddress, slearnAddress],
  });
  console.log("LearnTGVaultsV3 verified!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
