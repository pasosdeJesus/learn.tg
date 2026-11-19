#!/usr/bin/env node
// E2E de los diagramas de las guías (R-#297 §4.3): cada bloque ` ```mermaid ` de
// `resources/` se convierte en un `<img>` hacia `/img/diagrams/<hash>.svg`, y ese SVG tiene
// que estar **desplegado**. Si la guía viaja sin su imagen, la página muestra un hueco y
// nada falla en el build: este spec lo detecta sin sesión y en segundos.
//
// El repositorio ya impide que se olvide el SVG en la máquina de quien edita
// (`guides-consistency.test.ts` falla si no está generado); esto comprueba lo otro: que el
// servidor que se está probando lo esté sirviendo.
//
// Ejecución:
//   make test-e2e-spec SPEC=guide-diagrams
//   SITE_URL=https://learn.tg:9001 node e2e/specs/guide-diagrams.spec.mjs

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fail, ok, resetFailures, summary } from '@pasosdejesus/m/e2e'
import { diagramUrl, extractMermaidDiagrams } from '../../lib/remarkMermaid.mjs'

const BASE = (process.env.SITE_URL || `https://${process.env.IPDES || 'learn.tg'}:${process.env.PUERTOPRU || '9001'}`)
  .replace(/\/$/, '')
const RESOURCES = join(process.cwd(), '..', '..', 'resources')

/** Guías (`*.md`) de todos los cursos, con su ruta relativa. */
function guideFiles(dir = RESOURCES, prefix = '') {
  const found = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      found.push(...guideFiles(join(dir, entry.name), relative))
    } else if (entry.name.endsWith('.md')) {
      found.push({ relative, path: join(dir, entry.name) })
    }
  }
  return found.sort((a, b) => a.relative.localeCompare(b.relative))
}

async function main() {
  const t0 = performance.now()
  resetFailures()
  console.log(`Diagramas de las guías | ${BASE}`)

  const diagrams = []
  for (const file of guideFiles()) {
    const markdown = readFileSync(file.path, 'utf8')
    for (const diagram of extractMermaidDiagrams(markdown)) {
      diagrams.push({ ...diagram, file: file.relative })
    }
  }
  if (diagrams.length === 0) {
    fail('no se encontró ningún bloque ```mermaid en resources/')
    summary(t0)
    process.exit(1)
  }
  ok(`${diagrams.length} diagramas en ${new Set(diagrams.map((d) => d.file)).size} guía(s)`)

  const missing = []
  for (const diagram of diagrams) {
    const url = diagramUrl(diagram.source)
    let response
    try {
      response = await fetch(`${BASE}${url}`, { headers: { 'user-agent': 'e2e-guide-diagrams' } })
    } catch (error) {
      missing.push(`${diagram.file}: ${url} (${error instanceof Error ? error.message : String(error)})`)
      continue
    }
    const type = response.headers.get('content-type') || ''
    const body = await response.text()
    const isSvg = body.trimStart().startsWith('<svg') && type.includes('svg')
    if (response.status !== 200 || !isSvg) {
      // El sitio responde 200 con su HTML a las rutas desconocidas: sin mirar el cuerpo,
      // un soft 404 pasaría como bueno.
      missing.push(`${diagram.file}: ${url} → ${response.status} ${type || 'sin content-type'}`)
      continue
    }
    if (!body.includes('<text')) {
      missing.push(`${diagram.file}: ${url} sin texto (¿SVG vacío?)`)
    }
  }

  if (missing.length === 0) {
    ok(`los ${diagrams.length} SVG se sirven como image/svg+xml`)
  } else {
    for (const problem of missing) fail(problem)
  }

  const seconds = ((performance.now() - t0) / 1000).toFixed(1)
  console.log(`\nDuración: ${seconds}s`)
  const failures = summary(t0)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
