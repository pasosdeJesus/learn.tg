import hre from "hardhat";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
dotenv.config({ path: "../.env" });

async function main() {
  const network = process.env.NEXT_PUBLIC_NETWORK || "celoSepolia";
  const file = path.join(__dirname, "..", "deployments", "MockUSDT", `${network}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`MockUSDT deployment not found at ${file}. Deploy it first (bin/deployMockUSDT).`);
  }
  const deployment = JSON.parse(fs.readFileSync(file, "utf8"));
  const owner = deployment.owner;

  console.log(`Verifying MockUSDT at ${deployment.address} on ${network}`);
  if (owner) console.log(`Constructor args: ${owner}`);

  await hre.run("verify:verify", {
    address: deployment.address,
    constructorArguments: owner ? [owner] : [],
  });
  console.log("MockUSDT verified!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
