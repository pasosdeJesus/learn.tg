#!/usr/bin/env tsx
/**
 * verify-v5-migration.ts
 * Verifies V5 contract state against CSV backups from V4→V5 migration.
 *
 * Usage: cd apps/nextjs && pnpm tsx scripts/verify-v5-migration.ts
 *
 * Reads:
 *   - db/backups/v4-vaults-*.csv (latest) — expected vault state
 *   - db/backups/v4-guidepaid-*.csv (latest) — expected guidePaid state
 *   - db/backups/v5-guidepaid-progress-*.json — migrated pairs
 *
 * Checks against V5 on-chain:
 *   - Vaults exist with correct amountPerGuide and balance
 *   - guidePaid matches CSV expectations
 */

import dotenv from 'dotenv'
dotenv.config({ path: '../.env' })
import { createPublicClient, http, formatUnits, type Address } from 'viem'
import { celo, celoSepolia } from 'viem/chains'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const NETWORK = process.env.NEXT_PUBLIC_NETWORK === 'celo' ? 'celo' : 'celoSepolia'
const RPC = process.env.NEXT_PUBLIC_RPC_URL!

// These come from deployments/
const deploymentsDir = path.join(__dirname, '..', '..', 'hardhat', 'deployments')
function readAddr(contract: string, version?: string): Address {
  const file = version
    ? path.join(deploymentsDir, contract, version, `${NETWORK}.json`)
    : path.join(deploymentsDir, contract, `${NETWORK}.json`)
  if (!fs.existsSync(file)) throw new Error(`Deployment not found: ${file}`)
  return JSON.parse(fs.readFileSync(file, 'utf8')).address as Address
}

const V5 = readAddr('LearnTGVaults', 'V5')

// ABI fragments
const vaultsAbi = [{ name: 'vaults', type: 'function', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'bool' }] }] as const
const statusAbi = [{ name: 'getStudentGuideStatus', type: 'function', stateMutability: 'view', inputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'address' }], outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'bool' }] }] as const

async function main() {
  const pub = createPublicClient({ chain: NETWORK === 'celo' ? celo : celoSepolia, transport: http(RPC) })
  const backupDir = path.join(__dirname, '..', 'db', 'backups')

  // Find latest vault CSV
  const vaultFiles = fs.readdirSync(backupDir).filter(f => f.startsWith('v4-vaults-') && f.endsWith('.csv')).sort().reverse()
  if (vaultFiles.length === 0) { console.error('No vault CSV backups found'); process.exit(1) }
  const vaultCsv = vaultFiles[0]
  console.log(`Using vault CSV: ${vaultCsv}`)

  // Find latest guidePaid CSV
  const guideFiles = fs.readdirSync(backupDir).filter(f => f.startsWith('v4-guidepaid-') && f.endsWith('.csv')).sort().reverse()
  if (guideFiles.length === 0) { console.error('No guidePaid CSV backups found'); process.exit(1) }
  const guideCsv = guideFiles[0]
  console.log(`Using guidePaid CSV: ${guideCsv}`)

  // Parse vault CSV
  const vaultLines = fs.readFileSync(path.join(backupDir, vaultCsv), 'utf8').trim().split('\n')
  const expectedVaults: { courseId: number; balUSDT: bigint; balSlearn: bigint; perUSDT: bigint; perSlearn: bigint }[] = []
  for (let i = 1; i < vaultLines.length; i++) {
    const [cid, busdt, bslearn, pusdt, pslearn] = vaultLines[i].split(',')
    expectedVaults.push({ courseId: +cid, balUSDT: BigInt(busdt), balSlearn: BigInt(bslearn), perUSDT: BigInt(pusdt), perSlearn: BigInt(pslearn) })
  }
  console.log(`Expected vaults: ${expectedVaults.length}`)

  // Parse guidePaid CSV
  const guideLines = fs.readFileSync(path.join(backupDir, guideCsv), 'utf8').trim().split('\n')
  const expectedGuidePaid: { courseId: number; guideId: number; usuarioId: number; billetera: string; paidUSDT: bigint; paidSlearn: bigint }[] = []
  for (let i = 1; i < guideLines.length; i++) {
    const [cid, gid, uid, bil, pusdt, pslearn] = guideLines[i].split(',')
    expectedGuidePaid.push({ courseId: +cid, guideId: +gid, usuarioId: +uid, billetera: bil, paidUSDT: BigInt(pusdt), paidSlearn: BigInt(pslearn) })
  }
  console.log(`Expected guidePaid records: ${expectedGuidePaid.length}`)

  // Check vaults on V5
  console.log('\n=== Checking vaults ===')
  let vaultsOk = 0
  let vaultsFail = 0
  for (const ev of expectedVaults) {
    try {
      const v: any = await pub.readContract({ address: V5, abi: vaultsAbi, functionName: 'vaults', args: [BigInt(ev.courseId)] })
      const exists = v[5] as boolean
      const balUSDT = v[1] as bigint
      const balSlearn = v[2] as bigint
      const perUSDT = v[3] as bigint
      const perSlearn = v[4] as bigint

      if (!exists) {
        console.log(`  ❌ Course ${ev.courseId}: vault does NOT exist in V5`)
        vaultsFail++
        continue
      }

      const issues: string[] = []
      if (balUSDT !== ev.balUSDT) issues.push(`balUSDT: V5=${formatUnits(balUSDT, 6)} CSV=${formatUnits(ev.balUSDT, 6)}`)
      if (balSlearn !== ev.balSlearn) issues.push(`balSlearn: V5=${formatUnits(balSlearn, 2)} CSV=${formatUnits(ev.balSlearn, 2)}`)
      if (perUSDT !== ev.perUSDT) issues.push(`perUSDT: V5=${formatUnits(perUSDT, 6)} CSV=${formatUnits(ev.perUSDT, 6)}`)
      if (perSlearn !== ev.perSlearn) issues.push(`perSlearn: V5=${formatUnits(perSlearn, 2)} CSV=${formatUnits(ev.perSlearn, 2)}`)

      if (issues.length === 0) {
        console.log(`  ✅ Course ${ev.courseId}: OK (balUSDT=${formatUnits(balUSDT, 6)}, perUSDT=${formatUnits(perUSDT, 6)})`)
        vaultsOk++
      } else {
        console.log(`  ⚠️  Course ${ev.courseId}: ${issues.join('; ')}`)
        vaultsFail++
      }
    } catch (e: any) {
      console.log(`  ❌ Course ${ev.courseId}: error reading V5 — ${e?.shortMessage || e?.message || e}`)
      vaultsFail++
    }
  }

  // Check guidePaid on V5
  console.log('\n=== Checking guidePaid ===')
  let guideOk = 0
  let guideFail = 0
  let guideSkipped = 0
  const BATCH_SIZE = 10
  for (let i = 0; i < expectedGuidePaid.length; i += BATCH_SIZE) {
    const batch = expectedGuidePaid.slice(i, i + BATCH_SIZE)
    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(expectedGuidePaid.length / BATCH_SIZE)} (${i + 1}-${Math.min(i + BATCH_SIZE, expectedGuidePaid.length)} of ${expectedGuidePaid.length})`)

    for (const eg of batch) {
      try {
        const status: any = await pub.readContract({
          address: V5, abi: statusAbi, functionName: 'getStudentGuideStatus',
          args: [BigInt(eg.courseId), BigInt(eg.guideId), eg.billetera as Address]
        })
        const v5USDT = status[0] as bigint
        const v5Slearn = status[1] as bigint

        if (v5USDT === eg.paidUSDT && v5Slearn === eg.paidSlearn) {
          guideOk++
        } else {
          console.log(`    ⚠️  user=${eg.usuarioId} course=${eg.courseId} guide=${eg.guideId}: V5(USDT=${formatUnits(v5USDT, 6)} SLEARN=${formatUnits(v5Slearn, 2)}) ≠ CSV(USDT=${formatUnits(eg.paidUSDT, 6)} SLEARN=${formatUnits(eg.paidSlearn, 2)})`)
          guideFail++
        }
      } catch (e: any) {
        console.log(`    ❌ user=${eg.usuarioId} course=${eg.courseId} guide=${eg.guideId}: error — ${e?.shortMessage || e?.message || e}`)
        guideFail++
      }
    }
  }

  // Summary
  console.log('\n========================================')
  console.log('SUMMARY')
  console.log('========================================')
  console.log(`  Vaults:   ${vaultsOk} OK, ${vaultsFail} failed`)
  console.log(`  GuidePaid: ${guideOk} OK, ${guideFail} failed, ${guideSkipped} skipped`)
  console.log(`  V5 address: ${V5}`)
  console.log(`  Network: ${NETWORK}`)

  if (vaultsFail > 0 || guideFail > 0) {
    console.log('\n❌ VERIFICATION FAILED — see details above')
    process.exit(1)
  }
  console.log('\n✅ ALL CHECKS PASSED')
}

main().catch(e => { console.error(e); process.exit(1) })
