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
  const pdJTreasury     = process.env.NEXT_PUBLIC_PDJ_TREASURY_ADDRESS!
  const ubiWallet       = process.env.NEXT_PUBLIC_UBI_WALLET_ADDRESS!
  const referralWallet  = process.env.NEXT_PUBLIC_REFERRAL_WALLET_ADDRESS!
  const churchesWallet  = process.env.NEXT_PUBLIC_CHURCHES_WALLET_ADDRESS!
  const reserveMultisig = process.env.NEXT_PUBLIC_RESERVE_MULTISIG_ADDRESS!
  const learnTgReserve  = process.env.NEXT_PUBLIC_LEARN_TG_RESERVE_ADDRESS!
  const stableSlReserve = process.env.NEXT_PUBLIC_STABLE_SL_RESERVE_ADDRESS!

  const missing = []
  if (!pdJTreasury) missing.push("NEXT_PUBLIC_PDJ_TREASURY_ADDRESS")
  if (!ubiWallet) missing.push("NEXT_PUBLIC_UBI_WALLET_ADDRESS")
  if (!referralWallet) missing.push("NEXT_PUBLIC_REFERRAL_WALLET_ADDRESS")
  if (!churchesWallet) missing.push("NEXT_PUBLIC_CHURCHES_WALLET_ADDRESS")
  if (!reserveMultisig) missing.push("NEXT_PUBLIC_RESERVE_MULTISIG_ADDRESS")
  if (!learnTgReserve) missing.push("NEXT_PUBLIC_LEARN_TG_RESERVE_ADDRESS")
  if (!stableSlReserve) missing.push("NEXT_PUBLIC_STABLE_SL_RESERVE_ADDRESS")
  if (missing.length > 0) throw new Error(`Missing env vars: ${missing.join(", ")}`)

  // Read deployed addresses
  const slearnFile = path.join(__dirname, "..", "deployments", "SLEARN", `${network}.json`)
  const v4File = path.join(__dirname, "..", "deployments", "LearnTGVaults", "V4", `${network}.json`)

  if (!fs.existsSync(slearnFile)) throw new Error(`SLEARN not deployed. Run bin/deploySLEARN first.`)
  const vaultFile = v4File
  if (!fs.existsSync(vaultFile)) throw new Error(`LearnTGVaultsV4 not deployed. Run bin/deployLearnTGVaultsV4 first.`)

  const { address: slearnAddr } = JSON.parse(fs.readFileSync(slearnFile, "utf8"))
  const { address: vaultAddr } = JSON.parse(fs.readFileSync(vaultFile, "utf8"))
  const vaultVersion = "V4"

  const backend = process.env.NEXT_PUBLIC_ADDRESS!
  if (!backend) throw new Error("NEXT_PUBLIC_ADDRESS not set")

  console.log(`Configuring SLEARN on ${network}`)
  console.log(`  SLEARN: ${slearnAddr}`)
  console.log(`  Vault (${vaultVersion}): ${vaultAddr}`)
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

  // Verify both vault addresses are the same (required by design)
  const vaultCheck = await slearn.learnTGVault()
  const vaultSlearnCheck = await slearn.learnTGVaultSLEARN()
  if (vaultCheck.toLowerCase() !== vaultSlearnCheck.toLowerCase()) {
    throw new Error(`Vault address mismatch: learnTGVault=${vaultCheck} learnTGVaultSLEARN=${vaultSlearnCheck}`)
  }
  console.log(`  ✅ Vault addresses match: ${vaultCheck}`)

  // Grant roles
  console.log("\nGranting roles...")
  const hasMinter = await slearn.hasRole(MINTER_ROLE, backend)
  if (!hasMinter) {
    await tx("MINTER_ROLE (backend)", () => slearn.grantRole(MINTER_ROLE, backend))
  } else {
    console.log("  MINTER_ROLE (backend) already granted")
  }

  // Grant MINTER_ROLE to sivel.xyz for SLEARN cashback via mintAndReserve
  const sivelAddress = process.env.SIVEL_ADDRESS
  if (sivelAddress) {
    const hasSivelMinter = await slearn.hasRole(MINTER_ROLE, sivelAddress)
    if (!hasSivelMinter) {
      await tx("MINTER_ROLE (sivel.xyz)", () => slearn.grantRole(MINTER_ROLE, sivelAddress))
    } else {
      console.log("  MINTER_ROLE (sivel.xyz) already granted")
    }
  } else {
    console.log("  SIVEL_ADDRESS not set — skipping sivel.xyz MINTER_ROLE")
  }

  // Grant MINTER_ROLE to stable-sl for SLEARN→SLE redemption via redeemForSLE
  const stableSlAddress = process.env.STABLESL_ADDRESS
  if (stableSlAddress) {
    const hasStableSlMinter = await slearn.hasRole(MINTER_ROLE, stableSlAddress)
    if (!hasStableSlMinter) {
      await tx("MINTER_ROLE (stable-sl)", () => slearn.grantRole(MINTER_ROLE, stableSlAddress))
    } else {
      console.log("  MINTER_ROLE (stable-sl) already granted")
    }
  } else {
    console.log("  STABLESL_ADDRESS not set — skipping stable-sl MINTER_ROLE")
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

  // V3 needs to send SLEARN to students via payScholarship.
  // SLEARN.transfer() requires authorizedTransfers[sender] || authorizedTransfers[to].
  const vaultAuthorized = await slearn.authorizedTransfers(vaultAddr)
  if (!vaultAuthorized) {
    await tx(`authorizedTransfers (${vaultVersion})`, () => slearn.addAuthorizedTransfer(vaultAddr))
  } else {
    console.log("  V3 already authorized for transfers")
  }

  console.log("\n✅ Configuration complete")
  console.log("\nSetting up token metadata...")
  const baseUrl = network === 'celo' ? 'https://learn.tg' : 'https://learn.tg:9001'
  await tx("tokenURI", () => slearn.setTokenURI(`${baseUrl}/api/slearn/metadata`))

  console.log("\nSetting up one-time allowances...")

  // Approve SLEARN contract to spend backend's USDT and SLEARN
  const maxUint = ethers.MaxUint256
  const usdtAddr = process.env.NEXT_PUBLIC_USDT_ADDRESS!
  const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", usdtAddr)

  console.log(`  USDT.approve(SLEARN, max) from backend...`)
  const t1 = await usdt.approve(slearnAddr, maxUint)
  await t1.wait()
  console.log(`    ✅ ${t1.hash}`)

  console.log(`  SLEARN.approve(SLEARN, max) from backend...`)
  const t2 = await slearn.approve(slearnAddr, maxUint)
  await t2.wait()
  console.log(`    ✅ ${t2.hash}`)

  // Self-approval needed: SLEARN._pullTokens() calls transferFrom(msg.sender, ...)
  // which in OZ v5 requires allowance(backend, backend) even for own tokens
  console.log(`  SLEARN.approve(backend, max) self-approval...`)
  const t3 = await slearn.approve(backend, maxUint)
  await t3.wait()
  console.log(`    ✅ ${t3.hash}`)

  // learnTgReserve must approve SLEARN for USDT — processPayment pulls USDT
  // from learnTgReserve when user pays with SLEARN (burn → release reserve)
  if (learnTgReserve.toLowerCase() !== backend.toLowerCase()) {
    console.log(`  USDT.approve(SLEARN, max) from learnTgReserve...`)
    // Use backend wallet to sign, but approve for learnTgReserve address
    // We need the learnTgReserve wallet to sign this. If it's the same as backend, skip.
    console.log(`    ⚠️ learnTgReserve differs from backend — approve manually:`)
    console.log(`       bin/m wallet:approve --name learntgreserve --token ${usdtAddr} --spender ${slearnAddr} --amount max`)
  } else {
    console.log(`  learnTgReserve is backend — already approved`)
  }

  // stableSlReserve must approve SLEARN for USDT — redeemForSLE pulls USDT
  // from stableSlReserve when user redeems SLEARN for Leone
  if (stableSlReserve.toLowerCase() !== backend.toLowerCase()) {
    console.log(`\n⚠️ stableSlReserve differs from backend — approve manually:`)
    console.log(`       bin/m wallet:approve --name stableslreserve --token ${usdtAddr} --spender ${slearnAddr} --amount max`)
  }

  console.log("\n✅ All configured. Remaining manual approvals (see doc/runbook.md §2):")
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
