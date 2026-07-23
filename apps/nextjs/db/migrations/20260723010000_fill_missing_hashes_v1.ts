// Migration: Fill missing hashes from updated CSV (now includes V1).
// Reads doc/hashes-2026-07-23.csv and updates scholarship entries
// that have NULL hash with real blockchain hash + timestamp.

import { Kysely } from 'kysely'
import * as fs from 'fs'
import * as path from 'path'
import { Pool } from 'pg'

export async function up(_db: Kysely<any>): Promise<void> {
  const csvPath = path.resolve(process.cwd(), '..', '..', 'doc', 'hashes-2026-07-23.csv')
  if (!fs.existsSync(csvPath)) {
    console.log('CSV not found at ' + csvPath + ' — skipping')
    return
  }

  const content = fs.readFileSync(csvPath, 'utf8')
  const lines = content.trim().split('\n')

  // Build map: (usuario_id, course_id, guide_id) -> { hash, timestamp }
  const bcMap = new Map<string, { hash: string; timestamp: string }>()
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',')
    if (c.length < 12 || !c[1] || c[7] !== 'true' || c[9] !== 'success' || !c[10]) continue
    const key = c[1] + ':' + c[3] + ':' + (c[4] || c[5])
    if (!bcMap.has(key)) bcMap.set(key, { hash: c[10], timestamp: c[11] })
  }
  console.log('Loaded ' + bcMap.size + ' blockchain records from CSV')

  const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432'),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
  })

  const { rows } = await pool.query(
    "SELECT id, usuario_id, metadata FROM transaction WHERE type = 'scholarship' AND crypto = 'usdt' AND hash IS NULL"
  )

  let filled = 0
  for (const r of rows) {
    const m = r.metadata
    if (!m?.courseId || !m?.guideId) continue
    const key = r.usuario_id + ':' + m.courseId + ':' + m.guideId
    const bc = bcMap.get(key)
    if (!bc) continue

    await pool.query(
      "UPDATE transaction SET hash = $1, date = $2::timestamptz, metadata = metadata || '{\"source\":\"blockchain\"}'::jsonb, updated_at = NOW() WHERE id = $3",
      [bc.hash, bc.timestamp, r.id]
    )
    filled++
  }

  await pool.end()
  console.log('Filled hashes for ' + filled + ' entries')
}

export async function down(_db: Kysely<any>): Promise<void> {}
