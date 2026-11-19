#!/usr/bin/env node
// Genera el PNG que `credential_metadata.image_url` promete
// (`img/credential/<token_id>.png`) a partir de un SVG.
//
// El registro del tipo de credencial (`bin/m eng:credentials:register-type`, del plugin
// `mpdj`) compone la insignia en `public/img/credential/generated/<token>.svg` y la
// rasteriza con `rsvg-convert -w 512 -h 512`. Cuando ese paso no corre (sin
// `apps/contracts/deployments/`, o porque el aviso `cred.image_failed` pasó
// desapercibido), la fila queda apuntando a un PNG que no existe y el sitio devuelve su
// HTML en lugar de la imagen (soft 404, R-#161 §7).
//
// Este script rellena ese hueco sin red:
//
//   node bin/credential-icons.mjs            # genera los PNG que faltan
//   node bin/credential-icons.mjs --list     # muestra el mapeo y qué falta
//   node bin/credential-icons.mjs --force    # regenera todos
//   node bin/credential-icons.mjs --allow-offline   # para el build: si la base no está,
//                                                   avisa y sigue (no rompe el despliegue)
//
// Fuente de cada insignia, en orden: `public/img/credential/generated/<token>.svg` (la
// insignia compuesta), el icono del curso (`cor1440_gen_proyectofinanciero.imagen`
// cuando es SVG) y, si no, el SVG de origen que corresponda por curso (la tabla de
// `doc/deploy-credentials.md` §1.3).
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// `apps/.env` (no versionado) trae `PGHOST`, `PGDATABASE`, `PGUSER` y `PGPASSWORD`, igual
// que los demás comandos de `bin/`.
function loadEnv() {
  for (const file of [join(process.cwd(), '..', '.env'), join(process.cwd(), '.env')]) {
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, 'utf8').split(String.fromCharCode(10))) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
      if (!match) continue
      const value = match[2].replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
      if (process.env[match[1]] === undefined) process.env[match[1]] = value
    }
  }
}
loadEnv()

const PUBLIC = join(process.cwd(), 'public')
const GENERATED_DIR = join(PUBLIC, 'img', 'credential', 'generated')
const SOURCE_DIR = join(PUBLIC, 'img', 'credential', 'source')
const OUT_DIR = join(PUBLIC, 'img', 'credential')
const SIZE = 512

// Icono de origen por **prefijo de ruta** del curso, no por id: los ids de curso y los
// token-id cambian entre desarrollo y producción (por eso los PNG están en .gitignore y
// se generan en cada sitio). `cor1440_gen_proyectofinanciero.prefijoRuta` sí es el mismo
// en ambos. Tabla de doc/deploy-credentials.md §1.3.
const SOURCE_BY_PREFIX = {
  '/una-relacion-con-Jesus': 'relacion-con-Jesus.svg',
  '/a-relationship-with-Jesus': 'a-relationship-with-Jesus.svg',
  '/gdcluster': 'gdcluster.svg',
  '/redgd': 'gdcluster.svg',
  '/ahorra-en-dolares-en-okx': 'ahorra-en-okx.svg',
  '/save-in-dollars-on-OKX': 'ahorra-en-okx.svg',
  '/web3-and-ubi': 'web3_ubi.svg',
  '/w-e-b3-e-ibu': 'web3_ubi.svg',
  '/web3-e-ibu': 'web3_ubi.svg',
}

function normalized(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function arg(name) {
  const index = process.argv.indexOf(name)
  return index >= 0
}

async function loadRows() {
  // Las credenciales (`PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`) vienen de
  // `apps/.env`, igual que en `bin/m`.
  const { default: postgres } = await import('pg')
  const client = new postgres.Client({
    host: process.env.PGHOST || '/var/www/var/run/postgresql/',
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD || undefined,
  })
  await client.connect()
  try {
    const credential = (await client.query(
      'SELECT token_id, name, course_id, image_url FROM credential_metadata ORDER BY token_id',
    )).rows
    const courses = (await client.query(
      'SELECT id, "prefijoRuta", imagen FROM cor1440_gen_proyectofinanciero',
    )).rows
    return { credential, courses }
  } finally {
    await client.end()
  }
}

function publicPath(url) {
  if (!url) return null
  const clean = String(url).replace(/^\//, '')
  return existsSync(join(PUBLIC, clean)) ? join(PUBLIC, clean) : null
}

/** SVG del que sale la insignia del token, o el motivo por el que no hay. */
function svgFor(tokenId, rows, course) {
  const composed = join(GENERATED_DIR, `${tokenId}.svg`)
  if (existsSync(composed)) return { svg: composed, from: 'generated' }
  const courseImage = course?.imagen
  const courseSvg = courseImage && String(courseImage).toLowerCase().endsWith('.svg')
    ? publicPath(courseImage)
    : null
  if (courseSvg) return { svg: courseSvg, from: 'curso' }
  const prefix = String(course?.prefijoRuta || '')
  const mapped = SOURCE_BY_PREFIX[prefix]
  if (mapped && existsSync(join(SOURCE_DIR, mapped))) {
    return { svg: join(SOURCE_DIR, mapped), from: `source (${prefix})` }
  }
  // Último intento: parecido por nombre normalizado, sin inventar arte.
  const wanted = normalized(prefix)
  const match = existsSync(SOURCE_DIR)
    ? readdirSync(SOURCE_DIR).find((file) => wanted && normalized(file) === wanted)
    : null
  if (match) return { svg: join(SOURCE_DIR, match), from: `source (${match})` }
  return { svg: null, from: 'sin fuente (recomponer con deployments)' }
}

function main() {
  const list = arg('--list')
  const force = arg('--force')
  const allowOffline = arg('--allow-offline')

  return loadRows().then(({ credential, courses }) => {
    const courseById = new Map(courses.map((row) => [Number(row.id), row]))
    const byToken = new Map()
    for (const row of credential) {
      const token = Number(row.token_id)
      if (!byToken.has(token)) byToken.set(token, [])
      byToken.get(token).push(row)
    }

    mkdirSync(OUT_DIR, { recursive: true })
    let generated = 0
    let skipped = 0
    const problems = []

    for (const [token, rows] of [...byToken.entries()].sort((a, b) => a[0] - b[0])) {
      const imageUrl = String(rows[0].image_url || '')
      const expected = imageUrl.startsWith('img/credential/')
        ? join(PUBLIC, imageUrl)
        : join(OUT_DIR, `${token}.png`)
      const exists = existsSync(expected)
      const course = courseById.get(Number(rows[0].course_id))
      const { svg, from } = svgFor(token, rows, course)
      const label = `${String(token).padStart(3)} ${rows[0].name}`

      if (list) {
        console.log(`${label} → ${imageUrl} [${exists ? 'existe' : 'FALTA'}] ← ${from}${svg ? ` (${svg.replace(PUBLIC + '/', '')})` : ''}`)
        if (!svg && !exists) problems.push(token)
        continue
      }
      if (exists && !force) {
        skipped++
        if (list) console.log(`${label} → ${imageUrl} [existe]`)
        continue
      }
      if (!svg) {
        console.log(`[SKIP] ${label}: sin SVG de origen; recomponer con deployments y \`eng:credentials:recompose-image\``)
        problems.push(token)
        continue
      }
      try {
        execFileSync('rsvg-convert', ['-w', String(SIZE), '-h', String(SIZE), '-o', expected, svg], {
          stdio: 'pipe',
        })
        const bytes = statSync(expected).size
        generated++
        console.log(`[OK]   ${label} → ${expected.replace(PUBLIC + '/', 'public/')} (${bytes} bytes, desde ${from})`)
      } catch (error) {
        problems.push(token)
        console.error(`[FAIL] ${label}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    if (list) {
      console.log(
        `\n${byToken.size} token(s); ${problems.length ? `${problems.length} sin PNG ni SVG de origen: ${problems.join(', ')}` : 'todos con PNG o con SVG de origen'}`,
      )
      return
    }
    console.log(`\n[DONE] ${byToken.size} token(s): ${generated} generados, ${skipped} ya existían, ${problems.length} sin resolución`)
    if (problems.length) {
      console.log(`       sin resolver: ${problems.join(', ')} (necesitan la insignia compuesta: deployments + eng:credentials:recompose-image)`)
    }
  })
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  if (arg('--allow-offline')) {
    // En `make all` / `make prod` este paso es best-effort: si no hay base o no hay
    // `rsvg-convert`, se avisa y el despliegue sigue (los PNG que ya existen no se tocan).
    console.warn(`[WARN] credenciales sin generar: ${message}`)
    return
  }
  console.error(message)
  process.exit(1)
})
