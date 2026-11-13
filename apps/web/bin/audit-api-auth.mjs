#!/usr/bin/env node
// Audit script: checks all API route handlers for authentication.
// Usage: node bin/audit-api-auth.mjs
// Rules and how to fix findings: doc/api-security.md (repo root)

import { readFileSync, readdirSync } from 'fs'
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
  'verifySiweMessage', // SIWE (EIP-4361) verificado en el servidor: /api/wallet/accept
                       // autentica por la firma de la billetera invitada, no por sesión
  'SelfBackendVerifier', // ZK proof verification (e.g., /api/self-verify)
  'getToken(',         // sesión (R-#227/R-#233): JWT de la cookie NextAuth
                       // (la cookie es la única credencial; no hay token de API)
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
  'csp-report',           // R-#247: recolector de violaciones CSP; el navegador
                          // lo postea sin credenciales (doc/csp.md §5). No guarda PII.
  'countries',
  'religions',
  'towns',
  'towns/search',
  'departments',
  'municipalities',
  'course-catalog',       // R-#233 §4.4: catálogo público de cursos leído
                          // directo de la BD compartida (sin token ni CORS)
  'credential',           // public credential verification
  'donations',            // explorador público de donaciones (https://github.com/pasosdeJesus/learn.tg/issues/223): solo
                          // nusuario + monto/hash on-chain + comentario del
                          // donante; no expone nombre real ni metadata interna
  'metrics/health',
  'ubi-report',
  'ubi-report-wallet',
  'user-transactions',    // public blockchain transactions
  'verification/availability', // public time slots
  'user/[id]',            // perfil público de solo lectura (no expone nombre real)
  'referral/lookup',      // landing pública /[lang]/ref/{CODE}: resuelve código de
                          // referido (solo nusuario/nombre, sin la billetera)
  'directory/churches',   // R-#164: directorio público de iglesias (solo región tipo 1;
                          // la región tipo 2 nunca se publica). El reclamo
                          // (`/claim`) exige sesión igual.
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
  'wallet/link': 'usa el nombre propio del autenticado solo como `linked_by` del motor; la respuesta devuelve billeteras, nunca el nombre',
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

// Rutas de `app/api` con auth por método (el archivo mezcla `authenticateUser` y
// `authenticateAdmin`); la anotación aclara la clasificación gruesa del archivo.
const CORE_METHOD_NOTES = {
  'cluster/[id]/document': 'POST/DELETE: iniciador; GET: miembro/iniciador o admin',
}

// ── Rutas que delegan en un motor (`packages/*`) ─────────────────────────────
// Los `route.ts` de `app/api` son re-exports delgados de los motores:
//   return gdclusterApp['cluster/[id]/approval'].POST!(request, await params)
// Esos archivos no tocan la BD, así que el escaneo simple no los veía (el punto
// ciego de doc/api-security.md). Aquí se sigue el re-export hasta el handler del
// motor y se clasifica **por método** con la auth que usa el handler o sus
// ayudantes locales (grafo de llamadas dentro del archivo del motor).
const REPO_ROOT = join(__dirname, '..', '..', '..')
const ENGINE_ADAPTERS = {
  gdclusterApp: join(REPO_ROOT, 'packages', 'gdcluster'),
  rewardsApp: join(REPO_ROOT, 'packages', 'rewards'),
  mr519App: join(REPO_ROOT, 'packages', 'mr519'),
}

// Rutas de motor que son públicas a propósito (sin auth), con su motivo.
// Clave: '<MÉTODO> <motor>:<clave del registro>'.
const ENGINE_PUBLIC_ROUTES = {
  'GET rewards:check-crossword': 'GET no se usa: responde 400 "Expecting POST request"',
  'GET rewards:churches/fund': 'saldo público de la billetera de iglesias (bono de pastores)',
  'GET rewards:credential/[tokenId]': 'verificación pública de una credencial (SBT)',
  'GET rewards:credential/wallet/[wallet]': 'credenciales de una billetera, con el filtro de privacidad de R-#259',
  'GET rewards:referrals/fund': 'saldo público de la billetera de referidos',
  'GET rewards:slearn/metadata': 'metadatos públicos del token SLEARN',
  'GET rewards:ubi-report': 'reporte público de UBI (solo datos agregados)',
  'GET rewards:ubi-report-wallet': 'reporte público de UBI por billetera',
  'GET gdcluster:donations/[slug]/balance': 'transparencia pública de una campaña',
  'GET gdcluster:donations/[slug]/movements': 'transparencia pública de una campaña',
  'GET gdcluster:donations/[slug]/transparency': 'transparencia pública de una campaña',
  'GET gdcluster:gdcluster/ranking/clusters': 'ranking público de clústeres (solo región tipo 1)',
  'GET gdcluster:gdcluster/ranking/countries': 'ranking público de países',
  'GET gdcluster:gdcluster/ranking/funds': 'saldos públicos del ranking',
  'GET gdcluster:clusters': 'R-#299: listado público de clústeres por alias (slug, estado, iglesias y total recaudado; nunca el nombre interno, pastores ni billeteras)',
  'GET gdcluster:clusters/[slug]': 'R-#299: página pública de un clúster por alias, con el mismo criterio de privacidad',
}

const engineIndexCache = new Map()
const engineSourceCache = new Map()

function readEngineSource(engineDir, rel) {
  const key = join(engineDir, rel)
  if (!engineSourceCache.has(key)) {
    try {
      engineSourceCache.set(key, readFileSync(key, 'utf8'))
    } catch {
      engineSourceCache.set(key, null)
    }
  }
  return engineSourceCache.get(key)
}

/** key → método → { fn, file } a partir del registro de `src/index.ts`. */
function engineRegistry(engineDir) {
  if (engineIndexCache.has(engineDir)) return engineIndexCache.get(engineDir)
  const index = readEngineSource(engineDir, 'src/index.ts')
  const registry = new Map()
  if (index) {
    const imports = new Map()
    const importRe = /import\s*\{([\s\S]*?)\}\s*from\s*'\.\/routes\/([^']+)\.js'/g
    let m
    while ((m = importRe.exec(index))) {
      for (const raw of m[1].split(',')) {
        const name = raw.trim().split(/\s+as\s+/).pop().trim()
        if (name) imports.set(name, `src/routes/${m[2]}.ts`)
      }
    }
    const entryRe = /^    '([^']+)':\s*\{([\s\S]*?)\n    \}/gm
    while ((m = entryRe.exec(index))) {
      const methods = new Map()
      const methodRe = /^\s*(GET|POST|PUT|PATCH|DELETE):\s*\([^)]*\)\s*=>\s*(\w+)\(/gm
      let mm
      while ((mm = methodRe.exec(m[2]))) {
        methods.set(mm[1], { fn: mm[2], file: imports.get(mm[2]) || null })
      }
      registry.set(m[1], methods)
    }
  }
  engineIndexCache.set(engineDir, registry)
  return registry
}

/** Funciones locales del archivo del motor: nombre → cuerpo. */
function engineFunctions(source) {
  const fns = new Map()
  const re = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g
  let m
  while ((m = re.exec(source))) {
    const start = m.index
    const close = source.indexOf('\n}\n', start)
    fns.set(m[1], source.slice(start, close === -1 ? source.length : close + 3))
  }
  return fns
}

/** Clase de auth de un handler: 'admin' | 'user' | 'none' | 'unresolved'. */
function handlerAuth(source, fnName) {
  const fns = engineFunctions(source)
  const seen = new Set()
  const queue = [fnName]
  let body = ''
  while (queue.length) {
    const name = queue.shift()
    if (!name || seen.has(name)) continue
    seen.add(name)
    const text = fns.get(name)
    if (!text) continue
    body += text
    const callRe = /\b(\w+)\s*\(/g
    let m
    while ((m = callRe.exec(text))) {
      if (fns.has(m[1])) queue.push(m[1])
    }
  }
  if (!body) return 'unresolved'
  if (ADMIN_AUTH_PATTERNS.some((p) => body.includes(p)) || body.includes('requireAdmin')) return 'admin'
  if (AUTH_PATTERNS.some((p) => body.includes(p))) return 'user'
  return 'none'
}

/** Rutas de motor exportadas por un `route.ts` de `app/api`. */
function engineRoutesOf(filePath) {
  const content = readFileSync(filePath, 'utf8')
  const found = []
  const re = /(\w+App)\['([^']+)'\]\.(GET|POST|PUT|PATCH|DELETE)/g
  let m
  while ((m = re.exec(content))) {
    found.push({ adapter: m[1], key: m[2], method: m[3] })
  }
  const routes = []
  for (const hit of found) {
    const engineDir = ENGINE_ADAPTERS[hit.adapter]
    if (!engineDir) continue
    const engine = hit.adapter.replace(/App$/, '')
    const entry = engineRegistry(engineDir).get(hit.key)?.get(hit.method)
    if (!entry?.file) {
      routes.push({ engine, key: hit.key, method: hit.method, cls: 'unresolved' })
      continue
    }
    const source = readEngineSource(engineDir, entry.file)
    const cls = source ? handlerAuth(source, entry.fn) : 'unresolved'
    routes.push({ engine, key: hit.key, method: hit.method, cls })
  }
  return routes
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
  // Rutas delegadas a un motor
  const engineRoutes = []

  for (const file of routeFiles) {
    if (file.includes('__tests__')) continue
    const rel = classifyEndpoint(file)

    // Re-exports de motores: se clasifican por método siguiendo el handler.
    const delegated = engineRoutesOf(file)
    if (delegated.length > 0) {
      for (const route of delegated) engineRoutes.push({ ...route, rel })
      continue
    }

    const content = readFileSync(file, 'utf8')
    const usesDb = hasDb(content)
    const usesAuth = hasAuth(content)
    const usesAdmin = hasAdminAuth(content)
    const isPublicEp = isPublic(rel)

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
    const note = CORE_METHOD_NOTES[rel]
    console.log(`  🔒 ${rel} (admin-only)${note ? ` — ${note}` : ''}`)
  }
  // Then authenticated
  for (const rel of authenticated) {
    const note = CORE_METHOD_NOTES[rel]
    console.log(`  ✅ ${rel} (authenticated)${note ? ` — ${note}` : ''}`)
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

  // Rutas de motor (re-exports), clasificadas por método
  let engineFailed = 0
  let engineWarnings = 0
  if (engineRoutes.length > 0) console.log('')
  for (const route of engineRoutes) {
    const id = `${route.method} ${route.engine}:${route.key}`
    if (route.cls === 'admin') {
      console.log(`  🔒 ${route.rel} [${route.method}] (admin-only, engine ${route.engine})`)
    } else if (route.cls === 'user') {
      console.log(`  ✅ ${route.rel} [${route.method}] (authenticated, engine ${route.engine})`)
    } else if (route.cls === 'none') {
      if (ENGINE_PUBLIC_ROUTES[id]) {
        console.log(`  ✅ ${route.rel} [${route.method}] (public, engine ${route.engine}) — ${ENGINE_PUBLIC_ROUTES[id]}`)
      } else {
        console.log(`  ❌ ${route.rel} [${route.method}] (engine ${route.engine}) — ENGINE HANDLER WITHOUT AUTH`)
        engineFailed++
        issues.push(`${route.rel} [${route.method}]`)
      }
    } else {
      console.log(`  ⚠️  ${route.rel} [${route.method}] (engine ${route.engine}) — handler not resolved`)
      engineWarnings++
    }
  }

  const passed = publics.length + authenticated.length + adminOnly.length + engineRoutes.length - engineFailed - engineWarnings
  const failed = issues.length
  console.log(`\n${passed} passed / ${failed} failed (public: ${publics.length}, admin-only: ${adminOnly.length}, authenticated: ${authenticated.length}, engine: ${engineRoutes.length})${advisories.length ? ` — advisories nombre: ${advisories.length}` : ''}${engineWarnings ? ` — engine warnings: ${engineWarnings}` : ''}`)

  if (failed > 0) {
    console.log('\nEndpoints needing auth:')
    issues.forEach(e => console.log(`  - /${e}`))
    process.exit(1)
  }
}

main()
