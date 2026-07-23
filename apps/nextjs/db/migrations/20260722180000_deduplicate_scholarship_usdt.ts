import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Fetch mapping: actividadpf_id → (courseId, guideNum)
  const guides = await sql`
    SELECT id, "proyectofinanciero_id" as course_id,
      regexp_replace("sufijoRuta", '[^0-9]', '', 'g')::int as guide_num
    FROM cor1440_gen_actividadpf
    WHERE "sufijoRuta" IS NOT NULL AND "sufijoRuta" != ''
  `.execute(db)
  const guideMap = new Map<number, { courseId: number; guideNum: number }>()
  for (const g of guides.rows as any[]) {
    guideMap.set(g.id, { courseId: g.course_id, guideNum: g.guide_num })
  }

  // Cache all sync entries for lookup
  const syncEntries = await sql`
    SELECT id, usuario_id, hash,
      metadata->>'courseId' as course_id,
      metadata->>'guideNum' as guide_num
    FROM transaction
    WHERE type = 'scholarship' AND crypto = 'usdt'
      AND metadata->>'source' = 'sync' AND hash IS NOT NULL
      AND metadata->>'courseId' ~ '^[0-9]+$'
      AND metadata->>'guideNum' ~ '^[0-9]+$'
  `.execute(db)

  // Build lookup: (usuario_id, course_id, guide_num) → sync_id
  const syncLookup = new Map<string, number>()
  for (const s of syncEntries.rows as any[]) {
    const key = `${s.usuario_id}:${s.course_id}:${s.guide_num}`
    syncLookup.set(key, s.id)
  }

  // Find and process deep-scan entries
  const deepEntries = await sql`
    SELECT id, usuario_id,
      metadata->>'courseId' as course_id,
      metadata->>'guideId' as guide_id
    FROM transaction
    WHERE type = 'scholarship' AND crypto = 'usdt'
      AND metadata->>'source' = 'deep-scan'
      AND metadata->>'courseId' ~ '^[0-9]+$'
      AND metadata->>'guideId' ~ '^[0-9]+$'
  `.execute(db)

  let deleted = 0
  let updated = 0

  for (const d of deepEntries.rows as any[]) {
    const gInfo = guideMap.get(parseInt(d.guide_id))
    if (!gInfo) continue

    const key = `${d.usuario_id}:${gInfo.courseId}:${gInfo.guideNum}`
    const syncId = syncLookup.get(key)

    if (syncId) {
      const guideIdInt = parseInt(d.guide_id)
      await sql`DELETE FROM transaction WHERE id = ${d.id}`.execute(db)
      deleted++

      await db.updateTable('transaction')
        .set({
          metadata: sql`jsonb_set(jsonb_set(metadata, '{guideId}', to_jsonb(${guideIdInt}::int)), '{source}', '"synced"')`,
          updated_at: new Date(),
        } as any)
        .where('id', '=', syncId)
        .execute()
      updated++
    }
  }

  console.log(`Deleted ${deleted} deep-scan duplicates, updated ${updated} sync metadata`)
}

export async function down(_db: Kysely<any>): Promise<void> {}
