import { ethers } from "hardhat"
import dotenv from "dotenv"
import * as fs from "fs"
import * as path from "path"
import { tokenAddresses } from "./lib/token-addresses"
dotenv.config({ path: "../.env" })

async function main() {
  const LearnTGVaultsV6 = await ethers.getContractFactory("contracts/next/LearnTGVaultsV6.sol:LearnTGVaultsV6")

  // USDT y red desde `mpdj` (por red), no del `.env`.
  const { network, usdt: usdtAddress } = await tokenAddresses()
  if (!usdtAddress) throw new Error("USDT address not found (mpdj USDT_ADDRESSES / NEXT_PUBLIC_USDT_TESTNET)")

  const slearnFile = path.join(__dirname, "..", "deployments", "SLEARN", `${network}.json`)
  if (!fs.existsSync(slearnFile)) {
    throw new Error(`SLEARN deployment not found at ${slearnFile}. Deploy SLEARN first.`)
  }
  const { address: slearnAddress } = JSON.parse(fs.readFileSync(slearnFile, "utf8"))
  console.log(`SLEARN address: ${slearnAddress}`)

  console.log(`Deploying LearnTGVaultsV6 to ${network} with USDT: ${usdtAddress}, SLEARN: ${slearnAddress}`)

  const vault = await LearnTGVaultsV6.deploy(usdtAddress, slearnAddress)
  await vault.waitForDeployment()

  const addr = await vault.getAddress()
  console.log(`LearnTGVaultsV6 deployed to: ${addr}`)

  // Save deployment
  const dir = path.join(__dirname, "..", "deployments", "LearnTGVaults", "V6")
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${network}.json`)
  fs.writeFileSync(file, JSON.stringify({
    contract: "LearnTGVaultsV6",
    version: 6,
    address: addr,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    network,
    usdtAddress,
    slearnAddress,
    deployedAt: new Date().toISOString(),
  }, null, 2))
  console.log(`Deployment saved to ${file}`)
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
