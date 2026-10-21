/**
 * Smoke test: verify SLEARN contract is deployed and configured correctly.
 * Run: bin/verifySLEARN
 */
import { ethers } from "hardhat"
import dotenv from "dotenv"
import * as fs from "fs"
import * as path from "path"
dotenv.config({ path: "../.env" })

async function main() {
  const network = process.env.NEXT_PUBLIC_NETWORK || "celoSepolia"
  const slearnFile = path.join(__dirname, "..", "deployments", "SLEARN", `${network}.json`)
  if (!fs.existsSync(slearnFile)) throw new Error(`SLEARN deployment not found at ${slearnFile}`)
  const { address } = JSON.parse(fs.readFileSync(slearnFile, "utf8"))

  const slearn = await ethers.getContractAt("SLEARN", address)
  console.log(`SLEARN: ${await slearn.getAddress()}`)
  console.log(`Network: ${network}`)

  console.log(`  name: ${await slearn.name()}`)
  console.log(`  symbol: ${await slearn.symbol()}`)
  console.log(`  decimals: ${await slearn.decimals()}`)
  console.log(`  rate: 1 USDT = ${await slearn.usdtToSlearnRate()} SLEARN`)
  console.log(`  totalSupply: ${ethers.formatUnits(await slearn.totalSupply(), 2)}`)
  console.log(`  usdt: ${await slearn.usdt()}`)
  console.log(`  learnTGVault: ${await slearn.learnTGVault()}`)
  console.log(`  paused: ${await slearn.paused()}`)
  console.log(`  tokenURI: ${await slearn.tokenURI()}`)

  console.log("\n✅ SLEARN smoke test passed")
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
