'use server'

import { Kysely, sql } from 'kysely'
import type { Insertable, Selectable, Updateable } from 'kysely'

import type { DB, Usuario, CourseUsuario } from '@/db/db.d'

interface CourseData {
  [key: number]: number
}

/**
 * Calculates and updates all scores for a user, including global scores
 * and course-specific metrics, within a single database transaction.
 *
 * @param db - The Kysely database instance.
 * @param user - The user object, as selected from the database.
 * @returns An object containing the final learningscore and profilescore.
 */
export async function updateUserAndCoursePoints(
  db: Kysely<DB>,
  user: Selectable<Usuario>,
  courseId: number | null,
): Promise<number> {
  console.log("OJO updateUserAndCoursePoints. user=", user)
  // Process each guide the user has answered
  const guidesUsuario = await sql<any>`
  SELECT *
    FROM guide_usuario
  INNER JOIN cor1440_gen_actividadpf ON 
  cor1440_gen_actividadpf.id=guide_usuario.actividadpf_id
  WHERE guide_usuario.usuario_id = ${user.id}
  `.execute(db)

  console.log("OJO guidesUsuario=", guidesUsuario)
  const pointsGuidesCourse: CourseData = {}
  const earnedCourse: CourseData = {}
  const amountGuidesCourse: CourseData = {}

  for (const guideUsuario of guidesUsuario.rows) {
    console.log("  OJO guideUsuario=", guideUsuario)
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
    console.log("  OJO courseId=", currentCourseId)
    const userCourse = (await db
    .selectFrom('course_usuario')
    .where('usuario_id', '=', user.id)
    .where('proyectofinanciero_id', '=', currentCourseId)
    .selectAll()
    .execute()) || []
    console.log(" OJO userCourse=", userCourse)
    if (userCourse.length == 0) {
      const cp: Insertable<CourseUsuario> = {
        usuario_id: user.id,
        proyectofinanciero_id: currentCourseId,
        points: 0,
        guidespoints: 0,
        amountscholarship: 0,
        percentagecompleted: 0,
      }
      const icp = await db
      .insertInto('course_usuario')
      .values(cp)
      .returningAll()
      .executeTakeFirstOrThrow()
      console.log('After insert icp=', icp)
    }
    const courseGuidesCountResult = await db
    .selectFrom('cor1440_gen_actividadpf')
    .where('proyectofinanciero_id', '=', currentCourseId)
    .select(db.fn.countAll().as('count'))
    .executeTakeFirst()
    const totalGuidesInCourse = Number(courseGuidesCountResult?.count) || 0
    console.log("  OJO totalGuidesInCourse=", totalGuidesInCourse)
    const percentd = totalGuidesInCourse > 0 ? 
      ((amountGuidesCourse[currentCourseId] || 0) / totalGuidesInCourse) * 100 : 0
    console.log("  OJO percentd=", percentd)

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


  // 3. Calculate global Learning Score
  const totalGuidePointsResult = await db
  .selectFrom('guide_usuario')
  .where('usuario_id', '=', user.id)
  .select(db.fn.sum('points').as('total_points'))
  .executeTakeFirst()
  const totalGuidePoints = Number(totalGuidePointsResult?.total_points) || 0
  console.log("OJO totalGuidePoints=", totalGuidePoints)

  const totalCoursePointsResult = await db
  .selectFrom('course_usuario')
  .where('usuario_id', '=', user.id)
  .select(db.fn.sum('points').as('total_points'))
  .executeTakeFirst()
  const totalCoursePoints = Number(totalCoursePointsResult?.total_points) || 0
  console.log("OJO totalCoursePoints=", totalCoursePoints)

  const learningscore = totalGuidePoints + totalCoursePoints
  console.log("OJO learningscore=", learningscore)

  // 4. Update the main usuario table
  const uUsuario: Updateable<Usuario> = {
    learningscore: learningscore,
    updated_at: new Date(),
  }

  await db
  .updateTable('usuario')
  .set(uUsuario)
  .where('id', '=', user.id).execute()

  return learningscore
}
