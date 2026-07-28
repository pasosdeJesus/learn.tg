#!/usr/bin/env node
// Recalculate profile score for all users.
// Usage: cd apps/nextjs && node bin/recalc-all-scores.mjs

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load env from apps/.env
function loadEnv() {
  try {
    const envPath = join(__dirname, '..', '..', '.env')
    const content = readFileSync(envPath, 'utf8')
    for (const line of content.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1')
      }
    }
  } catch { /* .env not found, use process.env */ }
}
loadEnv()

const pool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || process.env.PGUSER || 'postgres',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
})

const client = await pool.connect()
console.log('Connected. Recalculating profile scores...\n')

// Get all active users
const { rows: users } = await client.query(
  `SELECT id, nusuario, profilescore FROM usuario WHERE fechadeshabilitacion IS NULL ORDER BY id`
)

let updated = 0
for (const u of users) {
  // Calculate score using the same formula as recalculateProfileScore
  const { rows: [user] } = await client.query(
    `SELECT nombre, passport_name, pais_id, passport_nationality,
            email, verified_email, whatsapp, telegram,
            verified_whatsapp, verified_telegram, lastgooddollarverification,
            department_id, municipality_id, city_id,
            verified_department_id, verified_municipality_id, verified_city_id,
            place_of_worship, verified_place_of_worship,
            proposed_date_of_interview
     FROM usuario WHERE id = $1`, [u.id]
  )

  if (!user) continue

  let score = 0

  // Name verified: 26 pts
  if (user.nombre && user.passport_name && user.nombre === user.passport_name) score += 26
  // Country verified: 24 pts
  if (user.pais_id != null && user.passport_nationality != null && user.pais_id === user.passport_nationality) score += 24
  // Email verified: 9 pts
  if (user.email && user.verified_email && user.email === user.verified_email) score += 9
  // WhatsApp or Telegram verified: 9 pts
  if ((user.whatsapp && user.verified_whatsapp && user.whatsapp === user.verified_whatsapp) ||
      (user.telegram && user.verified_telegram && user.telegram === user.verified_telegram)) score += 9
  // GoodDollar verified: 7 pts
  if (user.lastgooddollarverification != null) score += 7
  // Location verified: 9 pts
  if (user.department_id != null &&
      user.verified_department_id != null && user.verified_department_id == user.department_id &&
      user.verified_municipality_id != null && user.verified_municipality_id == user.municipality_id &&
      user.verified_city_id != null && user.verified_city_id == user.city_id) score += 9
  // Place of worship verified: 9 pts
  if (user.place_of_worship && user.verified_place_of_worship && user.place_of_worship === user.verified_place_of_worship) score += 9
  // Interview: 7 pts
  if (user.proposed_date_of_interview != null) score += 7

  const changed = (u.profilescore ?? 0) !== score
  if (changed) {
    await client.query('UPDATE usuario SET profilescore = $1, updated_at = NOW() WHERE id = $2', [score, u.id])
    updated++
  }

  const marker = changed ? ' ✨' : ''
  console.log(`  ${u.nusuario || u.id}: ${u.profilescore ?? 'null'} → ${score}${marker}`)
}

client.release()
await pool.end()
console.log(`\nDone. ${updated}/${users.length} users had score changes.`)
process.exit(0)
