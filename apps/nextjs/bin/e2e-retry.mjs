#!/usr/bin/env node
// test-e2e-retry — corre la suite E2E completa y reintenta los specs que fallen.
//
// Por qué: contra el dev site los fallos son casi siempre de carga/timing (la
// misma spec pasa al correrla sola), no de producto. Reintentar cada fallo por
// separado estabiliza el resultado. Ver `doc/e2e-testing.md`.
//
// La salida se transmite en vivo (stream) además de guardarse en el log, para
// poder seguir una corrida larga.
//
// Uso:
//   cd apps/nextjs
//   IPDES=learn.tg PUERTOPRU=9001 CHAIN_ID=11142220 node bin/e2e-retry.mjs
//   E2E_RETRIES=3 make test-e2e-retry
//
// Variables: `E2E_RETRIES` (reintentos por spec, por defecto 2), `E2E_LOG_DIR`
// (por defecto /tmp).

import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

const cwd = process.cwd()
const binM = path.join(cwd, 'bin', 'm')
const retries = Math.max(0, parseInt(process.env.E2E_RETRIES || '2', 10))
const logDir = process.env.E2E_LOG_DIR || '/tmp'

function runE2e(pattern, logFile) {
  const args = pattern ? [binM, 'test:e2e', pattern] : [binM, 'test:e2e']
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd, env: process.env })
    let out = ''
    let log = null
    try {
      log = fs.createWriteStream(logFile)
    } catch {
      // El log es best-effort: no debe tumbar la corrida.
    }
    const onData = (chunk) => {
      const text = chunk.toString()
      out += text
      process.stdout.write(text)
      log?.write(text)
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('error', reject)
    child.on('close', (code) => {
      log?.end()
      resolve({ status: code ?? 1, out })
    })
  })
}

/** Specs que el runner reportó como fallidos (una vez cada uno). */
function failedSpecs(out) {
  const found = new Set()
  const re = /✗\s+(\S+\.spec\.mjs)\s+falló/g
  let match
  while ((match = re.exec(out))) found.add(match[1])
  return [...found]
}

async function main() {
  const { out } = await runE2e(null, path.join(logDir, 'e2e-retry-pass1.log'))
  let pending = failedSpecs(out)
  console.log(`\n[e2e-retry] Primera pasada: ${pending.length} spec(s) fallaron.`)

  for (let attempt = 1; attempt <= retries && pending.length > 0; attempt += 1) {
    console.log(
      `\n[e2e-retry] Reintento ${attempt}/${retries} de ${pending.length} spec(s): ${pending.join(', ')}`,
    )
    const still = []
    for (const spec of pending) {
      const name = spec.replace(/\.spec\.mjs$/, '')
      console.log(`\n[e2e-retry] ▶ ${spec} (intento ${attempt})`)
      const res = await runE2e(
        name,
        path.join(logDir, `e2e-retry-${name}-intento${attempt}.log`),
      )
      if (res.status !== 0) still.push(spec)
    }
    pending = still
  }

  if (pending.length > 0) {
    console.log(`\n[e2e-retry] Siguen fallando tras ${retries} reintento(s): ${pending.join(', ')}`)
    process.exit(1)
  }
  console.log('\n[e2e-retry] Suite E2E verde (o sin fallos tras reintentos).')
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
