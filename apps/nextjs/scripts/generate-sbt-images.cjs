#!/usr/bin/env node
/**
 * Genera imágenes SBT (Soulbound Token) a partir de imágenes de cursos.
 *
 * Uso: node scripts/generate-sbt-images.cjs [courseId ...]
 *   Si no se pasa courseId, lista los cursos disponibles.
 *
 * La imagen se centra-cropa a cuadrado y se le agrega un badge "✓ SBT" o "★ PREMIUM".
 * Resultado: public/img/sbt/{courseId}.png
 *
 * Requiere: DATABASE_URL en .env
 */

const { execSync } = require('child_process')
const { existsSync, mkdirSync } = require('fs')
const { join } = require('path')
const dotenv = require('dotenv')
const { Pool } = require('pg')

dotenv.config({ path: join(__dirname, '..', '.env') })

function expandEnv(str) {
  return str.replace(/\$([A-Z_]+)/g, (_, name) => process.env[name] || '')
}
const pool = new Pool({ connectionString: expandEnv(process.env.DATABASE_URL || '') })

const PUBLIC_DIR = join(__dirname, '..', 'public')
const SBT_DIR = join(PUBLIC_DIR, 'img', 'sbt')
const SBT_SIZE = 400

function ensureDir(dir) { if (!existsSync(dir)) mkdirSync(dir, { recursive: true }) }

function query(sql, params) {
  return pool.query(sql, params).then(r => r.rows)
}

function getCourse(courseId) {
  return query(
    'SELECT id, imagen, titulo, "prefijoRuta", "porPagar", idioma FROM cor1440_gen_proyectofinanciero WHERE id = $1',
    [courseId]
  ).then(rows => rows[0] || null)
}

function listCourses() {
  return query(
    'SELECT id, imagen, titulo, "prefijoRuta", "porPagar", idioma FROM cor1440_gen_proyectofinanciero ORDER BY id'
  )
}

function generateSbtImage(courseId, imagePath, courseName, isPremium) {
  const srcPath = join(PUBLIC_DIR, imagePath)
  const outPath = join(SBT_DIR, `${courseId}.png`)

  if (!existsSync(srcPath)) {
    console.error('\u274c No se encuentra imagen: ' + srcPath)
    return false
  }

  const badge = isPremium ? '\u2605 PREMIUM' : '\u2713 SBT'

  try {
    const cmd = [
      'convert "' + srcPath + '"',
      '-gravity center',
      '-resize ' + SBT_SIZE + 'x' + SBT_SIZE + '^',
      '-extent ' + SBT_SIZE + 'x' + SBT_SIZE,
      '-fill "rgba(0,0,0,0.5)" -draw "rectangle 0,0,' + SBT_SIZE + ',36"',
      '-fill white -font DejaVu-Sans-Bold -pointsize 18',
      '-gravity northwest -annotate +10+8 "' + badge + '"',
      '-fill "rgba(0,0,0,0.5)" -draw "rectangle 0,' + (SBT_SIZE - 40) + ',' + SBT_SIZE + ',' + SBT_SIZE + '"',
      '-fill white -font DejaVu-Sans -pointsize 14',
      '-gravity south -annotate +0+10 "' + courseName + '"',
      '"' + outPath + '"',
    ].join(' ')

    execSync(cmd, { stdio: 'pipe' })
    console.log('\u2705 SBT generado: ' + outPath + ' (' + badge + ')')
    return true
  } catch (err) {
    console.error('\u274c Error generando SBT para courseId=' + courseId + ': ' + err.message)
    return false
  }
}

// --- MAIN ---
console.log('🔍 Conectando a base de datos...')
ensureDir(SBT_DIR)

const args = process.argv.slice(2)

async function main() {
  if (args.length > 0) {
    for (const arg of args) {
      const courseId = parseInt(arg)
      if (isNaN(courseId)) { console.error('\u274c courseId inv\u00e1lido: ' + arg); continue }
      const course = await getCourse(courseId)
      if (!course) { console.error('\u274c Curso no encontrado: ' + courseId); continue }
      if (!course.imagen) { console.error('\u274c El curso ' + courseId + ' no tiene imagen'); continue }
      const isPremium = course.porPagar !== null && Number(course.porPagar) > 0
      generateSbtImage(course.id, course.imagen, course.titulo, isPremium)
    }
  } else {
    console.log('\n📚 Cursos disponibles:\n')
    const courses = await listCourses()
    for (const c of courses) {
      const fullPath = join(PUBLIC_DIR, 'img', c.imagen || '')
      const hasImg = c.imagen ? (existsSync(fullPath) ? '\u2705' : '\u26a0\ufe0f') : '\u274c'
      const title = (c.titulo || '').slice(0, 50)
      console.log('  ' + String(c.id).padStart(3) + '  ' + hasImg + '  ' + title.padEnd(50) + '  ' + (c.imagen || ''))
    }
    console.log('\nUso: node scripts/generate-sbt-images.cjs <courseId> [courseId2 ...]')
  }
  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
