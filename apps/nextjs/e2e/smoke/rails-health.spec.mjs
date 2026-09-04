#!/usr/bin/env node

/**
 * Smoke test: ¿está arriba el backend Rails del sitio de desarrollo?
 *
 * Hace un GET sin autenticar a
 *   {NEXT_PUBLIC_API_BASE}/proyectosfinancieros.json?filtro[busidioma]=en
 * (por defecto https://learn.tg:3500/learntg-admin/...).
 * - HTTP 200 con lista JSON de cursos → [UP]
 * - Cualquier otra respuesta o error de red/timeout/502 (nginx sin upstream)
 *   → [DOWN] y exit 1.
 *
 * Uso:
 *   bin/m test:e2e --smoke rails-health
 *   node e2e/smoke/rails-health.spec.mjs
 */

import 'dotenv/config'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const BASE = (process.env.NEXT_PUBLIC_API_BASE || 'https://learn.tg:3500/learntg-admin').replace(/\/+$/, '')
const URL = `${BASE}/proyectosfinancieros.json?filtro[busidioma]=en`
const TIMEOUT_MS = Number(process.env.RAILS_HEALTH_TIMEOUT_MS || '15000')

let failed = 0
function fail(msg) { failed++; console.log(`  [FAIL] ${msg}`) }

async function main() {
  console.log(`Smoke: Rails backend health — ${BASE}\n`)
  const t0 = Date.now()
  try {
    const res = await fetch(URL, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    const body = await res.text()
    const ms = Date.now() - t0
    if (res.status === 200) {
      let courses = 0
      try { courses = Array.isArray(JSON.parse(body)) ? JSON.parse(body).length : 0 } catch { /* no JSON */ }
      if (courses > 0) {
        console.log(`  [UP] Rails responde 200 con ${courses} cursos (${ms}ms)`)
      } else {
        console.log(`  [UP] Rails responde 200 (${ms}ms) — respuesta sin lista de cursos (${body.slice(0, 60)})`)
      }
      console.log(`  URL: ${URL}`)
    } else {
      fail(`Rails responde ${res.status} (${ms}ms) — puede estar caído o detrás de un 502`)
      console.log(`  Respuesta: ${body.slice(0, 160)}`)
    }
  } catch (e) {
    fail(`Rails NO responde: ${e.name}: ${e.message.slice(0, 120)}`)
  }
  console.log(`\n${failed === 0 ? 'Rails backend UP' : 'Rails backend DOWN'} (${failed} failed)`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1) })
