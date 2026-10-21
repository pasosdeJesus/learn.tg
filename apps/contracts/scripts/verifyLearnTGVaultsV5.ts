import { ethers } from "hardhat"
import dotenv from "dotenv"
import * as fs from "fs"
import * as path from "path"
dotenv.config({ path: "../.env" })

async function main() {
  const network = process.env.NEXT_PUBLIC_NETWORK || "celoSepolia"
  const v5File = path.join(__dirname, "..", "deployments", "LearnTGVaults", "V5", `${network}.json`)
  if (!fs.existsSync(v5File)) throw new Error(`LearnTGVaultsV5 deployment not found at ${v5File}`)
  const { address } = JSON.parse(fs.readFileSync(v5File, "utf8"))

  const vault = await ethers.getContractAt("contracts/LearnTGVaultsV5.sol:LearnTGVaultsV5", address)
  console.log(`LearnTGVaultsV5: ${await vault.getAddress()}`)
  console.log(`Network: ${network}`)
  console.log(`  VERSION: ${await vault.VERSION()}`)
  console.log(`  owner: ${await vault.owner()}`)
  console.log(`  USDT balance: ${ethers.formatUnits(await vault.getContractUSDTBalance(), 6)}`)
  console.log(`  SLEARN balance: ${ethers.formatUnits(await vault.getContractSLEARNBalance(), 2)}`)
  console.log("\n✅ LearnTGVaultsV5 smoke test passed")
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
