'use server'

import { Kysely, sql } from 'kysely'
import type { Insertable, Selectable, Updateable } from 'kysely'

import type { DB, Usuario, CourseUsuario, GuideUsuario } from '@/db/db.d'

const USD_TO_SLE_RATE = 22;
const SLE_TO_SCORE_RATIO = 10;

interface CourseData {
  [key: number]: number
}

/**
 * Adds a calculated learning score to a user's profile based on a donation amount.
 *
 * @param db The Kysely database instance.
 * @param userId The ID of the user to whom the score will be added.
 * @param donationAmountUSD The amount of the donation in USD.
 * @returns The new total learning score.
 */
export async function addDonationToLearningScore(
  db: Kysely<DB>,
  userId: string,
  donationAmountUSD: number
): Promise<number> {
  const scoreToAdd = (donationAmountUSD * USD_TO_SLE_RATE) / SLE_TO_SCORE_RATIO;

  // Round to 2 decimal places to avoid floating point inaccuracies
  const roundedScoreToAdd = Math.round(scoreToAdd * 100) / 100;

  const numericUserId = parseInt(userId, 10);
  if (isNaN(numericUserId)) {
    throw new Error(`Invalid user ID: ${userId}`);
  }

  const user = await db
    .selectFrom('usuario')
    .where('id', '=', numericUserId as any)
    .select('learningscore')
    .executeTakeFirst();

  if (!user) {
    throw new Error(`User with ID ${userId} not found.`);
  }

  const currentScore = user.learningscore || 0;
  const newLearningScore = currentScore + roundedScoreToAdd;

  await db
    .updateTable('usuario')
    .set({ 
      learningscore: newLearningScore,
      updated_at: new Date(),
    })
    .where('id', '=', numericUserId as any)
    .execute();

  return newLearningScore;
}


/**
 * Calculates and updates all scores for a user, including global scores
 * and course-specific metrics, within a single database transaction.
 * This function now preserves the fractional part of the learning score (from donations).
 *
 * @param db - The Kysely database instance.
 * @param user - The user object, as selected from the database.
 * @param courseId - The course being updated
 * @param guide - The guide being updated (optional)
 * @returns An object containing the final learningscore and profilescore.
 */
export async function updateUserAndCoursePoints(
  db: Kysely<DB>,
  user: Selectable<Usuario>,
  courseId: number | null,
  guide: Selectable<GuideUsuario> | null
): Promise<number> {
  // Preserve the fractional part of the learning score, which comes from donations.
  const donationScore = (user.learningscore || 0) % 1;

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
  const courseIds = Object.keys(pointsGuidesCourse);
  if (courseId && !courseIds.includes(courseId.toString())) {
    courseIds.push(courseId.toString());
  }
  for (const cId of courseIds) {
    const currentCourseId = Number(cId);
    const userCourse = (await db
    .selectFrom('course_usuario')
    .where('usuario_id', '=', user.id)
    .where('proyectofinanciero_id', '=', currentCourseId)
    .selectAll()
    .execute()) || []
    if (userCourse.length == 0) {
      const cp: Insertable<CourseUsuario> = {
        usuario_id: user.id,
        proyectofinanciero_id: currentCourseId,
        points: 0,
        guidespoints: 0,
        amountscholarship: 0,
        percentagecompleted: 0,
      }
      await db
      .insertInto('course_usuario')
      .values(cp)
      .returningAll()
      .executeTakeFirstOrThrow()
    }
    const courseGuidesCountResult = await db
    .selectFrom('cor1440_gen_actividadpf')
    .where('proyectofinanciero_id', '=', currentCourseId)
    .select(db.fn.countAll().as('count'))
    .executeTakeFirst()
    const totalGuidesInCourse = Number(courseGuidesCountResult?.count) || 0
    const percentd = totalGuidesInCourse > 0 ? 
      ((amountGuidesCourse[currentCourseId] || 0) / totalGuidesInCourse) * 100 : 0

    const updateCourseUsuario = {
      guidespoints: pointsGuidesCourse[currentCourseId] || 0,
      amountscholarship: earnedCourse[currentCourseId] || 0,
      percentagecompleted: Math.round(percentd),
    }
    await db
    .updateTable('course_usuario')
    .set(updateCourseUsuario as any)
    .where('usuario_id', '=', user.id)
    .where('proyectofinanciero_id', '=', currentCourseId)
    .execute()
  }


  // 3. Calculate global Learning Score from courses and guides (the integer part)
  const totalGuidePointsResult = await db
  .selectFrom('guide_usuario')
  .where('usuario_id', '=', user.id)
  .select(db.fn.sum('points').as('total_points'))
  .executeTakeFirst()
  const totalGuidePoints = Number(totalGuidePointsResult?.total_points) || 0

  const totalCoursePointsResult = await db
  .selectFrom('course_usuario')
  .where('usuario_id', '=', user.id)
  .select(db.fn.sum('points').as('total_points'))
  .executeTakeFirst()
  const totalCoursePoints = Number(totalCoursePointsResult?.total_points) || 0

  // This is the score from educational activities
  const baseLearningscore = totalGuidePoints + totalCoursePoints

  // Combine the base score with the preserved donation score
  const finalLearningscore = baseLearningscore + donationScore;

  if (guide) {
    await db.insertInto('transaction').values({
        usuario_id: user.id,
        fecha: new Date(),
        tipo: 'earn-guide',
        crypto: 'learningpoints',
        cantidad: guide.points,
        impacto_balance: guide.points,
        metadata: { courseId: courseId, guideId: guide.id }
    }).execute();
  }


  // 4. Update the main usuario table
  const uUsuario: Updateable<Usuario> = {
    learningscore: finalLearningscore,
    updated_at: new Date(),
  }

  await db
  .updateTable('usuario')
  .set(uUsuario)
  .where('id', '=', user.id).execute()

  return finalLearningscore
}
