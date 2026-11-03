import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import * as path from 'node:path'
import { guideProcessor } from '@/lib/guide-markdown.mjs'
import { answersFromGuideFile, normalizeClue } from '../../e2e/helpers/crossword.mjs'
import { MIN_CHURCHES, MIN_PROFILE_SCORE } from '../../../../packages/gdcluster/src/lib/gd-presentation.js'

// Las guías son la fuente que ven los pastores
// (https://github.com/pasosdeJesus/learn.tg/issues/161). Este test las lee con el
// mismo procesador de la aplicación y comprueba que siguen siendo coherentes con
// el código y entre idiomas: preguntas bien formadas, los umbrales de la
// presentación, los porcentajes del financiamiento, enlaces e imágenes vivos y
// las pistas del crucigrama offline.

const RESOURCES = path.join(process.cwd(), '..', '..', 'resources')
const PUBLIC = path.join(process.cwd(), 'public')
const COURSES = [
  { lang: 'en', prefix: 'gdcluster', suffix: (n: number) => `guide${n}` },
  { lang: 'es', prefix: 'redgd', suffix: (n: number) => `guia${n}` },
]

function readGuide(course: (typeof COURSES)[number], n: number) {
  const file = `${course.suffix(n)}.md`
  const full = path.join(RESOURCES, course.lang, course.prefix, file)
  if (!existsSync(full)) return null
  return { file, full, text: readFileSync(full, 'utf8') }
}

function questionsOf(course: (typeof COURSES)[number], n: number) {
  const guide = readGuide(course, n)
  if (!guide) return []
  const processed = guideProcessor({
    url: `/${course.lang}/${course.prefix}/${course.suffix(n)}/test`,
    lang: course.lang,
    fillInTheBlank: true,
  }).processSync(guide.text)
  return (processed.data as any).fillInTheBlank || []
}

describe('GD guides consistency (R-#161)', () => {
  it('has the six guides in both languages', () => {
    for (const course of COURSES) {
      const files = readdirSync(path.join(RESOURCES, course.lang, course.prefix)).filter((f) => f.endsWith('.md'))
      expect(files, `${course.lang}/${course.prefix}`).toHaveLength(6)
      for (let n = 1; n <= 6; n++) expect(readGuide(course, n), `${course.lang}/${course.suffix(n)}`).not.toBeNull()
    }
  })

  it('parses at least 8 well formed questions per guide', () => {
    for (const course of COURSES) {
      for (let n = 1; n <= 6; n++) {
        const questions = questionsOf(course, n)
        expect(questions.length, `${course.lang}/${course.suffix(n)}`).toBeGreaterThanOrEqual(8)
        for (const question of questions) {
          expect(question.clue, `${course.lang}/${course.suffix(n)}`).toContain('___')
          expect(question.answer.trim(), `${course.lang}/${course.suffix(n)}`).not.toBe('')
          expect(question.answer, `respuesta con espacios en ${course.lang}/${course.suffix(n)}`).not.toMatch(/\s/)
        }
      }
    }
  })

  it('asks the same number of questions in both languages', () => {
    for (let n = 1; n <= 6; n++) {
      expect(questionsOf(COURSES[0], n).length, `guide${n} vs guia${n}`).toBe(questionsOf(COURSES[1], n).length)
    }
  })

  it('keeps the clustering thresholds the guides promise', () => {
    const numbers = { en: ['three'], es: ['tres'] }
    for (const course of COURSES) {
      const guide = readGuide(course, 2)!
      const text = guide.text.toLowerCase()
      expect(text, `${course.lang}: mínimo de iglesias`).toContain(numbers[course.lang as 'en' | 'es'][0])
      expect(MIN_CHURCHES).toBe(3)

      const guide6 = readGuide(course, 6)!.text
      expect(guide6, `${course.lang}: puntaje`).toContain(String(MIN_PROFILE_SCORE))
      expect(guide6.toLowerCase(), `${course.lang}: seis guías`).toMatch(course.lang === 'en' ? /six guides/ : /seis guías/)
      expect(MIN_PROFILE_SCORE).toBe(90)
    }
  })

  it('keeps the GD funding shares the guides promise', () => {
    for (const course of COURSES) {
      const text = [1, 4].map((n) => readGuide(course, n)!.text).join('\n')
      for (const share of ['45', '30', '15']) {
        expect(text, `${course.lang}: ${share}%`).toContain(share)
      }
      expect(text).toContain('0%')
    }
  })

  it('links only to guides that exist', () => {
    for (const course of COURSES) {
      for (let n = 1; n <= 6; n++) {
        const { text } = readGuide(course, n)!
        const links = [...text.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1])
        for (const link of links) {
          const inCourse = link.match(/\/(?:en\/gdcluster|es\/redgd)\/(guide|guia)(\d+)/) || link.match(/\.\.\/(?:guide|guia)(\d+)/)
          if (!inCourse) continue
          const target = Number(inCourse[2] ?? inCourse[1])
          expect(readGuide(course, target), `${course.lang}/${course.suffix(n)} → ${link}`).not.toBeNull()
        }
      }
    }
  })

  it('uses images that exist in public/', () => {
    for (const course of COURSES) {
      for (let n = 1; n <= 6; n++) {
        const { text } = readGuide(course, n)!
        const images = [...text.matchAll(/!\[[^\]]*\]\((\/img\/[^)\s]+)/g)].map((match) => match[1])
        for (const image of images) {
          expect(existsSync(path.join(PUBLIC, image.replace(/^\//, ''))), `${course.lang}: ${image}`).toBe(true)
        }
      }
    }
  })

  it('serves the same crossword clues to the page and to the offline helper', () => {
    for (const course of COURSES) {
      for (let n = 1; n <= 6; n++) {
        const file = course.suffix(n)
        const server = questionsOf(course, n).map((question: any) => normalizeClue(question.clue))
        const offline = answersFromGuideFile(course.lang, course.prefix, file).map((pair: any) => normalizeClue(pair.clue))
        expect(offline.sort(), `${course.lang}/${file}`).toEqual(server.sort())
      }
    }
  })
})
