// lib/referral-payout.ts — Pagos off-chain de recompensas de referidos
// (REQ/163). Form 1 (10% de compra premium, 50% USDT + 50% SLEARN), Form 2
// (10% del scholarship en curso missional) y Form 3 (1 USDT pastor bonus al
// referir un pastor que compra el curso GD). Todos se pagan DESDE la referral
// wallet (PRIVATE_KEY_REFERRAL_WALLET); si no hay fondos se omite (logged).
// Idempotente: verifica `transaction` antes de pagar de nuevo.
import { Kysely, sql } from 'kysely'
import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { getChain, getPublicClient, getUsdtAddress, sendTxAndWait } from '@/lib/backend-config'
import { IS_PRODUCTION } from '@learn-tg/rewards/lib/config'
import { referralReward, canPayFromWallet, type RewardAmounts } from '@/lib/referral-rewards'
import { recordEvent } from '@/lib/metrics-server'
import Erc20Abi from '@/abis/IERC20.json'
import SLEARNAbi from '@/abis/SLEARN.json'

const GD_COURSE_IDS = [10, 11]

function referralWalletKey(): `0x${string}` {
  const key = process.env.PRIVATE_KEY_REFERRAL_WALLET
  if (!key) throw new Error('PRIVATE_KEY_REFERRAL_WALLET not configured')
  return key as `0x${string}`
}

function referralWalletClient() {
  const account = privateKeyToAccount(referralWalletKey())
  return createWalletClient({
    account,
    chain: getChain(),
    transport: http(process.env.NEXT_PUBLIC_RPC_URL || (IS_PRODUCTION ? 'https://forno.celo.org' : 'https://forno.celo-sepolia.celo-testnet.org/')),
  })
}

export async function getReferralWalletBalances(): Promise<{ usdt: number; slearn: number }> {
  const publicClient = getPublicClient()
  const wallet = process.env.NEXT_PUBLIC_REFERRAL_WALLET_ADDRESS as `0x${string}`
  const usdt = await publicClient.readContract({
    address: (await getUsdtAddress()) as `0x${string}`,
    abi: Erc20Abi as any,
    functionName: 'balanceOf',
    args: [wallet],
  }) as bigint
  const slearn = await publicClient.readContract({
    address: process.env.NEXT_PUBLIC_SLEARN_ADDRESS as `0x${string}`,
    abi: SLEARNAbi as any,
    functionName: 'balanceOf',
    args: [wallet],
  }) as bigint
  return { usdt: Number(usdt) / 1e6, slearn: Number(slearn) / 100 }
}

async function alreadyPaid(
  db: Kysely<any>,
  referrerId: number,
  referredId: number,
  courseId: number,
  guideId: number | null,
  tipo: 'referral_reward' | 'referral_bonus',
): Promise<boolean> {
  const row = await db
    .selectFrom('transaction')
    .select('id')
    .where('usuario_id', '=', referrerId)
    .where('type', '=', tipo)
    .where(sql`metadata->>'referred_id'`, '=', String(referredId))
    .where(sql`metadata->>'course_id'`, '=', String(courseId))
    .$if(guideId != null, (qb) => qb.where(sql`metadata->>'guide_id'`, '=', String(guideId)))
    .executeTakeFirst()
  return !!row
}

async function transferToken(
  tokenAddress: `0x${string}`,
  abi: any,
  decimals: number,
  to: `0x${string}`,
  amount: number,
): Promise<`0x${string}` | null> {
  if (amount <= 0) return null
  const publicClient = getPublicClient()
  const walletClient = referralWalletClient()
  const hash = await sendTxAndWait(walletClient, publicClient, {
    address: tokenAddress,
    abi,
    functionName: 'transfer',
    args: [to, BigInt(Math.round(amount * 10 ** decimals))],
  })
  return hash
}

/**
 * Paga las recompensas de referidos del usuario `referredUserId` tras una
 * compra premium (Form 1 + Form 3 si pastor GD) o un crossword missional
 * (Form 2). No hace nada si el usuario no tiene referidor.
 */
export async function awardReferralRewards(opts: {
  db: Kysely<any>
  referredUserId: number
  courseId: number
  guideId?: number | null
  coursePriceUsdt?: number
  form1Amounts?: RewardAmounts
  scholarshipUsdt?: number
  scholarshipSlearn?: number
  isPastor?: boolean
}): Promise<void> {
  const { db, referredUserId, courseId, guideId, coursePriceUsdt, form1Amounts, scholarshipUsdt, scholarshipSlearn, isPastor } = opts

  const rel = await db
    .selectFrom('referralrelationship')
    .select(['referrer_id', 'referral_code'])
    .where('referred_id', '=', referredUserId)
    .executeTakeFirst()
  if (!rel) return

  const referrerId = rel.referrer_id
  const referrer = await db.selectFrom('usuario').select('billetera_usuario')
    .innerJoin('billetera_usuario', 'billetera_usuario.usuario_id', 'usuario.id')
    .where('usuario.id', '=', referrerId).executeTakeFirst()
  if (!referrer?.billetera_usuario) return

  const rewards: Array<{ tipo: 'referral_reward' | 'referral_bonus'; amounts: RewardAmounts }> = []
  if (coursePriceUsdt != null || form1Amounts != null) {
    const f1 = form1Amounts ?? referralReward(1, { coursePriceUsdt })
    if (f1.usdt > 0 || f1.slearn > 0) rewards.push({ tipo: 'referral_reward', amounts: f1 })
    if (isPastor && GD_COURSE_IDS.includes(courseId)) {
      const f3 = referralReward(3, { isPastorReferral: true })
      rewards.push({ tipo: 'referral_bonus', amounts: f3 })
    }
  }
  if (scholarshipUsdt != null || scholarshipSlearn != null) {
    const f2 = referralReward(2, { scholarshipUsdt, scholarshipSlearn })
    if (f2.usdt > 0 || f2.slearn > 0) rewards.push({ tipo: 'referral_reward', amounts: f2 })
  }

  for (const { tipo, amounts } of rewards) {
    if (await alreadyPaid(db, referrerId, referredUserId, courseId, guideId ?? null, tipo)) continue
    const wallet = await getReferralWalletBalances()
    if (!canPayFromWallet(amounts, wallet)) {
      console.warn(`[referral] ${tipo} skipped: insufficient referral wallet funds`, amounts, wallet)
      continue
    }
    const dest = referrer.billetera_usuario as `0x${string}`
    const usdtAddress = await getUsdtAddress()
    const usdtHash = await transferToken(usdtAddress!, Erc20Abi as any, 6, dest, amounts.usdt)
    const slearnHash = await transferToken(process.env.NEXT_PUBLIC_SLEARN_ADDRESS as `0x${string}`, SLEARNAbi as any, 2, dest, amounts.slearn)
    const hash = usdtHash || slearnHash
    if (!hash) continue

    const now = new Date()
    if (amounts.usdt > 0) {
      await db.insertInto('transaction').values({
        usuario_id: referrerId, wallet: dest, crypto: 'usdt', type: tipo,
        amount: amounts.usdt, balance_impact: amounts.usdt, date: now, hash: usdtHash,
        categoria: 'referral', subcategoria: tipo === 'referral_bonus' ? 'pastor_bonus' : 'referrer',
        metadata: JSON.stringify({ referred_id: referredUserId, course_id: courseId, ...(guideId ? { guide_id: guideId } : {}) }),
      } as any).execute()
    }
    if (amounts.slearn > 0) {
      await db.insertInto('transaction').values({
        usuario_id: referrerId, wallet: dest, crypto: 'slearn', type: tipo,
        amount: amounts.slearn, balance_impact: amounts.slearn, date: now, hash: slearnHash,
        categoria: 'referral', subcategoria: tipo === 'referral_bonus' ? 'pastor_bonus' : 'referrer',
        metadata: JSON.stringify({ referred_id: referredUserId, course_id: courseId, ...(guideId ? { guide_id: guideId } : {}) }),
      } as any).execute()
    }
    await recordEvent({
      event_type: tipo === 'referral_bonus' ? 'referral_bonus_paid' : 'referral_reward_paid',
      usuario_id: referrerId,
      event_data: { referred_id: referredUserId, course_id: courseId, ...(guideId ? { guide_id: guideId } : {}), usdt: amounts.usdt, slearn: amounts.slearn },
    } as any).catch(() => {})
  }
}
