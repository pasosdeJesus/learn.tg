// Migration: Fix transaction dates from blockchain history CSV.
//
// Many transaction entries have incorrect dates (e.g. April 2026 instead
// of January 2026). This migration reads doc/hashes-2026-07-23.csv and
// corrects the date for every entry whose hash matches the blockchain.

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

  const hashToDate = new Map<string, string>()
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',')
    if (c.length < 12 || !c[10] || c[9] !== 'success' || !c[11]) continue
    hashToDate.set(c[10], c[11])
  }
  console.log('Loaded ' + hashToDate.size + ' timestamps from CSV')

  const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432'),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
  })

  let fixed = 0
  for (const [hash, timestamp] of hashToDate) {
    const { rowCount } = await pool.query(
      'UPDATE transaction SET date = $1::timestamptz, updated_at = NOW() WHERE hash = $2 AND type = $3 AND crypto = $4',
      [timestamp, hash, 'scholarship', 'usdt']
    )
    if (rowCount && rowCount > 0) fixed += rowCount
  }

  await pool.end()
  console.log('Fixed dates for ' + fixed + ' scholarship entries')
}

export async function down(_db: Kysely<any>): Promise<void> {}
