'use server'

import { Kysely } from 'kysely'
import type { Selectable } from 'kysely'

import type { DB, Usuario, GuideUsuario } from '@/db/db.d'
import { getSLEUSDRate } from '@/lib/sle-rate'

const USD_TO_SLE_RATE = 22
const DONATION_REWARD_PCT = 0.10;

export async function refreshUserLearningScore(
  db: Kysely<DB>,
  userId: number
): Promise<number> {
  const result = await db
    .selectFrom('transaction')
    .where('usuario_id', '=', userId)
    .where('crypto', '=', 'slearn')
    .select(db.fn.sum('balance_impact').as('total_points'))
    .executeTakeFirst()
  
  const total = Number(result?.total_points) || 0
  
  await db
    .updateTable('usuario')
    .set({ 
      learningscore_deprecated: total,
      updated_at: new Date() 
    })
    .where('id', '=', userId as any)
    .execute()
    
  return total
}

export async function calculateDonationSLEARN(
  donationAmountUSD: number
): Promise<number> {
  const rate = await getSLEUSDRate();
  const slearnAmount = donationAmountUSD * DONATION_REWARD_PCT * rate;
  return Math.round(slearnAmount * 100) / 100;
}


export async function updateUserAndCoursePoints(
  db: Kysely<DB>,
  user: Selectable<Usuario>,
  courseId: number | null,
  wallet: string,
  guide: Selectable<GuideUsuario> | null
): Promise<number> {
  return Number(user.learningscore_deprecated) || 0
}

