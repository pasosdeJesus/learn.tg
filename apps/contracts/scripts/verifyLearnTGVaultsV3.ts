/**
 * Smoke test: verify LearnTGVaultsV3 contract is deployed and configured correctly.
 * Run: bin/verifyLearnTGVaultsV3
 */
import { ethers } from "hardhat"
import dotenv from "dotenv"
import * as fs from "fs"
import * as path from "path"
dotenv.config({ path: "../.env" })

async function main() {
  const network = process.env.NEXT_PUBLIC_NETWORK || "celoSepolia"
  const v3File = path.join(__dirname, "..", "deployments", "LearnTGVaults", "V3", `${network}.json`)
  if (!fs.existsSync(v3File)) throw new Error(`LearnTGVaultsV3 deployment not found at ${v3File}`)
  const { address, usdtAddress, slearnAddress } = JSON.parse(fs.readFileSync(v3File, "utf8"))

  const vault = await ethers.getContractAt("contracts/LearnTGVaultsV3.sol:LearnTGVaultsV3", address)
  console.log(`LearnTGVaultsV3: ${await vault.getAddress()}`)
  console.log(`Network: ${network}`)

  console.log(`  VERSION: ${await vault.VERSION()}`)
  console.log(`  owner: ${await vault.owner()}`)
  console.log(`  usdtToken: ${await vault.usdtToken()}`)
  console.log(`  slearnToken: ${await vault.slearnToken()}`)
  console.log(`  USDT balance: ${ethers.formatUnits(await vault.getContractUSDTBalance(), 6)}`)
  console.log(`  SLEARN balance: ${ethers.formatUnits(await vault.getContractSLEARNBalance(), 2)}`)

  console.log("\n✅ LearnTGVaultsV3 smoke test passed")
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
