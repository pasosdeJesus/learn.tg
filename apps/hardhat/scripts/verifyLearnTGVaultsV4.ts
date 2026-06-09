import { ethers } from "hardhat"
import dotenv from "dotenv"
import * as fs from "fs"
import * as path from "path"
dotenv.config({ path: "../.env" })

async function main() {
  const network = process.env.NEXT_PUBLIC_NETWORK || "celoSepolia"
  const v4File = path.join(__dirname, "..", "deployments", "LearnTGVaults", "V4", `${network}.json`)
  if (!fs.existsSync(v4File)) throw new Error(`LearnTGVaultsV4 deployment not found at ${v4File}`)
  const { address } = JSON.parse(fs.readFileSync(v4File, "utf8"))

  const vault = await ethers.getContractAt("contracts/LearnTGVaultsV4.sol:LearnTGVaultsV4", address)
  console.log(`LearnTGVaultsV4: ${await vault.getAddress()}`)
  console.log(`Network: ${network}`)
  console.log(`  VERSION: ${await vault.VERSION()}`)
  console.log(`  owner: ${await vault.owner()}`)
  console.log(`  USDT balance: ${ethers.formatUnits(await vault.getContractUSDTBalance(), 6)}`)
  console.log(`  SLEARN balance: ${ethers.formatUnits(await vault.getContractSLEARNBalance(), 2)}`)
  console.log("\n✅ LearnTGVaultsV4 smoke test passed")
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
