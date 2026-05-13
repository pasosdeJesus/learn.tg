#!/usr/bin/env node
/**
 * Genera imágenes SBT (Soulbound Token) a partir de imágenes de cursos.
 *
 * Uso: node scripts/generate-sbt-images.mjs [courseId ...]
 *   Si no se pasa courseId, lista los cursos disponibles.
 *
 * La imagen se centra-cropa a cuadrado y se le agrega un badge "✓ SBT" o "★ PREMIUM".
 * Resultado: public/img/sbt/{courseId}.png
 *
 * Requiere: DATABASE_URL en .env
 */

import { execSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import * as dotenv from 'dotenv'
import pg from 'pg'
import path from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

// Expandir variables en DATABASE_URL (ej: $PGUSER → valor real)
function expandEnv(str) {
  return str.replace(/\$([A-Z_]+)/g, (_, name) => process.env[name] || '')
}
const rawUrl = process.env.DATABASE_URL || ''
const dbUrl = expandEnv(rawUrl)

const { Pool } = pg
const pool = new Pool({ connectionString: dbUrl })

async function query(sql, params = []) {
  const client = await pool.connect()
  try {
    const result = await client.query(sql, params)
    return result.rows
  } finally {
    client.release()
  }
}

const PUBLIC_DIR = join(__dirname, '..', 'public')
const SBT_DIR = join(PUBLIC_DIR, 'img', 'sbt')
const SBT_SIZE = 400

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

async function getCourse(courseId) {
  const rows = await query(
    'SELECT id, imagen, titulo, "prefijoRuta", idioma FROM cor1440_gen_proyectofinanciero WHERE id = $1',
    [courseId]
  )
  return rows[0] || null
}

async function listCourses() {
  return await query(
    'SELECT id, imagen, titulo, "prefijoRuta", idioma FROM cor1440_gen_proyectofinanciero ORDER BY id'
  )
}

function generateSbtImage(courseId, imagePath, courseName, isPremium) {
  const srcPath = join(PUBLIC_DIR, 'img', imagePath)
  const outPath = join(SBT_DIR, `${courseId}.png`)

  if (!existsSync(srcPath)) {
    console.error(`❌ No se encuentra imagen: ${srcPath}`)
    return false
  }

  const badge = isPremium ? '★ PREMIUM' : '✓ SBT'

  try {
    const cmd = [
      `convert "${srcPath}"`,
      `-gravity center`,
      `-resize ${SBT_SIZE}x${SBT_SIZE}^`,
      `-extent ${SBT_SIZE}x${SBT_SIZE}`,
      `-fill "rgba(0,0,0,0.5)" -draw "rectangle 0,0,${SBT_SIZE},36"`,
      `-fill white -font DejaVu-Sans-Bold -pointsize 18`,
      `-gravity northwest -annotate +10+8 "${badge}"`,
      `-fill "rgba(0,0,0,0.5)" -draw "rectangle 0,${SBT_SIZE - 40},${SBT_SIZE},${SBT_SIZE}"`,
      `-fill white -font DejaVu-Sans -pointsize 14`,
      `-gravity southwest -annotate +10+${SBT_SIZE - 12} "${courseName}"`,
      `"${outPath}"`,
    ].join(' ')

    execSync(cmd, { stdio: 'pipe' })
    console.log(`✅ SBT generado: ${outPath} (${badge})`)
    return true
  } catch (err) {
    console.error(`❌ Error generando SBT para courseId=${courseId}:`, err.message)
    return false
  }
}

// --- MAIN ---
ensureDir(SBT_DIR)

const args = process.argv.slice(2)

if (args.length > 0) {
  // Generar SBT para uno o más courseIds
  for (const arg of args) {
    const courseId = parseInt(arg)
    if (isNaN(courseId)) {
      console.error(`❌ courseId inválido: ${arg}`)
      continue
    }

    const course = await getCourse(courseId)
    if (!course) {
      console.error(`❌ Curso no encontrado: ${courseId}`)
      continue
    }
    if (!course.imagen) {
      console.error(`❌ El curso ${courseId} no tiene imagen`)
      continue
    }

    // Determinar si es premium por prefijoRuta (opcional, ajustable)
    const isPremium = course.prefijoRuta?.includes('premium') || false

    generateSbtImage(course.id, course.imagen, course.titulo, isPremium)
  }
} else {
  // Listar cursos disponibles
  console.log('\n📚 Cursos disponibles:\n')
  const courses = await listCourses()
  for (const c of courses) {
    const hasImg = c.imagen ? (existsSync(join(PUBLIC_DIR, 'img', c.imagen)) ? '✅' : '⚠️') : '❌'
    console.log(`  ${c.id.toString().padStart(3)}  ${hasImg}  ${(c.titulo || '').slice(0, 50).padEnd(50)}  img/${c.imagen || ''}`)
  }
  console.log('\nUso: node scripts/generate-sbt-images.mjs <courseId> [courseId2 ...]')
}
