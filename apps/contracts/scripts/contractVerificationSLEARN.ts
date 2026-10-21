import hre from "hardhat";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
dotenv.config({ path: "../.env" });

async function main() {
  const network = process.env.NEXT_PUBLIC_NETWORK || "celoSepolia";
  const slearnFile = path.join(__dirname, "..", "deployments", "SLEARN", `${network}.json`);
  if (!fs.existsSync(slearnFile)) {
    throw new Error(`SLEARN deployment not found at ${slearnFile}`);
  }
  const deployment = JSON.parse(fs.readFileSync(slearnFile, "utf8"));
  const usdtAddress = deployment.usdtAddress;

  console.log(`Verifying SLEARN at ${deployment.address} on ${network}`);
  console.log(`Constructor args: ${usdtAddress}`);

  await hre.run("verify:verify", {
    address: deployment.address,
    constructorArguments: [usdtAddress],
  });
  console.log("SLEARN verified!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
