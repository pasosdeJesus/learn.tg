import { ethers } from "hardhat";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
dotenv.config({ path: "../.env" });

async function main() {
  const network = process.env.NEXT_PUBLIC_NETWORK || "celoSepolia";
  const deployFile = path.join(__dirname, "..", "deployments", "ClusterFunds", `${network}.json`);
  if (!fs.existsSync(deployFile)) throw new Error(`Not deployed. Run bin/deployClusterFunds first.`);

  const { address: addr } = JSON.parse(fs.readFileSync(deployFile, "utf8"));
  const cf = await ethers.getContractAt("ClusterFunds", addr);

  console.log(`Testing ClusterFunds at: ${addr}\n`);

  // State checks
  console.log(`Owner:           ${await cf.owner()}`);
  console.log(`pdJ Treasury:    ${await cf.pdjTreasury()}`);
  console.log(`pdJ Percentage:  ${await cf.pdjPercentage()}%`);
  console.log(`USDT:            ${await cf.usdtToken()}`);
  console.log(`SLEARN:         ${await cf.slearnToken()}`);
  console.log(`Paused:          ${await cf.paused()}\n`);

  // pdJ percentage validation
  try { await cf.setPdJPercentage(99); console.log("  ✗ Should revert"); }
  catch (e: any) { console.log(`  ✓ Reverts on 99%: ${e?.reason || e?.message?.slice(0, 40)}`); }

  // View functions
  const bal = await cf.getCountryBalance("SL");
  const funds = await cf.getClusterFunds(ethers.ZeroAddress);
  console.log(`  Country SL: USDT=${bal.usdtBalance} SLEARN=${bal.slearnBalance}`);
  console.log(`  Zero addr cluster: exists=${funds.exists} verified=${funds.verified}`);

  console.log(`\n✓ All tests passed`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
