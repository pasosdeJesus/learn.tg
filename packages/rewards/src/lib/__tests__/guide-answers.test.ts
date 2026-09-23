import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { answersForPlacements, parseFillInTheBlank } from '../guide-answers'

// Respuestas derivadas del Markdown de la guía
// (https://github.com/pasosdeJesus/learn.tg/issues/256 §3.4).
describe('parseFillInTheBlank', () => {
  it('reads an ordered list of questions with the answer in parentheses', () => {
    const md = [
      '# Guía',
      '',
      '1. El amor de Dios es ___ (eterno)',
      '2. Jesús dijo que él es el ___ (camino)',
      '',
    ].join('\n')

    expect(parseFillInTheBlank(md)).toEqual([
      { clue: 'El amor de Dios es ___', answer: 'eterno' },
      { clue: 'Jesús dijo que él es el ___', answer: 'camino' },
    ])
  })

  it('joins the lines of a question that spans more than one line', () => {
    const md = [
      '1. Una pregunta larga que sigue',
      '   en la línea siguiente ___ (respuesta)',
    ].join('\n')

    expect(parseFillInTheBlank(md)).toEqual([
      { clue: 'Una pregunta larga que sigue\nen la línea siguiente ___', answer: 'respuesta' },
    ])
  })

  it('ignores items without a blank or without an answer', () => {
    const md = [
      '1. Un elemento normal de la lista',
      '2. Sin respuesta al final ___',
      '3. Con respuesta ___ (sí)',
    ].join('\n')

    expect(parseFillInTheBlank(md)).toEqual([{ clue: 'Con respuesta ___', answer: 'sí' }])
  })

  it('closes the item at a blank line, like remark', () => {
    // Caso real: la última pregunta va seguida de una sección de referencias.
    const md = [
      '5. El Ingreso Básico ___ (IBU) es un pago regular. (Universal)',
      '',
      '### Referencias y Lecturas Adicionales',
      '',
      '*   [GoodDollar](https://www.gooddollar.org/)',
    ].join('\n')

    expect(parseFillInTheBlank(md)).toEqual([
      { clue: 'El Ingreso Básico ___ (IBU) es un pago regular.', answer: 'Universal' },
    ])
  })

  it('closes the item at a heading that follows without a blank line', () => {
    const md = [
      '1. Pregunta ___ (uno)',
      '## Otra sección',
      '2. No es parte de la lista anterior ___ (dos)',
    ].join('\n')

    expect(parseFillInTheBlank(md)).toEqual([
      { clue: 'Pregunta ___', answer: 'uno' },
      { clue: 'No es parte de la lista anterior ___', answer: 'dos' },
    ])
  })

  it('accepts the `1)` marker and keeps parentheses of the question body', () => {
    // Mismo comportamiento que el plugin de remark: el grupo `(.*___.*)` es
    // goloso y el último `(texto sin paréntesis)` de la línea es la respuesta, así
    // que un aparte entre paréntesis en la pregunta no estorba.
    const md = '1) La fórmula (ver arriba) es ___ (a + b = c)'
    expect(parseFillInTheBlank(md)).toEqual([
      { clue: 'La fórmula (ver arriba) es ___', answer: 'a + b = c' },
    ])
  })

  it('returns nothing for an empty guide', () => {
    expect(parseFillInTheBlank('')).toEqual([])
  })

  // El parser tiene que coincidir con lo que sirve el crucigrama real: la pista
  // de cada colocación es el texto de la pregunta.
  it('reads the real guide used by the offline spec', () => {
    const file = path.join(process.cwd(), '..', '..', 'resources', 'en', 'gdcluster', 'guide1.md')
    const answers = parseFillInTheBlank(readFileSync(file, 'utf8'))

    expect(answers.length).toBeGreaterThan(4)
    for (const item of answers) {
      expect(item.clue).toContain('___')
      expect(item.answer.length).toBeGreaterThan(0)
    }
  })
})

describe('answersForPlacements', () => {
  const answers = [
    { clue: 'El amor de Dios es ___', answer: 'eterno' },
    { clue: 'Jesús es el ___', answer: 'camino' },
  ]

  it('matches by clue, in the order of the placements, not of the guide', () => {
    const placements = [
      { clue: 'Jesús es el ___' },
      { clue: 'El amor de Dios es ___' },
    ]

    expect(answersForPlacements(answers, placements)).toEqual(['camino', 'eterno'])
  })

  it('tolerates extra whitespace and line breaks in the clue', () => {
    const placements = [{ clue: 'El amor  de Dios es\n___' }]

    expect(answersForPlacements(answers, placements)).toEqual(['eterno'])
  })

  it('returns null when a placement has no matching question', () => {
    const placements = [{ clue: 'Una pregunta que ya no está ___' }]

    expect(answersForPlacements(answers, placements)).toBeNull()
  })

  it('returns null when there is nothing to match against', () => {
    expect(answersForPlacements([], [{ clue: 'x ___' }])).toBeNull()
    expect(answersForPlacements(answers, [])).toBeNull()
  })
})
