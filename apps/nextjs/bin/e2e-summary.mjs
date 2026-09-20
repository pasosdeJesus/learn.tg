#!/usr/bin/env node
// e2e-summary — resume el resultado por spec de uno o varios logs de la suite
// E2E y los compara lado a lado (por ejemplo: dev site vs servidor local).
//
// Uso:
//   node bin/e2e-summary.mjs /tmp/e2e-retry-site2.log
//   node bin/e2e-summary.mjs /tmp/e2e-retry-site2.log /tmp/e2e-local.log
//
// Estados: ok (pasó), FALLA (el runner imprimió "✗ … falló"), SKIP (el spec se
// salta solo), ? (arrancó y no dejó resumen — revisar el log). La comparación
// solo usa el nombre del spec, así que sirve aunque las corridas tengan
// distinto número de specs.

import * as fs from 'node:fs'

function parseLog(file) {
  const text = fs.readFileSync(file, 'utf8')
  const status = new Map()
  let current = null
  let saw = { fail: false, ok: false, skip: false }
  const closeBlock = () => {
    if (!current) return
    // El ✗ (el runner vio exit != 0) gana sobre un ✅ del mismo bloque: en un
    // mismo spec pueden verse ambos.
    if (saw.fail) status.set(current, 'FALLA')
    else if (saw.ok) status.set(current, 'ok')
    else if (saw.skip) status.set(current, 'SKIP')
    else status.set(current, '?')
  }
  for (const line of text.split('\n')) {
    // Sin anclar al inicio: los reintentos del harness imprimen
    // "[e2e-retry] ▶ specs/<spec>.spec.mjs (intento N)" y su resultado es el
    // que vale (sobrescribe el de la primera pasada).
    const start = line.match(/▶\s+specs\/(\S+\.spec\.mjs)/)
    if (start) {
      closeBlock()
      current = start[1]
      saw = { fail: false, ok: false, skip: false }
      continue
    }
    if (!current) continue
    if (/✗\s+\S+\.spec\.mjs\s+falló/.test(line)) saw.fail = true
    else if (/❌\s+[1-9]\d*\s+failures/.test(line)) saw.fail = true
    else if (saw.ok || saw.fail) continue
    else if (/✅\s+0 failures/.test(line)) saw.ok = true
    else if (/\[SKIP\]/.test(line)) saw.skip = true
  }
  closeBlock()
  return status
}

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('uso: node bin/e2e-summary.mjs <log> [log…]')
  process.exit(2)
}

const logs = files.map((f) => ({ file: f, status: parseLog(f) }))
const names = [...new Set(logs.flatMap((l) => [...l.status.keys()]))].sort()

const width = Math.max(28, ...names.map((n) => n.length))
const header = ['spec'.padEnd(width), ...logs.map((l) => l.file.replace(/^.*\//, '').slice(0, 14).padEnd(14))].join(' ')
console.log(header)
console.log('-'.repeat(header.length))
let diffs = 0
for (const name of names) {
  const cells = logs.map((l) => (l.status.get(name) || '-').padEnd(14))
  const unique = new Set(logs.map((l) => l.status.get(name) || '-'))
  const mark = unique.size > 1 ? '  <-- difiere' : ''
  if (mark) diffs += 1
  console.log(`${name.padEnd(width)} ${cells.join(' ')}${mark}`)
}
console.log(`\n${names.length} spec(s); ${diffs} con estado distinto entre corridas.`)
for (const l of logs) {
  const fails = [...l.status].filter(([, v]) => v === 'FALLA').map(([k]) => k)
  console.log(`${l.file}: ${fails.length} FALLA${fails.length ? ` (${fails.join(', ')})` : ''}`)
}
