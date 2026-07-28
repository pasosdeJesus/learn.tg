#!/usr/bin/env node
// Audit script: checks all API route handlers for authentication.
// Usage: node bin/audit-api-auth.mjs

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const API_DIR = join(__dirname, '..', 'app', 'api')

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
]

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
  const authenticated = []
  const issues = []

  for (const file of routeFiles) {
    const rel = classifyEndpoint(file)
    const content = readFileSync(file, 'utf8')
    const usesDb = hasDb(content)
    const usesAuth = hasAuth(content)
    const isPublicEp = isPublic(rel)

    if (file.includes('__tests__')) continue
    const sensitive = usesDb || hasFileAccess(content)
    if (!sensitive) continue

    if (isPublicEp) {
      publics.push(rel)
    } else if (usesAuth) {
      authenticated.push(rel)
    } else {
      issues.push(rel)
    }
  }

  // Show publics first
  for (const rel of publics) {
    console.log(`  ✅ ${rel} (public)`)
  }
  // Then authenticated
  for (const rel of authenticated) {
    console.log(`  ✅ ${rel} (authenticated)`)
  }
  // Then failures
  for (const rel of issues) {
    console.log(`  ❌ ${rel} — DATABASE ACCESS WITHOUT AUTH`)
  }

  const passed = publics.length + authenticated.length
  const failed = issues.length
  console.log(`\n${passed} passed / ${failed} failed (public: ${publics.length}, authenticated: ${authenticated.length})`)

  if (failed > 0) {
    console.log('\nEndpoints needing auth:')
    issues.forEach(e => console.log(`  - /${e}`))
    process.exit(1)
  }
}

main()
