#!/usr/bin/env node

/**
 * Smoke test: la guía de migración (R-#270) se sirve como página pública.
 *
 * Es el enlace que se comparte por WhatsApp, así que debe abrir **sin sesión** y en
 * el idioma de su ruta. Hace un GET sin autenticar a:
 *   {SITE}/en/migration-in-app-wallet   (inglés)
 *   {SITE}/es/migracion-billetera-app   (español)
 * y comprueba 200 + el título de cada idioma.
 *
 * Uso:
 *   make test-smoke                        # contra el sitio de desarrollo
 *   SITE_URL=http://localhost:4000 node e2e/smoke/migration-guide.spec.mjs
 */

import 'dotenv/config'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const BASE = (
  process.env.SITE_URL ||
  `https://${process.env.IPDES || 'learn.tg'}:${process.env.PUERTOPRU || '9001'}`
).replace(/\/+$/, '')
const TIMEOUT_MS = Number(process.env.MIGRATION_SMOKE_TIMEOUT_MS || '15000')

const CASES = [
  { path: '/en/migration-in-app-wallet', expected: /Move your wallet into learn\.tg/i },
  { path: '/es/migracion-billetera-app', expected: /Pasa tu billetera a learn\.tg/i },
]

let failed = 0
function fail(msg) { failed++; console.log(`  [FAIL] ${msg}`) }

async function main() {
  console.log(`Smoke: guía de migración — ${BASE}\n`)

  for (const { path, expected } of CASES) {
    const url = `${BASE}${path}`
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
      const body = await res.text()
      if (res.status !== 200) {
        fail(`${path} responde ${res.status} sin sesión`)
        continue
      }
      if (!expected.test(body)) {
        fail(`${path} responde 200 pero no trae su título (¿guía equivocada o idioma cruzado?)`)
        continue
      }
      console.log(`  [OK] ${path} 200 sin sesión, con el texto esperado`)
    } catch (e) {
      fail(`${path} no responde: ${e.name}: ${e.message.slice(0, 120)}`)
    }
  }

  console.log(failed === 0 ? '\n[OK] guía de migración servida en ambos idiomas' : `\n[FAIL] ${failed} caso(s)`)
  process.exit(failed > 0 ? 1 : 0)
}

main()
