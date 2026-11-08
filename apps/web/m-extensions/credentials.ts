import { registerHook } from '@pasosdejesus/m/plugin'

// El metadato del credential (`credential_metadata`) debe quedar ligado a su curso y
// decir la verdad sobre el pago: `course_id` (para el atributo "Course ID" y el enlace
// al curso) e `is_premium` derivado de `porPagar`. Antes solo se guardaba `course_id`,
// así que un curso de pago salía con "Premium: false"
// (https://github.com/pasosdeJesus/learn.tg/issues/161 §12).
type CredentialDb = {
  selectFrom: (table: string) => any
  updateTable: (table: string) => any
}
type CredentialHookContext = {
  db: CredentialDb
  tokenId: number
  courseId?: number | null
}

async function linkCourse(db: CredentialDb, tokenId: number, courseId: number | null | undefined) {
  const id = Number(courseId)
  if (!id || id <= 0) return

  const course = await db
    .selectFrom('cor1440_gen_proyectofinanciero')
    .select(['porPagar'])
    .where('id', '=', id)
    .executeTakeFirst()

  await db
    .updateTable('credential_metadata')
    .set({
      course_id: id,
      is_premium: Number(course?.porPagar ?? 0) > 0,
      updated_at: new Date(),
    })
    .where('token_id', '=', tokenId)
    .execute()

  console.log(
    `[learn.tg] credential ${tokenId}: course_id=${id} is_premium=${Number(course?.porPagar ?? 0) > 0}`,
  )
}

registerHook('credentials:post-register-type', async (ctx: CredentialHookContext) => {
  await linkCourse(ctx.db, ctx.tokenId, ctx.courseId)
})

registerHook('credentials:post-sync-cache', async (ctx: CredentialHookContext) => {
  await linkCourse(ctx.db, ctx.tokenId, ctx.courseId)
})
