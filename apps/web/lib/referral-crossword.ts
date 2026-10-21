// lib/referral-crossword.ts — Atribución de referidos en el flujo de crucigrama
// (https://github.com/pasosdeJesus/learn.tg/issues/163, Form 2): cuando un usuario referido completa un crucigrama de un
// curso MISSIONAL, el referidor gana el 10% del scholarship, pagado desde la
// billetera de referidos. El estudiante conserva el 100%.
import { Kysely } from 'kysely'
import { awardReferralRewards } from '@/lib/referral-payout'

// Cursos misionales (Form 2 solo aplica aquí): "Una relación con Jesús" (1) y
// "A relationship with Jesus" (2). Cualquier otro curso no genera recompensa
// de referido por crucigrama.
export const MISSIONAL_COURSE_IDS = [1, 2]

export function isMissionalCourse(courseId: number): boolean {
  return MISSIONAL_COURSE_IDS.includes(courseId)
}

export async function awardMissionalScholarshipReferral(opts: {
  db: Kysely<any>
  referredUserId: number
  courseId: number
  guideId: number
  scholarshipUsdt: number
  scholarshipSlearn: number
}): Promise<void> {
  const { db, referredUserId, courseId, guideId, scholarshipUsdt, scholarshipSlearn } = opts
  if (!isMissionalCourse(courseId)) return
  if (scholarshipUsdt <= 0 && scholarshipSlearn <= 0) return
  await awardReferralRewards({
    db,
    referredUserId,
    courseId,
    guideId,
    scholarshipUsdt,
    scholarshipSlearn,
  })
}
