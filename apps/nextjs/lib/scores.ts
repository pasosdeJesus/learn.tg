'use server'

import { Kysely, sql } from 'kysely'
import type { Insertable, Selectable, Updateable } from 'kysely'

import type { DB, Usuario, GuideUsuario } from '@/db/db.d'
import { getSLEUSDRate } from '@/lib/sle-rate'

const USD_TO_SLE_RATE = 22
const DONATION_REWARD_PCT = 0.10;

interface CourseData {
  [key: number]: number
}

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
    } as any)
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
  // Process each guide the user has answered
  const guidesUsuario = await sql<any>`
  SELECT *
    FROM guide_usuario
  INNER JOIN cor1440_gen_actividadpf ON 
  cor1440_gen_actividadpf.id=guide_usuario.actividadpf_id
  WHERE guide_usuario.usuario_id = ${user.id}
  `.execute(db)

  const pointsGuidesCourse: CourseData = {}
  const earnedCourse: CourseData = {}
  const amountGuidesCourse: CourseData = {}

  for (const guideUsuario of guidesUsuario.rows) {
    const courseId = guideUsuario.proyectofinanciero_id;
    if (pointsGuidesCourse[courseId] == 
        undefined) {
      pointsGuidesCourse[courseId] = 0
    }
    pointsGuidesCourse[courseId] += 
      guideUsuario.points
    if (amountGuidesCourse[courseId] == 
        undefined) {
      amountGuidesCourse[courseId] = 0
    }
    if (guideUsuario.points > 0) {
      amountGuidesCourse[courseId] += 1
    }
    if (earnedCourse[courseId] == undefined) {
      earnedCourse[courseId] = 0
    }
    earnedCourse[courseId] += 
      guideUsuario.amountpaid
  }

  if (guide) {
    // El pago real de SLEARN + USDT ya se registra en check-crossword/route.ts
    // vía payScholarship() on-chain. Aquí no duplicamos.
  }

  // 3. Calculate global Learning Score from all transactions and update table
  return await refreshUserLearningScore(db, user.id);
}

