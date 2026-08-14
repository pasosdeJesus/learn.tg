import { registerHook } from '@pasosdejesus/m/plugin'

registerHook('credentials:post-register-type', async (ctx: any) => {
  const { tokenId, courseId, db } = ctx
  if (!courseId || courseId <= 0) return

  await db
    .updateTable('credential_metadata')
    .set({ course_id: courseId, updated_at: new Date() })
    .where('token_id', '=', tokenId)
    .execute()

  console.log(`[learn.tg] course_id=${courseId} saved for token ${tokenId}`)
})

registerHook('credentials:post-sync-cache', async (ctx: any) => {
  const { tokenId, courseId, db } = ctx
  if (!courseId || courseId <= 0) return

  await db
    .updateTable('credential_metadata')
    .set({ course_id: courseId, updated_at: new Date() })
    .where('token_id', '=', tokenId)
    .execute()
})
