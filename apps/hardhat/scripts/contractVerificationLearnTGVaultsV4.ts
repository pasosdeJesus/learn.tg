import hre from "hardhat"
import dotenv from "dotenv"
import * as fs from "fs"
import * as path from "path"
dotenv.config({ path: "../.env" })

async function main() {
  const network = process.env.NEXT_PUBLIC_NETWORK || "celoSepolia"
  const v4File = path.join(__dirname, "..", "deployments", "LearnTGVaults", "V4", `${network}.json`)
  if (!fs.existsSync(v4File)) {
    throw new Error(`LearnTGVaultsV4 deployment not found at ${v4File}`)
  }
  const deployment = JSON.parse(fs.readFileSync(v4File, "utf8"))
  const usdtAddress = deployment.usdtAddress
  const slearnAddress = deployment.slearnAddress

  console.log(`Verifying LearnTGVaultsV4 at ${deployment.address} on ${network}`)
  console.log(`Constructor args: ${usdtAddress} ${slearnAddress}`)

  await hre.run("verify:verify", {
    address: deployment.address,
    constructorArguments: [usdtAddress, slearnAddress],
  })
  console.log("LearnTGVaultsV4 verified!")
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
