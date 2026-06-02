/**
 * Configure SLEARN after deployment: set all addresses and grant roles.
 * Run: npx hardhat run scripts/config-slearn.ts --network celoSepolia
 *      NEXT_PUBLIC_NETWORK=celo npx hardhat run scripts/config-slearn.ts --network celo
 *
 * Reads addresses from apps/.env and contract addresses from deployments/.
 */
import { ethers } from "hardhat"
import dotenv from "dotenv"
import * as fs from "fs"
import * as path from "path"
dotenv.config({ path: "../.env" })

async function main() {
  const network = process.env.NEXT_PUBLIC_NETWORK || "celoSepolia"

  // Wallet addresses — all required, set individually in apps/.env
  const pdJTreasury     = process.env.PDJ_TREASURY_ADDRESS!
  const ubiWallet       = process.env.UBI_WALLET_ADDRESS!
  const referralWallet  = process.env.REFERRAL_WALLET_ADDRESS!
  const churchesWallet  = process.env.CHURCHES_WALLET_ADDRESS!
  const reserveMultisig = process.env.RESERVE_MULTISIG_ADDRESS!
  const learnTgReserve  = process.env.LEARN_TG_RESERVE_ADDRESS!
  const stableSlReserve = process.env.STABLE_SL_RESERVE_ADDRESS!

  const missing = []
  if (!pdJTreasury) missing.push("PDJ_TREASURY_ADDRESS")
  if (!ubiWallet) missing.push("UBI_WALLET_ADDRESS")
  if (!referralWallet) missing.push("REFERRAL_WALLET_ADDRESS")
  if (!churchesWallet) missing.push("CHURCHES_WALLET_ADDRESS")
  if (!reserveMultisig) missing.push("RESERVE_MULTISIG_ADDRESS")
  if (!learnTgReserve) missing.push("LEARN_TG_RESERVE_ADDRESS")
  if (!stableSlReserve) missing.push("STABLE_SL_RESERVE_ADDRESS")
  if (missing.length > 0) throw new Error(`Missing env vars: ${missing.join(", ")}`)

  // Read deployed addresses
  const slearnFile = path.join(__dirname, "..", "deployments", "SLEARN", `${network}.json`)
  const v3File = path.join(__dirname, "..", "deployments", "LearnTGVaults", "V3", `${network}.json`)

  if (!fs.existsSync(slearnFile)) throw new Error(`SLEARN not deployed. Run bin/deploySLEARN first.`)
  if (!fs.existsSync(v3File)) throw new Error(`LearnTGVaultsV3 not deployed. Run bin/deployLearnTGVaultsV3 first.`)

  const { address: slearnAddr } = JSON.parse(fs.readFileSync(slearnFile, "utf8"))
  const { address: vaultAddr } = JSON.parse(fs.readFileSync(v3File, "utf8"))

  const backend = process.env.NEXT_PUBLIC_ADDRESS!
  if (!backend) throw new Error("NEXT_PUBLIC_ADDRESS not set")

  console.log(`Configuring SLEARN on ${network}`)
  console.log(`  SLEARN: ${slearnAddr}`)
  console.log(`  V3: ${vaultAddr}`)
  console.log(`  Backend (MINTER/BURNER): ${backend}`)
  console.log(`  pdJTreasury: ${pdJTreasury}`)
  console.log(`  ubiWallet: ${ubiWallet}`)
  console.log(`  referralWallet: ${referralWallet}`)
  console.log(`  churchesWallet: ${churchesWallet}`)
  console.log(`  reserveMultisig: ${reserveMultisig}`)
  console.log(`  learnTgReserve: ${learnTgReserve}`)
  console.log(`  stableSlReserve: ${stableSlReserve}`)

  const slearn = await ethers.getContractAt("SLEARN", slearnAddr)
  const vault = await ethers.getContractAt("contracts/LearnTGVaultsV3.sol:LearnTGVaultsV3", vaultAddr)

  const MINTER_ROLE = await slearn.MINTER_ROLE()
  const BURNER_ROLE = await slearn.BURNER_ROLE()

  // Set all addresses
  console.log("\nSetting addresses...")
  const tx = async (label: string, fn: () => Promise<any>) => {
    console.log(`  ${label}...`)
    const t = await fn()
    await t.wait()
    console.log(`    ✅ ${t.hash}`)
  }

  await tx("pdJTreasury", () => slearn.setPdJTreasury(pdJTreasury))
  await tx("ubiWallet", () => slearn.setUbiWallet(ubiWallet))
  await tx("referralWallet", () => slearn.setReferralWallet(referralWallet))
  await tx("churchesWallet", () => slearn.setChurchesWallet(churchesWallet))
  await tx("reserveMultisig", () => slearn.setReserveMultisig(reserveMultisig))
  await tx("learnTgReserve", () => slearn.setLearnTgReserve(learnTgReserve))
  await tx("stableSlReserve", () => slearn.setStableSlReserve(stableSlReserve))
  await tx("learnTGVault", () => slearn.setLearnTGVault(vaultAddr))
  await tx("learnTGVaultSLEARN", () => slearn.setLearnTGVaultSLEARN(vaultAddr))

  // Grant roles
  console.log("\nGranting roles...")
  const hasMinter = await slearn.hasRole(MINTER_ROLE, backend)
  if (!hasMinter) {
    await tx("MINTER_ROLE", () => slearn.grantRole(MINTER_ROLE, backend))
  } else {
    console.log("  MINTER_ROLE already granted")
  }

  const hasBurner = await slearn.hasRole(BURNER_ROLE, backend)
  if (!hasBurner) {
    await tx("BURNER_ROLE", () => slearn.grantRole(BURNER_ROLE, backend))
  } else {
    console.log("  BURNER_ROLE already granted")
  }

  // Set slearnContractRole on V3
  console.log("\nConfiguring V3...")
  const hasRole = await vault.slearnContractRole(slearnAddr)
  if (!hasRole) {
    await tx("slearnContractRole", () => vault.setSlearnContractRole(slearnAddr, true))
  } else {
    console.log("  slearnContractRole already set")
  }

  console.log("\n✅ Configuration complete")
  console.log("\nSetting up one-time allowances...")

  // Approve SLEARN contract to spend backend's USDT and SLEARN
  const maxUint = ethers.MaxUint256
  const usdtAddr = process.env.NEXT_PUBLIC_USDT_ADDRESS!
  const usdt = await ethers.getContractAt("IERC20", usdtAddr)

  console.log(`  USDT.approve(SLEARN, max) from backend...`)
  const t1 = await usdt.approve(slearnAddr, maxUint)
  await t1.wait()
  console.log(`    ✅ ${t1.hash}`)

  console.log(`  SLEARN.approve(SLEARN, max) from backend...`)
  const t2 = await slearn.approve(slearnAddr, maxUint)
  await t2.wait()
  console.log(`    ✅ ${t2.hash}`)

  console.log("\n✅ All configured. Remaining manual approvals (see doc/runbook.md §2):")
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
