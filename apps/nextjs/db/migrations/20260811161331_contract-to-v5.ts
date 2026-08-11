import dotenv from 'dotenv'
dotenv.config({ path: '../.env' })
import { Kysely } from 'kysely'
import type { Address } from 'viem'
import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo, celoSepolia } from 'viem/chains'
import * as fs from 'fs'
import * as path from 'path'

import LearnTGVaultsV3Abi from '../../abis/LearnTGVaultsV3.json' with { type: 'json' }
import LearnTGVaultsV5Abi from '../../abis/LearnTGVaultsV5.json' with { type: 'json' }
import Erc20Abi from '../../abis/IERC20.json' with { type: 'json' }
import { getV4Address, getV5Address } from '../../lib/deployments'

export async function up(db: Kysely<any>): Promise<void> {
  const PRIVATE_KEY = process.env.PRIVATE_KEY
  const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL
  const USDT_ADDRESS = process.env.NEXT_PUBLIC_USDT_ADDRESS
  const NETWORK = process.env.NEXT_PUBLIC_NETWORK || 'celoSepolia'

  if (!PRIVATE_KEY || !RPC_URL || !USDT_ADDRESS) {
    throw new Error('Missing required env vars (PRIVATE_KEY, NEXT_PUBLIC_RPC_URL, NEXT_PUBLIC_USDT_ADDRESS)')
  }

  try {

  const V5 = await getV5Address()
  const V4 = await getV4Address()
  if (!V5) throw new Error('V5 not deployed. Run bin/deployLearnTGVaultsV5 first.')
  if (!V4) throw new Error('V4 address not found.')

  const chain = NETWORK === 'celo' ? celo : celoSepolia
  const pub = createPublicClient({ chain, transport: http(RPC_URL) })
  const account = privateKeyToAccount(PRIVATE_KEY as Address)
  const wallet = createWalletClient({ account, chain, transport: http(RPC_URL) })

  console.log('V4 -> V5 migration (idempotent)')
  console.log(`  V4: ${V4}`)
  console.log(`  V5: ${V5}`)

  // ============ 0. Export CSV backup of V4 state ============
  const backupDir = path.join(__dirname, '..', 'backups')
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  fs.mkdirSync(backupDir, { recursive: true })

  const vaultsCsv = ['courseId,balanceUsdt,balanceSlearn,amountPerGuideUsdt,amountPerGuideSlearn']
  const guidePaidCsv = ['courseId,guideId,usuario_id,billetera,paidUSDT,paidSlearn']

  const allCourses = await db.selectFrom('cor1440_gen_proyectofinanciero').select('id').execute()
  for (const course of allCourses) {
    try {
      const v4Vault: any = await pub.readContract({ address: V4, abi: LearnTGVaultsV3Abi as any, functionName: 'vaults', args: [BigInt(course.id)] })
      if (!v4Vault || !v4Vault[5]) continue
      vaultsCsv.push([
        course.id,
        v4Vault[1].toString(),
        v4Vault[2].toString(),
        v4Vault[3].toString(),
        v4Vault[4].toString(),
      ].join(','))
    } catch {}
  }

  // Get all (user, guide) pairs from DB and read V4 on-chain status
  const allScholarshipTxs = await db.selectFrom('transaction')
    .select(['usuario_id', 'metadata'])
    .where('type', '=', 'scholarship')
    .execute()

  const seen = new Set<string>()
  for (const tx of allScholarshipTxs) {
    try {
      const meta = typeof tx.metadata === 'string' ? JSON.parse(tx.metadata) : (tx.metadata as any || {})
      const guideId = meta?.guideId
      const courseId = meta?.courseId
      if (!guideId || !courseId) continue
      const key = `${tx.usuario_id}:${guideId}:${courseId}`
      if (seen.has(key)) continue
      seen.add(key)

      const bw = await db.selectFrom('billetera_usuario')
        .select('billetera')
        .where('usuario_id', '=', tx.usuario_id)
        .executeTakeFirst()
      if (!bw) continue

      const v4Status: any = await pub.readContract({
        address: V4, abi: LearnTGVaultsV3Abi as any, functionName: 'getStudentGuideStatus',
        args: [BigInt(courseId), BigInt(guideId), bw.billetera as Address]
      })
      if (v4Status[0] === 0n && v4Status[1] === 0n) continue

      guidePaidCsv.push([
        courseId,
        guideId,
        tx.usuario_id,
        bw.billetera,
        v4Status[0].toString(),
        v4Status[1].toString(),
      ].join(','))
    } catch {}
  }

  const vaultsFile = path.join(backupDir, `v4-vaults-${NETWORK}-${timestamp}.csv`)
  const guidePaidFile = path.join(backupDir, `v4-guidepaid-${NETWORK}-${timestamp}.csv`)
  fs.writeFileSync(vaultsFile, vaultsCsv.join('\n') + '\n')
  fs.writeFileSync(guidePaidFile, guidePaidCsv.join('\n') + '\n')
  console.log(`  CSV backups saved:`)
  console.log(`    ${vaultsFile} (${vaultsCsv.length - 1} vaults)`)
  console.log(`    ${guidePaidFile} (${guidePaidCsv.length - 1} guidePaid records)`)
  console.log('')

  // 1. Drain V4 (skip if already drained — re-run safety)
  const oldUsdt = await pub.readContract({ address: V4, abi: LearnTGVaultsV3Abi as any, functionName: 'getContractUSDTBalance' }) as bigint
  const oldSlearn = await pub.readContract({ address: V4, abi: LearnTGVaultsV3Abi as any, functionName: 'getContractSLEARNBalance' }) as bigint

  console.log(`  V4 holds: ${formatUnits(oldUsdt, 6)} USDT, ${formatUnits(oldSlearn, 2)} SLEARN`)

  const v4AlreadyDrained = oldUsdt === 0n && oldSlearn === 0n
  if (!v4AlreadyDrained) {

  if (oldUsdt > 0n) {
    console.log(`  Draining ${formatUnits(oldUsdt, 6)} USDT from V4`)
    const h = await wallet.writeContract({ address: V4, abi: LearnTGVaultsV3Abi as any, functionName: 'emergencyWithdrawUSDT', args: [oldUsdt], account, chain })
    await pub.waitForTransactionReceipt({ hash: h })
  }
  if (oldSlearn > 0n) {
    console.log(`  Draining ${formatUnits(oldSlearn, 2)} SLEARN from V4`)
    const h = await wallet.writeContract({ address: V4, abi: LearnTGVaultsV3Abi as any, functionName: 'emergencyWithdrawSLEARN', args: [oldSlearn], account, chain })
    await pub.waitForTransactionReceipt({ hash: h })
  }

  // 2. Transfer tokens to V5
  if (oldUsdt > 0n) {
    console.log(`  Transferring USDT -> V5`)
    const h = await wallet.writeContract({ address: USDT_ADDRESS as Address, abi: Erc20Abi as any, functionName: 'transfer', args: [V5, oldUsdt], account, chain })
    await pub.waitForTransactionReceipt({ hash: h })
  }
  if (oldSlearn > 0n) {
    const slearnAddr = await pub.readContract({ address: V4, abi: LearnTGVaultsV3Abi as any, functionName: 'slearnToken' }) as Address
    console.log(`  Transferring SLEARN -> V5 (token: ${slearnAddr})`)
    const h = await wallet.writeContract({ address: slearnAddr, abi: Erc20Abi as any, functionName: 'transfer', args: [V5, oldSlearn], account, chain })
    await pub.waitForTransactionReceipt({ hash: h })
  }

  // 3. Create vaults in V5 (idempotent) — reuse allCourses
  console.log('  Migrating vaults...')
  for (const course of allCourses) {
    try {
      const v4Vault: any = await pub.readContract({ address: V4, abi: LearnTGVaultsV3Abi as any, functionName: 'vaults', args: [BigInt(course.id)] })
      if (!v4Vault || !v4Vault[5]) continue

      const cid = BigInt(course.id)
      const perUSDT = v4Vault[3] as bigint
      const perSLEARN = v4Vault[4] as bigint

      const v5Check: any = await pub.readContract({ address: V5, abi: LearnTGVaultsV5Abi as any, functionName: 'vaults', args: [cid] })
      if (v5Check && v5Check[5]) {
        console.log(`  Course ${course.id}: already exists in V5, skipping`)
        continue
      }

      const h = await wallet.writeContract({ address: V5, abi: LearnTGVaultsV5Abi as any, functionName: 'createVault', args: [cid, perUSDT, perSLEARN], account, chain })
      await pub.waitForTransactionReceipt({ hash: h })
      console.log(`  Course ${course.id}: created (USDT=${formatUnits(perUSDT, 6)} SLEARN=${formatUnits(perSLEARN, 2)})`)
    } catch (e: any) {
      console.log(`  Course ${course.id}: ⚠️ ${e?.message || e}`)
    }
  }

  // 3.5 Authorize SLEARN contract on V5 and update SLEARN to point to V5
  console.log('  Configuring SLEARN ↔ V5 integration...')
  const slearnAddr = await pub.readContract({ address: V4, abi: LearnTGVaultsV3Abi as any, functionName: 'slearnToken' }) as Address
  const slearnAbi = ['function setLearnTGVault(address)', 'function setLearnTGVaultSLEARN(address)', 'function addAuthorizedTransfer(address)', 'function authorizedTransfers(address) view returns (bool)'] as const

  // 3.5a: Authorize SLEARN on V5 (so SLEARN can call recordCourseFunds)
  const v5HasRole: boolean = await pub.readContract({ address: V5, abi: LearnTGVaultsV5Abi as any, functionName: 'slearnContractRole', args: [slearnAddr] }) as boolean
  if (!v5HasRole) {
    const h = await wallet.writeContract({ address: V5, abi: LearnTGVaultsV5Abi as any, functionName: 'setSlearnContractRole', args: [slearnAddr, true], account, chain })
    await pub.waitForTransactionReceipt({ hash: h })
    console.log(`  ✓ SLEARN authorized on V5`)
  } else {
    console.log(`  SLEARN already authorized on V5, skipping`)
  }

  // 3.5b: Update SLEARN's learnTGVault → V5 (so SLEARN sends USDT to V5)
  const currentVault: Address = await pub.readContract({ address: slearnAddr, abi: slearnAbi as any, functionName: 'learnTGVault' }) as Address
  if (currentVault.toLowerCase() !== V5.toLowerCase()) {
    const h = await wallet.writeContract({ address: slearnAddr, abi: slearnAbi as any, functionName: 'setLearnTGVault', args: [V5], account, chain })
    await pub.waitForTransactionReceipt({ hash: h })
    console.log(`  ✓ SLEARN.learnTGVault → V5`)
  } else {
    console.log(`  SLEARN.learnTGVault already V5, skipping`)
  }

  // 3.5c: Update SLEARN's learnTGVaultSLEARN → V5 (so SLEARN sends SLEARN to V5)
  const currentVaultSlearn: Address = await pub.readContract({ address: slearnAddr, abi: slearnAbi as any, functionName: 'learnTGVaultSLEARN' }) as Address
  if (currentVaultSlearn.toLowerCase() !== V5.toLowerCase()) {
    const h = await wallet.writeContract({ address: slearnAddr, abi: slearnAbi as any, functionName: 'setLearnTGVaultSLEARN', args: [V5], account, chain })
    await pub.waitForTransactionReceipt({ hash: h })
    console.log(`  ✓ SLEARN.learnTGVaultSLEARN → V5`)
  } else {
    console.log(`  SLEARN.learnTGVaultSLEARN already V5, skipping`)
  }

  // 3.5d: Authorize V5 for SLEARN transfers (so payScholarship can send SLEARN)
  const v5Authorized: boolean = await pub.readContract({ address: slearnAddr, abi: slearnAbi as any, functionName: 'authorizedTransfers', args: [V5] }) as boolean
  if (!v5Authorized) {
    const h = await wallet.writeContract({ address: slearnAddr, abi: slearnAbi as any, functionName: 'addAuthorizedTransfer', args: [V5], account, chain })
    await pub.waitForTransactionReceipt({ hash: h })
    console.log(`  ✓ V5 authorized for SLEARN transfers`)
  } else {
    console.log(`  V5 already authorized for SLEARN transfers, skipping`)
  }

  // 4. Restore vault balances — reuse allCourses
  console.log('  Restoring vault balances...')
  for (const course of allCourses) {
    try {
      const v4Vault: any = await pub.readContract({ address: V4, abi: LearnTGVaultsV3Abi as any, functionName: 'vaults', args: [BigInt(course.id)] })
      if (!v4Vault || !v4Vault[5]) continue
      const balUSDT = v4Vault[1] as bigint
      const balSLEARN = v4Vault[2] as bigint
      if (balUSDT > 0n || balSLEARN > 0n) {
        const h = await wallet.writeContract({ address: V5, abi: LearnTGVaultsV5Abi as any, functionName: 'setVaultBalance', args: [BigInt(course.id), balUSDT, balSLEARN], account, chain })
        await pub.waitForTransactionReceipt({ hash: h })
        console.log(`  Course ${course.id}: balance set (USDT=${formatUnits(balUSDT, 6)} SLEARN=${formatUnits(balSLEARN, 2)})`)
      }
    } catch {}
  }

  } // end if (!v4AlreadyDrained)
  else {
    console.log('  V4 already drained — skipping drain/transfer/vaults/balances, jumping to guidePaid')
  }

  // 5. Migrate guidePaid (idempotent) — reuse allScholarshipTxs
  console.log('  Migrating guidePaid from V4 on-chain data...')

  const pairMap = new Map<string, { courseId: number }>()
  for (const tx of allScholarshipTxs) {
    try {
      const meta = typeof tx.metadata === 'string' ? JSON.parse(tx.metadata) : (tx.metadata as any || {})
      const guideId = meta?.guideId
      const courseId = meta?.courseId
      if (!guideId || !courseId) continue
      const key = `${tx.usuario_id}:${guideId}`
      if (!pairMap.has(key)) {
        pairMap.set(key, { courseId: Number(courseId) })
      }
    } catch {}
  }

  console.log(`  Found ${pairMap.size} unique (user, guide) pairs to check`)

  let migrated = 0
  let skipped = 0
  for (const [key, { courseId }] of pairMap) {
    const [usuarioIdStr, guideIdStr] = key.split(':')
    const usuarioId = Number(usuarioIdStr)
    const guideId = Number(guideIdStr)
    try {
      const bw = await db.selectFrom('billetera_usuario')
        .select('billetera')
        .where('usuario_id', '=', usuarioId)
        .executeTakeFirst()
      if (!bw) { skipped++; continue }

      const v4Status: any = await pub.readContract({
        address: V4, abi: LearnTGVaultsV3Abi as any, functionName: 'getStudentGuideStatus',
        args: [BigInt(courseId), BigInt(guideId), bw.billetera as Address]
      })
      const v4USDT = v4Status[0] as bigint
      const v4SLEARN = v4Status[1] as bigint
      if (v4USDT === 0n && v4SLEARN === 0n) { skipped++; continue }

      const v5Status: any = await pub.readContract({
        address: V5, abi: LearnTGVaultsV5Abi as any, functionName: 'getStudentGuideStatus',
        args: [BigInt(courseId), BigInt(guideId), bw.billetera as Address]
      })
      const v5USDT = v5Status[0] as bigint
      const v5SLEARN = v5Status[1] as bigint

      if (v4USDT > v5USDT || v4SLEARN > v5SLEARN) {
        console.log(`  setGuidePaid user=${usuarioId} guide=${guideId} USDT=${formatUnits(v4USDT, 6)} SLEARN=${formatUnits(v4SLEARN, 2)}`)
        const h = await wallet.writeContract({
          address: V5, abi: LearnTGVaultsV5Abi as any, functionName: 'setGuidePaid',
          args: [BigInt(courseId), BigInt(guideId), bw.billetera as Address, v4USDT, v4SLEARN],
          account, chain
        })
        await pub.waitForTransactionReceipt({ hash: h })
        migrated++
      } else {
        skipped++
      }
    } catch (e: any) {
      const detail = e?.walk ? e.walk().map((x: any) => x.message || x).join(' → ') : ''
      console.error(`  ⚠️ Failed guide=${guideId} user=${usuarioId}: ${e?.message || e} ${detail}`)
    }
  }
  console.log(`  guidePaid migrated: ${migrated}, skipped: ${skipped}`)

  console.log(`\n✅ V4 -> V5 migration complete`)
  console.log(`\nNext steps:`)
  console.log(`  1. Update apps/.env:`)
  console.log(`     NEXT_PUBLIC_DEPLOYED_AT_V4=${V4}  # archive`)
  console.log(`     NEXT_PUBLIC_DEPLOYED_AT_V5=${V5}  # active`)
  console.log(`  2. Restart Next.js`)
  console.log(`  3. Remove LEARNTG_VAULTS_READONLY=1 from .env`)

  } catch (e: any) {
    console.error('')
    console.error('========================================')
    console.error('❌ MIGRATION FAILED')
    console.error('========================================')
    console.error(`  typeof: ${typeof e}`)
    console.error(`  constructor: ${e?.constructor?.name || 'N/A'}`)
    console.error(`  message: ${String(e?.message || e)}`)
    console.error(`  code: ${e?.code || 'N/A'}`)
    if (typeof e === 'string') {
      console.error(`  raw string: ${e}`)
    } else {
      console.error(`  keys: ${Object.keys(e || {}).join(', ') || 'none'}`)
    }
    if (e?.stack) {
      const lines = e.stack.split('\n')
      lines.forEach((l: string) => console.error(`  ${l.trim()}`))
    }
    // viem contract errors
    if (typeof e?.walk === 'function') {
      try {
        const walk = e.walk()
        if (Array.isArray(walk) && walk.length > 0) {
          console.error('  Error walk:')
          walk.forEach((w: any) => console.error(`    - ${w.message || String(w)}`))
        }
      } catch (we: any) { console.error(`  walk() threw: ${we.message}`) }
    }
    // Full JSON dump (limited)
    try {
      const dump = JSON.stringify(e, Object.getOwnPropertyNames(e), 2)
      if (dump && dump !== '{}') {
        console.error(`  JSON dump: ${dump.slice(0, 2000)}`)
      }
    } catch {}
    console.error('========================================')
    throw e
  }
}

export async function down(_db: Kysely<any>): Promise<void> {}
