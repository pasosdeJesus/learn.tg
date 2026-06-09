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

  // 5. Migrate guidePaid records
  console.log('  Migrating guidePaid...')
  const guideUsers = await db.selectFrom('guide_usuario').selectAll().execute()
  let migrated = 0
  for (const gu of guideUsers) {
    try {
      const bw = await db.selectFrom('billetera_usuario').select('billetera').where('usuario_id', '=', gu.usuario_id).executeTakeFirst()
      const act = await db.selectFrom('cor1440_gen_actividadpf').select('proyectofinanciero_id').where('id', '=', gu.actividadpf_id).executeTakeFirst()
      if (!bw || !act) continue
      const status: any = await pub.readContract({ address: V3, abi: LearnTGVaultsV3Abi as any, functionName: 'getStudentGuideStatus', args: [BigInt(act.proyectofinanciero_id), BigInt(gu.actividadpf_id), bw.billetera as Address] })
      const pU = status[0] as bigint
      const pS = status[1] as bigint
      if (pU > 0n || pS > 0n) {
        await wallet.writeContract({ address: V4, abi: LearnTGVaultsV3Abi as any, functionName: 'setGuidePaid', args: [BigInt(act.proyectofinanciero_id), BigInt(gu.actividadpf_id), bw.billetera as Address, pU, pS], account, chain })
        migrated++
      }
    } catch {}
  }
  console.log(`  guidePaid migrated: ${migrated}`)

  console.log(`\n✅ Migration complete`)
  console.log(`Update apps/.env:`)
  console.log(`  NEXT_PUBLIC_DEPLOYED_AT_V3=${V3}  # archive`)
  console.log(`  NEXT_PUBLIC_DEPLOYED_AT=${V4}      # active`)
}

export async function down(_db: Kysely<any>): Promise<void> {}
