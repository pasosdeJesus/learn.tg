#!/usr/bin/env node
// Genera SVG a partir de diagramas Mermaid (.mmd) sin navegador:
// `@speajus/mermaid-to-svg` renderiza con `mermaid` + `elkjs` + `react-dom/server` y
// mide el texto con jsdom, así que corre igual en OpenBSD/adJ que en Linux (probado
// 2026-11-15: flowchart 2.2 s, secuencia 29 ms).
//
// Uso:
//   node bin/mmd2svg.mjs diagrama.mmd                  # escribe diagrama.svg al lado
//   node bin/mmd2svg.mjs diagrama.mmd salida.svg       # archivo de salida explícito
//   node bin/mmd2svg.mjs diagramas/ --out public/img/   # todos los .mmd de la carpeta
//   node bin/mmd2svg.mjs --scan ../../resources --out public/img/diagrams
//   node bin/mmd2svg.mjs diagrama.mmd --theme dark
//
// Lo usan las guías: el diagrama se escribe dentro de la guía en un bloque
// ```mermaid y `--scan` lo busca en los .md y escribe el SVG con el nombre que el
// renderer espera (lib/remarkMermaid.mjs); también sirve para .mmd sueltos. El SVG
// es el artefacto que sirve el renderer y se cachea para leer sin conexión.
import { readFile, readdir, writeFile, mkdir, unlink } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { extractMermaidDiagrams } from '../lib/remarkMermaid.mjs'

const USAGE = `Uso:
  node bin/mmd2svg.mjs <entrada.mmd|carpeta> [salida.svg|carpeta] [--theme default|dark|forest|neutral] [--out <carpeta>]
  node bin/mmd2svg.mjs --scan <carpeta-con-.md> --out <carpeta-de-svg> [--theme ...] [--force]

  Sin salida escribe <nombre>.svg junto al .mmd.
  Con --out escribe <carpeta>/<nombre>.svg.
  Con --scan renderiza los bloques \`\`\`mermaid de cada .md bajo la carpeta (el
  nombre lo calcula el hash del diagrama, ver lib/remarkMermaid.mjs), omite los
  SVG que ya existen salvo con --force y borra los que ya no usa ninguna guía.`

function parseArgs(argv) {
  const options = { theme: 'default', out: null, scan: null, force: false, positional: [] }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      console.log(USAGE)
      process.exit(0)
    } else if (arg === '--theme') {
      options.theme = argv[++i]
    } else if (arg.startsWith('--theme=')) {
      options.theme = arg.slice('--theme='.length)
    } else if (arg === '--out') {
      options.out = argv[++i]
    } else if (arg.startsWith('--out=')) {
      options.out = arg.slice('--out='.length)
    } else if (arg === '--scan') {
      options.scan = argv[++i]
    } else if (arg.startsWith('--scan=')) {
      options.scan = arg.slice('--scan='.length)
    } else if (arg === '--force') {
      options.force = true
    } else {
      options.positional.push(arg)
    }
  }
  return options
}

const THEMES = ['default', 'dark', 'forest', 'neutral']

async function renderFile(renderMermaid, inputPath, outputPath, theme) {
  const source = await readFile(inputPath, 'utf8')
  if (!source.trim()) throw new Error('el archivo está vacío')
  const started = Date.now()
  const { svg, diagramType, bounds } = await renderMermaid(source, { theme })
  if (typeof svg !== 'string' || !svg.startsWith('<svg')) {
    throw new Error('el renderizador no devolvió un SVG')
  }
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${svg}\n`, 'utf8')
  const shape = bounds ? `, ${Math.round(bounds.width)}×${Math.round(bounds.height)} px` : ''
  console.log(
    `[OK] ${inputPath} → ${outputPath} (${diagramType}${shape}, ${svg.length} bytes, ${Date.now() - started} ms)`,
  )
}

async function markdownFiles(dir) {
  const found = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      found.push(...(await markdownFiles(path)))
    } else if (extname(entry.name) === '.md') {
      found.push(path)
    }
  }
  return found.sort()
}

async function exists(path) {
  try {
    await readFile(path)
    return true
  } catch {
    return false
  }
}

/**
 * Renderiza los bloques ```mermaid de los .md y deja en `outDir` sólo los SVG que
 * esas guías usan hoy (el nombre es el hash del diagrama, así que un diagrama
 * editado produce otro archivo y el anterior queda huérfano: se borra).
 */
async function scanMarkdown(renderMermaid, rootDir, outDir, theme, force) {
  const files = await markdownFiles(rootDir)
  const written = new Set()
  let rendered = 0
  let skipped = 0
  const failures = []

  for (const file of files) {
    const markdown = await readFile(file, 'utf8')
    for (const diagram of extractMermaidDiagrams(markdown)) {
      const outputPath = join(outDir, `${diagram.id}.svg`)
      written.add(outputPath)
      const where = `${relative(rootDir, file) || file}:${diagram.line}`
      if (!force && (await exists(outputPath))) {
        skipped++
        continue
      }
      const started = Date.now()
      try {
        const { svg, diagramType } = await renderMermaid(diagram.source, { theme })
        if (typeof svg !== 'string' || !svg.startsWith('<svg')) {
          throw new Error('el renderizador no devolvió un SVG')
        }
        await mkdir(outDir, { recursive: true })
        await writeFile(outputPath, `${svg}\n`, 'utf8')
        rendered++
        console.log(
          `[OK]   ${where} → ${relative(process.cwd(), outputPath)} (${diagramType}, ${Date.now() - started} ms)`,
        )
      } catch (error) {
        failures.push(where)
        console.error(
          `[FAIL] ${where}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
  }

  let pruned = 0
  let present = []
  try {
    present = (await readdir(outDir)).filter((name) => extname(name) === '.svg')
  } catch {
    present = []
  }
  for (const name of present) {
    const path = join(outDir, name)
    if (written.has(path)) continue
    await unlink(path)
    pruned++
    console.log(`[DEL]  ${relative(process.cwd(), path)} (ninguna guía lo usa)`)
  }

  console.log(
    `[DONE] ${files.length} archivos .md, ${written.size} diagramas: ` +
      `${rendered} generados, ${skipped} ya existían, ${pruned} borrados` +
      (failures.length ? `, ${failures.length} con error` : ''),
  )
  if (failures.length) process.exit(1)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (!THEMES.includes(options.theme)) {
    console.error(`Tema inválido: ${options.theme}. Usa ${THEMES.join(', ')}.`)
    process.exit(2)
  }
  if (options.scan) {
    if (!options.out) {
      console.error('--scan necesita --out <carpeta> con la ruta pública de los SVG.')
      process.exit(2)
    }
    const { renderMermaid } = await import('@speajus/mermaid-to-svg')
    await scanMarkdown(
      renderMermaid,
      resolve(options.scan),
      resolve(options.out),
      options.theme,
      options.force,
    )
    return
  }
  if (options.positional.length === 0) {
    console.error(USAGE)
    process.exit(2)
  }

  const { renderMermaid } = await import('@speajus/mermaid-to-svg')
  const input = resolve(options.positional[0])
  const explicitOutput = options.positional[1] ? resolve(options.positional[1]) : null
  const outDir = options.out ? resolve(options.out) : null

  const targets = []
  if (extname(input) === '.mmd') {
    const output = explicitOutput || (outDir
      ? join(outDir, `${input.split('/').pop().replace(/\.mmd$/, '')}.svg`)
      : input.replace(/\.mmd$/, '.svg'))
    targets.push([input, output])
  } else {
    const entries = await readdir(input, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile() || extname(entry.name) !== '.mmd') continue
      const from = join(input, entry.name)
      const to = explicitOutput || join(outDir || input, entry.name.replace(/\.mmd$/, '.svg'))
      targets.push([from, to])
    }
    if (targets.length === 0) {
      console.error(`No hay archivos .mmd en ${input}`)
      process.exit(1)
    }
  }

  let failed = 0
  for (const [from, to] of targets) {
    try {
      await renderFile(renderMermaid, from, to, options.theme)
    } catch (error) {
      failed++
      console.error(`[FAIL] ${from}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (failed > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
