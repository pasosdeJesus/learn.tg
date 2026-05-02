'use server'

import { Kysely, sql } from 'kysely'
import type { Insertable, Selectable, Updateable } from 'kysely'

import type { DB, Usuario, GuideUsuario } from '@/db/db.d'

const USD_TO_SLE_RATE = 22;
const SLE_TO_SCORE_RATIO = 10;

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
    .where('crypto', '=', 'learningpoints')
    .select(db.fn.sum('impacto_balance').as('total_points'))
    .executeTakeFirst()
  
  const total = Number(result?.total_points) || 0
  
  await db
    .updateTable('usuario')
    .set({ 
      learningscore: total,
      updated_at: new Date() 
    })
    .where('id', '=', userId as any)
    .execute()
    
  return total
}

export async function calculateDonationLearningScore(
  donationAmountUSD: number
): Promise<number> {
  const scoreToAdd = (donationAmountUSD * USD_TO_SLE_RATE) / SLE_TO_SCORE_RATIO;
  // Round to 2 decimal places to avoid floating point inaccuracies
  return Math.round(scoreToAdd * 100) / 100;
}

// Deprecated: Use calculateDonationLearningScore and then refreshUserLearningScore
export async function addDonationToLearningScore(
  db: Kysely<DB>,
  userId: string,
  donationAmountUSD: number
): Promise<number> {
  const roundedScoreToAdd = await calculateDonationLearningScore(donationAmountUSD);
  const numericUserId = parseInt(userId, 10);
  
  // We keep this for backward compatibility but it should ideally insert a transaction too
  // if it's called outside a context that already does it.
  // For now, it just updates the table directly which we want to avoid.
  // Let's make it refresh from transactions instead.
  
  return await refreshUserLearningScore(db, numericUserId);
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
    if (!wallet || wallet.trim() === '') {
      throw new Error(`Wallet address is required for transaction insertion for user ${user.id}`);
    }

    await db.insertInto('transaction').values({
        usuario_id: user.id,
        fecha: new Date(),
        tipo: 'scholarship',
        crypto: 'learningpoints',
        cantidad: guide.points,
        impacto_balance: guide.points,
        wallet: wallet,
        metadata: { courseId: courseId, guideId: guide.actividadpf_id }
    }).execute();
  }

  // 3. Calculate global Learning Score from all transactions and update table
  return await refreshUserLearningScore(db, user.id);
}

