// Migration: Sync guidePaid on V4 from guide_usuario table.
//
// Fixes gap from V3→V4 migration (20260607_contract-to-v4.ts) which only
// migrated records with guideId in transaction.metadata. 190 USDT scholarship
// records from April 2026 had NULL guideId and were skipped, leaving V4's
// guidePaidUSDT at 0. When users resubmit for SLEARN, the contract pays USDT
// again (correct per on-chain state, incorrect per DB).
//
// This migration reads guide_usuario (actividadpf_id + amountpaid) directly,
// bypassing the transaction metadata gap.

import { Kysely } from 'kysely'
import { createPublicClient, createWalletClient, http, formatUnits } from 'viem'
import { celo, celoSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import LearnTGVaultsV3Abi from '../../abis/LearnTGVaultsV3.json' with { type: 'json' }
import { getV4Address } from '../../lib/deployments'

type Address = `0x${string}`

export async function up(db: Kysely<any>): Promise<void> {
  const pk = process.env.PRIVATE_KEY
  if (!pk) throw new Error('PRIVATE_KEY not set')
  const account = privateKeyToAccount(pk as Address)
  const isProduction = process.env.NEXT_PUBLIC_NETWORK === 'celo' || process.env.NEXT_PUBLIC_NETWORK?.includes('mainnet')
  const chain = isProduction ? celo : celoSepolia

  const V4 = await getV4Address()
  if (!V4) throw new Error('LearnTGVaultsV4 deployment not found')

  const pub = createPublicClient({ chain, transport: http() })
  const wallet = createWalletClient({ account, chain, transport: http() })
  const V4Addr = V4 as Address

  console.log(`Syncing guidePaid from guide_usuario to V4 at ${V4Addr}`)

  const rows = await db.selectFrom('guide_usuario')
    .innerJoin('cor1440_gen_actividadpf', 'cor1440_gen_actividadpf.id', 'guide_usuario.actividadpf_id')
    .innerJoin('billetera_usuario', 'billetera_usuario.usuario_id', 'guide_usuario.usuario_id')
    .select([
      'guide_usuario.usuario_id',
      'guide_usuario.actividadpf_id as guide_id',
      'guide_usuario.amountpaid',
      'cor1440_gen_actividadpf.proyectofinanciero_id as course_id',
      'billetera_usuario.billetera as wallet',
    ])
    .where('guide_usuario.points', '=', 1)
    .where('guide_usuario.amountpaid', '>', 0)
    .execute()

  console.log(`Found ${rows.length} completed guides with amountpaid > 0`)

  let synced = 0
  let skipped = 0

  for (const row of rows) {
    try {
      const walletAddr = row.wallet.toLowerCase() as Address
      const courseId = BigInt(row.course_id)
      const guideId = BigInt(row.guide_id)

      let v4USDT = 0n
      let v4SLEARN = 0n
      try {
        const status: any = await pub.readContract({
          address: V4Addr,
          abi: LearnTGVaultsV3Abi as any,
          functionName: 'getStudentGuideStatus',
          args: [courseId, guideId, walletAddr],
        })
        v4USDT = BigInt(status[0] || 0)
        v4SLEARN = BigInt(status[1] || 0)
      } catch (e: any) {
        console.log(`  ⚠️ getStudentGuideStatus failed user=${row.usuario_id} guide=${row.guide_id}: ${e?.message || e}`)
        skipped++
        continue
      }

      const dbAmount = BigInt(row.amountpaid)

      // Only sync if V4 has less USDT than DB (keep existing SLEARN as-is)
      if (dbAmount <= v4USDT) {
        skipped++
        continue
      }

      console.log(`  setGuidePaid user=${row.usuario_id} guide=${row.guide_id} USDT=${formatUnits(dbAmount, 6)} (V4 had ${formatUnits(v4USDT, 6)})`)
      const h = await wallet.writeContract({
        address: V4Addr,
        abi: LearnTGVaultsV3Abi as any,
        functionName: 'setGuidePaid',
        args: [courseId, guideId, walletAddr, dbAmount, v4SLEARN],
        account,
        chain,
      })
      await pub.waitForTransactionReceipt({ hash: h })
      synced++
    } catch (e: any) {
      console.error(`  ❌ Failed user=${row.usuario_id} guide=${row.guide_id}: ${e?.message || e}`)
    }
  }

  console.log(`\n✅ Sync complete: ${synced} synced, ${skipped} skipped`)
}

export async function down(_db: Kysely<any>): Promise<void> {}
