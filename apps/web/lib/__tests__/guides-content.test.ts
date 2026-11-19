import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import * as path from 'node:path'

// Guardas de contenido de las guías del curso GD (R-#297). Complementa —no repite—
// `guides-consistency.test.ts`, que ya cubre preguntas, enlaces, imágenes, umbrales,
// porcentajes y los diagramas: aquí se vigila la **paridad de secciones** entre idiomas,
// que no vuelva a aparecer el código de 6 caracteres (el producto lo quitó en R-#299) y se
// imprime el tamaño de cada guía.

const RESOURCES = path.join(process.cwd(), '..', '..', 'resources')
const COURSES = [
  { lang: 'en', prefix: 'gdcluster', suffix: (n: number) => `guide${n}` },
  { lang: 'es', prefix: 'redgd', suffix: (n: number) => `guia${n}` },
]

function readGuide(course: (typeof COURSES)[number], n: number) {
  const file = path.join(RESOURCES, course.lang, course.prefix, `${course.suffix(n)}.md`)
  return existsSync(file) ? readFileSync(file, 'utf8') : null
}

/** Títulos de sección de nivel 2, en orden. */
function sections(markdown: string): string[] {
  return markdown
    .split(/\r?\n/)
    .filter((line) => /^##\s+/.test(line))
    .map((line) => line.replace(/^##\s+/, '').trim())
}

/** Palabras del texto, sin bloques de código ni el frontmatter. */
function wordCount(markdown: string): number {
  const body = markdown
    .replace(/^---[\s\S]*?---\s*/m, '')
    .replace(/```[\s\S]*?```/g, ' ')
  return body.split(/\s+/).filter(Boolean).length
}

describe('GD guides content (R-#297)', () => {
  it('prints the size of every guide', () => {
    const sizes = []
    for (const course of COURSES) {
      for (let n = 1; n <= 6; n++) {
        const markdown = readGuide(course, n)
        expect(markdown, `${course.lang}/${course.suffix(n)}`).not.toBeNull()
        sizes.push(`${course.lang}/${course.suffix(n)}: ${wordCount(markdown!)} palabras`)
      }
    }
    console.log(`\n${sizes.join('\n')}`)
    expect(sizes).toHaveLength(12)
  })

  it('has the same sections, in the same order, in both languages', () => {
    for (let n = 1; n <= 6; n++) {
      const en = sections(readGuide(COURSES[0], n)!)
      const es = sections(readGuide(COURSES[1], n)!)
      // R-#297 §4.1: una guía, un tema; la versión de cada idioma tiene las mismas
      // secciones (el título cambia, la estructura no).
      expect(en.length, `guía ${n}: secciones EN=${en.length} ES=${es.length}`).toBe(es.length)
    }
  })

  it('no longer teaches the removed 6-character cluster code', () => {
    // R-#299 eliminó el código; sólo queda el de referido, que tiene 8 caracteres y
    // nunca une a un clúster (guía 2).
    const stale = /c[oó]digo de 6|6[- ]character code|six[- ]character code|c[oó]digo de seis/i
    for (const course of COURSES) {
      for (let n = 1; n <= 6; n++) {
        const markdown = readGuide(course, n)!
        const match = stale.exec(markdown)
        expect(match?.[0], `${course.lang}/${course.suffix(n)}: ${match?.[0] ?? ''}`).toBeUndefined()
      }
    }
  })

  it('points every guide to the cluster page or to another guide (R-#297 §2)', () => {
    // Cada guía debe decir dónde se hace lo que pide: la página del clúster o la guía
    // siguiente/anterior.
    for (const course of COURSES) {
      for (let n = 1; n <= 6; n++) {
        const markdown = readGuide(course, n)!
        const pointsOnward = /\/(?:en\/gdcluster|es\/redgd)\/(?:guide|guia)\d|\(\/(?:en|es)\/cluster/.test(markdown)
        expect(pointsOnward, `${course.lang}/${course.suffix(n)}`).toBe(true)
      }
    }
  })
})
