/**
 * Set SLEARN amount per guide for specified courses.
 * Keeps current USDT amountPerGuide, sets SLEARN to 1 per guide.
 *
 * Usage: hardhat run ... --network $NETWORK
 *        Reads COURSE_IDS env var (space-separated).
 */
import { ethers } from "hardhat"
import dotenv from "dotenv"
import * as fs from "fs"
import * as path from "path"
dotenv.config({ path: "../.env" })

async function main() {
  const network = process.env.NEXT_PUBLIC_NETWORK || "celoSepolia"
  const idsEnv = process.env.COURSE_IDS || ""
  const ids = idsEnv.split(/\s+/).filter(Boolean)
  if (ids.length === 0) {
    console.error("Usage: COURSE_IDS='1 2 3' hardhat run ... --network $NETWORK")
    process.exit(1)
  }

  const v3File = path.join(__dirname, "..", "deployments", "LearnTGVaults", "V3", `${network}.json`)
  if (!fs.existsSync(v3File)) throw new Error(`LearnTGVaultsV3 not deployed. Run bin/deployLearnTGVaultsV3 first.`)
  const { address: vaultAddr } = JSON.parse(fs.readFileSync(v3File, "utf8"))

  console.log(`Setting SLEARN=1 per guide on ${network}`)
  console.log(`  V3: ${vaultAddr}`)

  const vault = await ethers.getContractAt("contracts/LearnTGVaultsV3.sol:LearnTGVaultsV3", vaultAddr)

  const oneSlearn = ethers.parseUnits("1", 2)

  console.log(`\nProcessing ${ids.length} course(s)\n`)

  for (const idStr of ids) {
    const courseId = BigInt(idStr)

    try {
      const lVault: any = await vault.vaults(courseId)
      const v = {
        exists: Boolean(lVault[5]),
        amountPerGuideUsdt: lVault[3],
        amountPerGuideSlearn: lVault[4],
      }

      if (!v.exists) {
        console.log(`  Course ${idStr}: no vault, skipping`)
        continue
      }

      if (v.amountPerGuideSlearn > 0n) {
        const current = ethers.formatUnits(v.amountPerGuideSlearn, 2)
        console.log(`  Course ${idStr}: already ${current} SLEARN/guide, skipping`)
        continue
      }

      console.log(`  Course ${idStr}: setting SLEARN=1/guide (USDT=${v.amountPerGuideUsdt})`)
      const tx = await vault.setAmountPerGuide(courseId, v.amountPerGuideUsdt, oneSlearn)
      await tx.wait()
      console.log(`    ✅ ${tx.hash}`)
    } catch (e: any) {
      console.error(`  ❌ Course ${idStr}: ${e.message}`)
    }
  }

  console.log("\n✅ Done")
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
