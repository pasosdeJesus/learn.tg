#!/usr/bin/env node
// Audit script: checks all API route handlers for authentication.
// Usage: node bin/audit-api-auth.mjs
// Rules and how to fix findings: doc/api-security.md (repo root)

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const API_DIR = join(__dirname, '..', 'app', 'api')

// Patterns that indicate a route handler requires ADMIN (verifier) auth,
// not just any logged-in user. 'authenticateAdmin' es el patrón canónico; los
// endpoints que exponen un campo extra solo a admin (públicos pero con dato
// admin-only, p. ej. referral/lookup con `nombre`) también lo usan.
const ADMIN_AUTH_PATTERNS = [
  'authenticateAdmin',
]
// Patterns that indicate a route handler has authentication
const AUTH_PATTERNS = [
  'authenticateUser',
  'authenticateAdmin',
  'isVerifier',
  'getVerifierError',
  'recoverAddress',    // ECDSA signature verification (e.g., /api/verify)
  'verifySignature',   // generic signature check
  'verifyMessage',     // message signature verification
  'SelfBackendVerifier', // ZK proof verification (e.g., /api/self-verify)
]

// Patterns that indicate a route handler accesses sensitive data
const DB_PATTERNS = [
  'newKyselyPostgresql',
  'Kysely',
  '.selectFrom',
  '.insertInto',
  '.updateTable',
  '.deleteFrom',
]

// Patterns that indicate file access that should be authenticated
const FILE_PATTERNS = [
  'readFile(',
  'readdir(',
  'writeFile(',
  'unlink(',
  'createReadStream(',
]

// Known public endpoints (no auth needed)
const PUBLIC_ENDPOINTS = [
  'countries',
  'religions',
  'towns',
  'towns/search',
  'departments',
  'municipalities',
  'credential',           // public credential verification
  'metrics/health',
  'ubi-report',
  'ubi-report-wallet',
  'user-transactions',    // public blockchain transactions
  'verification/availability', // public time slots
  'user/[id]',            // perfil público de solo lectura (no expone nombre real)
  'referral/lookup',      // landing pública /[lang]/ref/{CODE}: resuelve código de
                          // referido (solo nusuario/nombre, sin la billetera)
]

// Advisory: endpoints NO admin-only que seleccionan el `nombre` real de un
// usuario (usuario.nombre / u.nombre). No falla la corrida: es un aviso para
// revisar que no se exponga el nombre de terceros. Entradas permitidas con su
// motivo (self-data, admin-field, o no expuesto en la respuesta).
const NOMBRE_ADVISORY_ALLOW = {
  'profile': 'datos propios del usuario autenticado',
  'user/[id]': 'selecciona nombre pero la respuesta usa name=nusuario (no lo expone)',
  'referral/lookup': 'el campo nombre solo se devuelve a admin (wallet+token explícitos)',
  'self-verify': 'nombre del propio credential ZK verificado',
  'user/verified-data': 'devuelve pseudónimo, no el nombre real',
  'verify': 'respuesta sin nombre (name=passport_name solo a partners autorizados)',
  'verification/book': 'usa el nombre propio del autenticado para el evento CalDAV (solo admins lo ven); la respuesta no lo incluye',
}
// 'nombre' real de usuario: usuario.nombre / u.nombre o 'nombre' en un select
// (para Kysely/raw). Combinado con que el archivo mencione la tabla usuario
// para no marcar nombres de lugares (municipios, departamentos, towns…).
const NOMBRE_SELECT_PATTERN = /(?:usuario|u)\.nombre|['"]nombre['"]/

function hasPersonalNameSelect(content) {
  return content.includes('usuario') && NOMBRE_SELECT_PATTERN.test(content)
}

// Endpoints públicos que además exponen UN CAMPO solo a admin (p. ej. el
// `nombre` de referral/lookup). Anotación por endpoint para que el audit no
// suene contradictorio: el endpoint es público, el campo marcado no.
const PUBLIC_ADMIN_DATA_NOTES = {
  'referral/lookup': '`nusuario` es público; el campo `nombre` solo se devuelve a admin',
}

function findRouteFiles(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...findRouteFiles(full))
    } else if (entry.name === 'route.ts' || entry.name === 'route.tsx') {
      files.push(full)
    }
  }
  return files
}

function classifyEndpoint(filePath) {
  const rel = filePath.replace(API_DIR + '/', '').replace('/route.ts', '').replace('/route.tsx', '')
  return rel
}

function hasAuth(content) {
  return AUTH_PATTERNS.some(p => content.includes(p))
}

function hasAdminAuth(content) {
  return ADMIN_AUTH_PATTERNS.some(p => content.includes(p))
}

function hasDb(content) {
  return DB_PATTERNS.some(p => content.includes(p))
}

function hasFileAccess(content) {
  return FILE_PATTERNS.some(p => content.includes(p))
}

function isPublic(relPath) {
  return PUBLIC_ENDPOINTS.some(p => {
    if (relPath === p) return true
    // Prefix match: 'church' should match 'church' and 'church/xxx'
    if (relPath.startsWith(p + '/') || relPath.startsWith(p + '[')) return true
    return relPath === p
  })
}

function main() {
  const routeFiles = findRouteFiles(API_DIR)
  const publics = []
  const adminOnly = []
  const authenticated = []
  const issues = []
  const advisories = []
  // Endpoints públicos que además usan chequeo de admin (dato admin-only)
  const publicWithAdminData = []

  for (const file of routeFiles) {
    const rel = classifyEndpoint(file)
    const content = readFileSync(file, 'utf8')
    const usesDb = hasDb(content)
    const usesAuth = hasAuth(content)
    const usesAdmin = hasAdminAuth(content)
    const isPublicEp = isPublic(rel)

    if (file.includes('__tests__')) continue
    const sensitive = usesDb || hasFileAccess(content)
    if (!sensitive) continue

    if (isPublicEp) {
      publics.push(rel)
      if (usesAdmin) publicWithAdminData.push(rel)
    } else if (usesAuth) {
      if (usesAdmin) adminOnly.push(rel)
      else authenticated.push(rel)
    } else {
      issues.push(rel)
    }

    // Advisory (no falla): endpoints no-admin-only que seleccionan el nombre
    // real de un usuario — revisar que la respuesta no lo exponga.
    const kind = isPublicEp ? 'public' : (usesAuth ? (usesAdmin ? 'admin' : 'user') : 'none')
    if ((kind === 'public' || kind === 'user') && hasPersonalNameSelect(content)) advisories.push(rel)
  }

  // Show publics first (annotating admin-only fields)
  for (const rel of publics) {
    const note = PUBLIC_ADMIN_DATA_NOTES[rel] || (publicWithAdminData.includes(rel) ? 'parte de sus datos es admin-only' : '')
    console.log(`  ✅ ${rel} (public)${note ? ` — ${note}` : ''}`)
  }
  // Then admin-only endpoints
  for (const rel of adminOnly) {
    console.log(`  🔒 ${rel} (admin-only)`)
  }
  // Then authenticated
  for (const rel of authenticated) {
    console.log(`  ✅ ${rel} (authenticated)`)
  }
  // Then failures
  for (const rel of issues) {
    console.log(`  ❌ ${rel} — DATABASE ACCESS WITHOUT AUTH`)
  }

  // Advisory de `nombre` (no admin-only)
  if (advisories.length > 0) {
    console.log('')
    for (const rel of advisories) {
      const reason = NOMBRE_ADVISORY_ALLOW[rel]
      if (reason) console.log(`  ℹ️  ${rel} — selecciona nombre: ${reason}`)
      else console.log(`  ⚠️  ${rel} — selecciona el nombre real de un usuario; revisa que la respuesta no lo exponga`)
    }
  }

  const passed = publics.length + authenticated.length + adminOnly.length
  const failed = issues.length
  console.log(`\n${passed} passed / ${failed} failed (public: ${publics.length}, admin-only: ${adminOnly.length}, authenticated: ${authenticated.length})${advisories.length ? ` — advisories nombre: ${advisories.length}` : ''}`)

  if (failed > 0) {
    console.log('\nEndpoints needing auth:')
    issues.forEach(e => console.log(`  - /${e}`))
    process.exit(1)
  }
}

main()
