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
  const backupDir = path.join(typeof __dirname !== 'undefined' ? __dirname : path.dirname(new URL(import.meta.url).pathname), '..', 'backups')
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

  // Snapshot V4 vaults BEFORE draining.
  // Save to file so re-runs can load it even after V4 is drained.
  const snapshotFile = path.join(backupDir, `v4-snapshot-${NETWORK}.json`)
  let v4VaultSnapshot: Map<number, { perUSDT: bigint; perSlearn: bigint; balUSDT: bigint; balSlearn: bigint }>

  if (fs.existsSync(snapshotFile)) {
    // Re-run: load from saved snapshot
    const raw = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'))
    v4VaultSnapshot = new Map(raw.map((e: any) => [e.id, { perUSDT: BigInt(e.perUSDT), perSlearn: BigInt(e.perSlearn), balUSDT: BigInt(e.balUSDT), balSlearn: BigInt(e.balSlearn) }]))
    console.log(`  Loaded snapshot: ${v4VaultSnapshot.size} vaults from ${snapshotFile}`)
  } else {
    // First run: read from V4 on-chain and save
    v4VaultSnapshot = new Map()
    for (const course of allCourses) {
      try {
        const v: any = await pub.readContract({ address: V4, abi: LearnTGVaultsV3Abi as any, functionName: 'vaults', args: [BigInt(course.id)] })
        if (v && v[5]) {
          v4VaultSnapshot.set(course.id, { perUSDT: v[3], perSlearn: v[4], balUSDT: v[1], balSlearn: v[2] })
        }
      } catch {}
    }
    // Save to file for re-runs
    const arr = [...v4VaultSnapshot].map(([id, s]) => ({ id, perUSDT: s.perUSDT.toString(), perSlearn: s.perSlearn.toString(), balUSDT: s.balUSDT.toString(), balSlearn: s.balSlearn.toString() }))
    fs.writeFileSync(snapshotFile, JSON.stringify(arr, null, 2))
    console.log(`  Snapshot: ${v4VaultSnapshot.size} vaults captured from V4, saved to ${snapshotFile}`)
  }

  // Steps 1-2: Drain V4 + transfer to V5 (skip if already done)
  if (!v4AlreadyDrained) {
    console.log('  V4 has funds — draining and transferring to V5...')

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

  } else {
    console.log('  V4 already drained — skipping drain/transfer')
  }

  // 3. Create vaults in V5 (idempotent) — use snapshot
  console.log('  Migrating vaults...')
  for (const [courseId, snap] of v4VaultSnapshot) {
    try {
      const cid = BigInt(courseId)

      const v5Check: any = await pub.readContract({ address: V5, abi: LearnTGVaultsV5Abi as any, functionName: 'vaults', args: [cid] })
      if (v5Check && v5Check[5]) {
        console.log(`  Course ${courseId}: already exists in V5, skipping`)
        continue
      }

      const h = await wallet.writeContract({ address: V5, abi: LearnTGVaultsV5Abi as any, functionName: 'createVault', args: [cid, snap.perUSDT, snap.perSlearn], account, chain })
      console.log(`  Course ${courseId}: tx sent, waiting...`)
      await pub.waitForTransactionReceipt({ hash: h })
      console.log(`  Course ${courseId}: created (USDT=${formatUnits(snap.perUSDT, 6)} SLEARN=${formatUnits(snap.perSlearn, 2)})`)
    } catch (e: any) {
      console.log(`  Course ${courseId}: ⚠️ ${e?.message || e}`)
    }
  }

  // 3.5 Authorize SLEARN contract on V5 and update SLEARN to point to V5
  console.log('  Configuring SLEARN ↔ V5 integration...')
  const slearnAddr = await pub.readContract({ address: V4, abi: LearnTGVaultsV3Abi as any, functionName: 'slearnToken' }) as Address
  const slearnAbi = [
    { name: 'learnTGVault', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    { name: 'learnTGVaultSLEARN', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    { name: 'authorizedTransfers', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }] },
    { name: 'setLearnTGVault', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] },
    { name: 'setLearnTGVaultSLEARN', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] },
    { name: 'addAuthorizedTransfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] },
  ] as const

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
  try {
    const v5Authorized: boolean = await pub.readContract({ address: slearnAddr, abi: slearnAbi as any, functionName: 'authorizedTransfers', args: [V5] }) as boolean
    if (!v5Authorized) {
      const h = await wallet.writeContract({ address: slearnAddr, abi: slearnAbi as any, functionName: 'addAuthorizedTransfer', args: [V5], account, chain })
      await pub.waitForTransactionReceipt({ hash: h })
      console.log(`  ✓ V5 authorized for SLEARN transfers`)
    } else {
      console.log(`  V5 already authorized for SLEARN transfers, skipping`)
    }
  } catch (e: any) {
    console.log(`  ⚠️ Authorized transfers check failed (V5 may already be set): ${e?.shortMessage || e?.message || e}`)
  }

  // 4. Restore vault balances — use snapshot
  console.log('  Restoring vault balances...')
  for (const [courseId, snap] of v4VaultSnapshot) {
    try {
      if (snap.balUSDT > 0n || snap.balSlearn > 0n) {
        const h = await wallet.writeContract({ address: V5, abi: LearnTGVaultsV5Abi as any, functionName: 'setVaultBalance', args: [BigInt(courseId), snap.balUSDT, snap.balSlearn], account, chain })
        await pub.waitForTransactionReceipt({ hash: h })
        console.log(`  Course ${courseId}: balance set (USDT=${formatUnits(snap.balUSDT, 6)} SLEARN=${formatUnits(snap.balSlearn, 2)})`)
      }
    } catch {}
  }

  // Pre-check which courseIds have vaults in V5
  const v5CourseIds = new Set<number>([...v4VaultSnapshot.keys()])
  console.log(`  V5 courseIds with vaults: ${[...v5CourseIds].join(', ')}`)

  // 5. Migrate guidePaid — batched with progress file for resume
  console.log('  Migrating guidePaid from V4 on-chain data...')

  const progressFile = path.join(backupDir, `v5-guidepaid-progress-${NETWORK}.json`)
  let migrated: string[] = []
  if (fs.existsSync(progressFile)) {
    migrated = JSON.parse(fs.readFileSync(progressFile, 'utf8'))
    console.log(`  Loaded ${migrated.length} already-migrated pairs from progress file`)
  }

  // Build pair list: filter to only pairs with vaults in V5
  const txs = await db.selectFrom('transaction')
    .select(['usuario_id', 'metadata'])
    .where('type', '=', 'scholarship')
    .execute()

  const allPairs: { usuarioId: number; courseId: number; guideId: number }[] = []
  const seen2 = new Set<string>()
  for (const tx of txs) {
    try {
      const meta = typeof tx.metadata === 'string' ? JSON.parse(tx.metadata) : (tx.metadata as any || {})
      const guideId = meta?.guideId
      const courseId = meta?.courseId
      if (!guideId || !courseId) continue
      if (!v5CourseIds.has(Number(courseId))) continue
      const k = `${tx.usuario_id}:${courseId}:${guideId}`
      if (seen2.has(k)) continue
      seen2.add(k)
      allPairs.push({ usuarioId: tx.usuario_id, courseId: Number(courseId), guideId: Number(guideId) })
    } catch {}
  }

  // Filter out already-migrated pairs
  const migratedSet = new Set(migrated)
  const pending = allPairs.filter(p => !migratedSet.has(`${p.usuarioId}:${p.courseId}:${p.guideId}`))
  console.log(`  Pairs: ${allPairs.length} total, ${migrated.length} already migrated, ${pending.length} pending`)

  if (pending.length === 0) {
    console.log('  All pairs already migrated, skipping guidePaid step')
  } else {
    // Pre-load billeteras
    const usuarioIds = [...new Set(pending.map(p => p.usuarioId))]
    const billeteraMap = new Map<number, string>()
    for (const uid of usuarioIds) {
      const bw = await db.selectFrom('billetera_usuario').select('billetera').where('usuario_id', '=', uid).executeTakeFirst()
      if (bw) billeteraMap.set(uid, bw.billetera)
    }
    console.log(`  Loaded ${billeteraMap.size} billeteras`)

    const BATCH_SIZE = 10
    let batchMigrated = 0
    let batchSkipped = 0

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE)
      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pending.length / BATCH_SIZE)} (${batch.length} pairs)`)

      for (const p of batch) {
        const billetera = billeteraMap.get(p.usuarioId)
        if (!billetera) { batchSkipped++; continue }

        try {
          const v4Status: any = await pub.readContract({
            address: V4, abi: LearnTGVaultsV3Abi as any, functionName: 'getStudentGuideStatus',
            args: [BigInt(p.courseId), BigInt(p.guideId), billetera as Address]
          })
          const v4USDT = v4Status[0] as bigint
          const v4SLEARN = v4Status[1] as bigint
          if (v4USDT === 0n && v4SLEARN === 0n) { batchSkipped++; continue }

          const v5Status: any = await pub.readContract({
            address: V5, abi: LearnTGVaultsV5Abi as any, functionName: 'getStudentGuideStatus',
            args: [BigInt(p.courseId), BigInt(p.guideId), billetera as Address]
          })
          const v5USDT = v5Status[0] as bigint
          const v5SLEARN = v5Status[1] as bigint

          if (v4USDT > v5USDT || v4SLEARN > v5SLEARN) {
            console.log(`    setGuidePaid user=${p.usuarioId} guide=${p.guideId} course=${p.courseId} USDT=${formatUnits(v4USDT, 6)} SLEARN=${formatUnits(v4SLEARN, 2)}`)
            const h = await wallet.writeContract({
              address: V5, abi: LearnTGVaultsV5Abi as any, functionName: 'setGuidePaid',
              args: [BigInt(p.courseId), BigInt(p.guideId), billetera as Address, v4USDT, v4SLEARN],
              account, chain
            })
            await pub.waitForTransactionReceipt({ hash: h })
            batchMigrated++
          } else {
            batchSkipped++
          }
        } catch (e: any) {
          console.log(`    ⚠️ Failed user=${p.usuarioId} guide=${p.guideId}: ${e?.shortMessage || e?.message || e}`)
        }

        // Save progress after each pair
        migrated.push(`${p.usuarioId}:${p.courseId}:${p.guideId}`)
        fs.writeFileSync(progressFile, JSON.stringify(migrated))
      }
    }
    console.log(`  guidePaid migrated: ${batchMigrated}, skipped: ${batchSkipped}`)
  }

  console.log(`\n✅ V4 -> V5 migration complete`)
  console.log(`\nNext steps:`)
  console.log(`  1. Remove LEARNTG_VAULTS_READONLY=1 from .env`)
  console.log(`  2. Restart Next.js — getActiveVault() will auto-detect V5`)

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
