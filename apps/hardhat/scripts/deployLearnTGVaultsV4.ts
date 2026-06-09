import { ethers } from "hardhat"
import dotenv from "dotenv"
import * as fs from "fs"
import * as path from "path"
dotenv.config({ path: "../.env" })

async function main() {
  const LearnTGVaultsV4 = await ethers.getContractFactory("contracts/LearnTGVaultsV4.sol:LearnTGVaultsV4")

  const usdtAddress = process.env.NEXT_PUBLIC_USDT_ADDRESS
  if (!usdtAddress) throw new Error("NEXT_PUBLIC_USDT_ADDRESS not found in env")

  const network = process.env.NEXT_PUBLIC_NETWORK || "celoSepolia"
  const slearnFile = path.join(__dirname, "..", "deployments", "SLEARN", `${network}.json`)
  if (!fs.existsSync(slearnFile)) {
    throw new Error(`SLEARN deployment not found at ${slearnFile}. Deploy SLEARN first.`)
  }
  const { address: slearnAddress } = JSON.parse(fs.readFileSync(slearnFile, "utf8"))
  console.log(`SLEARN address: ${slearnAddress}`)

  console.log(`Deploying LearnTGVaultsV4 to ${network} with USDT: ${usdtAddress}, SLEARN: ${slearnAddress}`)

  const vault = await LearnTGVaultsV4.deploy(usdtAddress, slearnAddress)
  await vault.waitForDeployment()

  const addr = await vault.getAddress()
  console.log(`LearnTGVaultsV4 deployed to: ${addr}`)

  // Save deployment
  const dir = path.join(__dirname, "..", "deployments", "LearnTGVaults", "V4")
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${network}.json`)
  fs.writeFileSync(file, JSON.stringify({
    contract: "LearnTGVaultsV4",
    version: 4,
    address: addr,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    network,
    usdtAddress,
    slearnAddress,
    deployedAt: new Date().toISOString(),
  }, null, 2))
  console.log(`Deployment saved to ${file}`)

  console.log(`\nAdd to .env:`)
  console.log(`NEXT_PUBLIC_DEPLOYED_AT="${addr}"`)
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
