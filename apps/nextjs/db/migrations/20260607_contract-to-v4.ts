import dotenv from 'dotenv'
dotenv.config({ path: '../.env' })
import { Kysely } from 'kysely'
import type { Address } from 'viem'
import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  parseUnits,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo, celoSepolia } from 'viem/chains'

import LearnTGVaultsV3Abi from '../../abis/LearnTGVaultsV3.json' with { type: 'json' }
import Erc20Abi from '../../abis/IERC20.json' with { type: 'json' }
import { getV3Address, getV4Address } from '../../lib/deployments'

export async function up(db: Kysely<any>): Promise<void> {
  const PRIVATE_KEY = process.env.PRIVATE_KEY
  const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL
  const USDT_ADDRESS = process.env.NEXT_PUBLIC_USDT_ADDRESS
  const NETWORK = process.env.NEXT_PUBLIC_NETWORK || 'celoSepolia'

  if (!PRIVATE_KEY || !RPC_URL || !USDT_ADDRESS) {
    throw new Error('Missing required env vars')
  }

  const V4 = await getV4Address()
  const V3 = await getV3Address()
  if (!V4) throw new Error('V4 not deployed')
  if (!V3) throw new Error('V3 address not found')

  const chain = NETWORK === 'celo' ? celo : celoSepolia
  const pub = createPublicClient({ chain, transport: http(RPC_URL) })
  const account = privateKeyToAccount(PRIVATE_KEY as Address)
  const wallet = createWalletClient({ account, chain, transport: http(RPC_URL) })

  console.log('V3 → V4 migration')
  console.log(`  V3: ${V3}`)
  console.log(`  V4: ${V4}`)

  // 1. Drain V3
  const oldUsdt = await pub.readContract({ address: V3, abi: LearnTGVaultsV3Abi as any, functionName: 'getContractUSDTBalance' }) as bigint
  const oldSlearn = await pub.readContract({ address: V3, abi: LearnTGVaultsV3Abi as any, functionName: 'getContractSLEARNBalance' }) as bigint

  if (oldUsdt > 0n) {
    console.log(`  Draining ${formatUnits(oldUsdt, 6)} USDT from V3`)
    const h = await wallet.writeContract({ address: V3, abi: LearnTGVaultsV3Abi as any, functionName: 'emergencyWithdrawUSDT', args: [oldUsdt], account, chain })
    await pub.waitForTransactionReceipt({ hash: h })
  }
  if (oldSlearn > 0n) {
    console.log(`  Draining ${formatUnits(oldSlearn, 2)} SLEARN from V3`)
    const h = await wallet.writeContract({ address: V3, abi: LearnTGVaultsV3Abi as any, functionName: 'emergencyWithdrawSLEARN', args: [oldSlearn], account, chain })
    await pub.waitForTransactionReceipt({ hash: h })
  }

  // 2. Transfer both tokens to V4
  if (oldUsdt > 0n) {
    console.log(`  Transferring USDT → V4`)
    const h = await wallet.writeContract({ address: USDT_ADDRESS as Address, abi: Erc20Abi as any, functionName: 'transfer', args: [V4, oldUsdt], account, chain })
    await pub.waitForTransactionReceipt({ hash: h })
  }
  if (oldSlearn > 0n) {
    const slearnAddr = await pub.readContract({ address: V3, abi: LearnTGVaultsV3Abi as any, functionName: 'slearnToken' }) as Address
    console.log(`  Transferring SLEARN → V4 (token: ${slearnAddr})`)
    const h = await wallet.writeContract({ address: slearnAddr, abi: Erc20Abi as any, functionName: 'transfer', args: [V4, oldSlearn], account, chain })
    await pub.waitForTransactionReceipt({ hash: h })
  }

  // 3. Create vaults and set balances in V4
  console.log('  Migrating vaults...')
  const courses = await db.selectFrom('cor1440_gen_proyectofinanciero').select('id').execute()
  for (const course of courses) {
    try {
      const vault: any = await pub.readContract({ address: V3, abi: LearnTGVaultsV3Abi as any, functionName: 'vaults', args: [BigInt(course.id)] })
      if (!vault || !vault[5]) continue
      const cid = BigInt(course.id)
      const balUSDT = vault[1] as bigint
      const balSLEARN = vault[2] as bigint
      const perUSDT = vault[3] as bigint
      const perSLEARN = vault[4] as bigint

      const existsCheck: any = await pub.readContract({ address: V4, abi: LearnTGVaultsV3Abi as any, functionName: 'vaults', args: [cid] })
      if (existsCheck && existsCheck[5]) {
        console.log(`  Course ${course.id}: exists, skipping`)
        continue
      }

      const h = await wallet.writeContract({ address: V4, abi: LearnTGVaultsV3Abi as any, functionName: 'createVault', args: [cid, perUSDT, perSLEARN], account, chain })
      await pub.waitForTransactionReceipt({ hash: h })

      // Restore balance (will be set globally in step 4, skip per-course for now)
      console.log(`  Course ${course.id}: created (USDT=${formatUnits(perUSDT, 6)} SLEARN=${formatUnits(perSLEARN, 2)})`)
    } catch (e: any) {
      console.log(`  Course ${course.id}: ⚠️ ${e?.message || e}`)
    }
  }

  // 4. Set global vault balances (V4 started with 0, now has the transferred tokens)
  const newUsdt = await pub.readContract({ address: V4, abi: LearnTGVaultsV3Abi as any, functionName: 'getContractUSDTBalance' }) as bigint
  const newSlearn = await pub.readContract({ address: V4, abi: LearnTGVaultsV3Abi as any, functionName: 'getContractSLEARNBalance' }) as bigint
  console.log(`  V4 holds: ${formatUnits(newUsdt, 6)} USDT, ${formatUnits(newSlearn, 2)} SLEARN`)

  // Distribute across vaults proportionally (for now, set same balances as V3 had)
  for (const course of courses) {
    try {
      const vault: any = await pub.readContract({ address: V3, abi: LearnTGVaultsV3Abi as any, functionName: 'vaults', args: [BigInt(course.id)] })
      if (!vault || !vault[5]) continue
      const balUSDT = vault[1] as bigint
      const balSLEARN = vault[2] as bigint
      if (balUSDT > 0n || balSLEARN > 0n) {
        const h = await wallet.writeContract({ address: V4, abi: LearnTGVaultsV3Abi as any, functionName: 'setVaultBalance', args: [BigInt(course.id), balUSDT, balSLEARN], account, chain })
        await pub.waitForTransactionReceipt({ hash: h })
      }
    } catch {}
  }

  // 5. Migrate guidePaid records (idempotent — reads DB transactions, not guide_usuario)
  console.log('  Migrating guidePaid from transaction table...')
  const txs = await db.selectFrom('transaction')
    .select(['usuario_id', 'crypto', 'amount', 'metadata'])
    .where('type', '=', 'scholarship')
    .where(eb => eb('crypto', '=', 'usdt').or('crypto', '=', 'slearn'))
    .execute()

  // Aggregate by (usuario_id, guideId) to get total paid per token per guide
  const paidMap = new Map<string, { usdt: bigint; slearn: bigint; courseId: number | null }>()
  const usdtDecimals = 6
  const slearnDecimals = 2

  for (const tx of txs) {
    try {
      const meta = typeof tx.metadata === 'string' ? JSON.parse(tx.metadata) : (tx.metadata as any || {})
      const guideId = meta?.guideId
      const courseId = meta?.courseId
      if (!guideId || !courseId) continue
      const key = `${tx.usuario_id}:${guideId}`
      let entry = paidMap.get(key)
      if (!entry) {
        entry = { usdt: 0n, slearn: 0n, courseId: Number(courseId) }
        paidMap.set(key, entry)
      }
      const raw = parseUnits(String(Number(tx.amount)), tx.crypto === 'usdt' ? usdtDecimals : slearnDecimals)
      if (tx.crypto === 'usdt') entry.usdt += raw
      else entry.slearn += raw
    } catch {}
  }

  console.log(`  Found ${paidMap.size} unique (user, guide) pairs in transaction table`)

  let migrated = 0
  let skipped = 0
  for (const [key, entry] of paidMap) {
    const [usuarioIdStr, guideIdStr] = key.split(':')
    const usuarioId = Number(usuarioIdStr)
    const guideId = Number(guideIdStr)
    try {
      const bw = await db.selectFrom('billetera_usuario')
        .select('billetera')
        .where('usuario_id', '=', usuarioId)
        .executeTakeFirst()
      if (!bw) { skipped++; continue }

      // Idempotent: check V4 first
      const v4Status: any = await pub.readContract({
        address: V4, abi: LearnTGVaultsV3Abi as any, functionName: 'getStudentGuideStatus',
        args: [BigInt(entry.courseId!), BigInt(guideId), bw.billetera as Address]
      })
      const v4USDT = v4Status[0] as bigint
      const v4SLEARN = v4Status[1] as bigint

      // Only set if V4 has less than DB total
      if (entry.usdt > v4USDT || entry.slearn > v4SLEARN) {
        console.log(`  setGuidePaid user=${usuarioId} guide=${guideId} USDT=${formatUnits(entry.usdt, usdtDecimals)} SLEARN=${formatUnits(entry.slearn, slearnDecimals)}`)
        const h = await wallet.writeContract({
          address: V4, abi: LearnTGVaultsV3Abi as any, functionName: 'setGuidePaid',
          args: [BigInt(entry.courseId!), BigInt(guideId), bw.billetera as Address, entry.usdt, entry.slearn],
          account, chain
        })
        await pub.waitForTransactionReceipt({ hash: h })
        migrated++
      } else {
        skipped++
      }
    } catch (e: any) {
      console.error(`  ⚠️ Failed guide=${guideId} user=${usuarioId}: ${e?.message || e}`)
    }
  }
  console.log(`  guidePaid migrated: ${migrated}, skipped: ${skipped}`)

  console.log(`\n✅ Migration complete`)
  console.log(`Update apps/.env:`)
  console.log(`  NEXT_PUBLIC_DEPLOYED_AT_V3=${V3}  # archive`)
  console.log(`  NEXT_PUBLIC_DEPLOYED_AT=${V4}      # active`)
}

export async function down(_db: Kysely<any>): Promise<void> {}
