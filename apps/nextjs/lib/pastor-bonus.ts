import { Kysely } from 'kysely'
import type { DB } from '@/db/db.d'
import { createPublicClient, createWalletClient, http, parseUnits, formatUnits, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo, celoSepolia } from 'viem/chains'
import SLEARNAbi from '@/abis/SLEARN.json'
import { getSlearnAddress } from '@/lib/deployments'
import { IS_PRODUCTION } from '@/lib/config'

export const BONUS_AMOUNT = 44
export const ELIGIBLE_COUNTRIES = [170, 694] // Colombia, Sierra Leone

export interface BonusUser {
  church_relationship: string | null
  pais_id: number | null
  verified_whatsapp: string | null
  verified_email: string | null
  verified_city_id: number | null
  verified_church_relationship: string | null
  verified_place_of_worship: string | null
  position_israel_gaza: string | null
  billetera?: string | null
}

export function isEligiblePastor(user: BonusUser): boolean {
  return (
    user.church_relationship === 'pastor' &&
    !!user.pais_id && ELIGIBLE_COUNTRIES.includes(user.pais_id) &&
    !!user.verified_whatsapp &&
    !!user.verified_email &&
    !!user.verified_city_id &&
    !!user.verified_church_relationship &&
    !!user.verified_place_of_worship &&
    user.position_israel_gaza === 'no'
  )
}

export async function awardPastorBonus(
  db: Kysely<DB>,
  userId: number,
): Promise<{ awarded: boolean; reason?: string; hash?: string }> {
  const pastor = await db
    .selectFrom('usuario')
    .leftJoin('billetera_usuario as bw', 'bw.usuario_id', 'usuario.id')
    .leftJoin('church as ch', 'ch.id', 'usuario.church_id')
    .select([
      'usuario.church_relationship', 'usuario.pais_id',
      'usuario.verified_whatsapp', 'usuario.verified_email', 'usuario.verified_city_id',
      'usuario.verified_church_relationship', 'usuario.verified_place_of_worship',
      'usuario.position_israel_gaza',
      'bw.billetera',
      'ch.registration_verified',
    ])
    .where('usuario.id', '=', userId)
    .executeTakeFirst()

  if (!pastor) return { awarded: false, reason: 'pastor not found' }
  if (!isEligiblePastor(pastor as BonusUser)) return { awarded: false, reason: 'not eligible' }
  if (pastor.registration_verified !== true) return { awarded: false, reason: 'church not verified' }
  if (!pastor.billetera) return { awarded: false, reason: 'no wallet' }

  const existing = await db
    .selectFrom('transaction')
    .select('id')
    .where('usuario_id', '=', userId)
    .where('type', '=', 'pastor_bonus')
    .executeTakeFirst()
  if (existing) return { awarded: false, reason: 'already awarded' }

  const churchesWallet = process.env.NEXT_PUBLIC_CHURCHES_WALLET_ADDRESS as Address | undefined
  const churchesPk = process.env.CHURCHES_WALLET_PRIVATE_KEY
  if (!churchesWallet || !churchesPk) {
    return { awarded: false, reason: 'churches fund not configured' }
  }

  const slearnAddress = await getSlearnAddress()
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://forno.celo.org'
  const chain = IS_PRODUCTION ? celo : celoSepolia
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })

  const amountRaw = parseUnits(String(BONUS_AMOUNT), 2)
  const fundBalance = (await publicClient.readContract({
    address: slearnAddress,
    abi: SLEARNAbi as any,
    functionName: 'balanceOf',
    args: [churchesWallet],
  })) as bigint
  if (fundBalance < amountRaw) {
    return { awarded: false, reason: `insufficient fund (${formatUnits(fundBalance, 2)} SLEARN)` }
  }

  const account = privateKeyToAccount(churchesPk as Address)
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) })
  const hash = await walletClient.writeContract({
    address: slearnAddress,
    abi: SLEARNAbi as any,
    functionName: 'transfer',
    args: [pastor.billetera as Address, amountRaw],
  })
  await publicClient.waitForTransactionReceipt({ hash })

  await db.insertInto('transaction').values({
    usuario_id: userId,
    type: 'pastor_bonus',
    crypto: 'slearn',
    amount: BONUS_AMOUNT,
    balance_impact: BONUS_AMOUNT,
    categoria: 'pastor_bonus',
    wallet: pastor.billetera,
    hash,
    date: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    metadata: JSON.stringify({ source: 'churches_fund', reason: 'Verified non-Zionist pastor bonus' }),
  } as any).execute()

  await db.insertInto('verification_log').values({
    usuario_id: userId,
    action: 'award_pastor_bonus',
    details: JSON.stringify({ amount: BONUS_AMOUNT, crypto: 'slearn', hash }),
    created_at: new Date(),
  } as any).execute()

  return { awarded: true, hash }
}
