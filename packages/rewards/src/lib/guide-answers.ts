// Respuestas de las preguntas de comprensión de una guía, leídas del propio
// Markdown (https://github.com/pasosdeJesus/learn.tg/issues/256 §3.4).
//
// El camino online valida contra `billetera_usuario.answer_fib` (lo que guardó el
// último `GET /api/crossword`). Sin conexión —o cuando el estudiante resolvió un
// crucigrama que descargó y nunca abrió en línea— esa columna puede corresponder
// a otro crucigrama: aquí las respuestas se derivan de la guía, que es la fuente
// de verdad, y se emparejan por la **pista** (el texto de la pregunta), no por el
// orden.
//
// El formato es el que documenta `lib/remarkFillInTheBlank.mjs`: una lista
// ordenada donde cada elemento incluye `___` y termina en ` (respuesta)`.
import { readFile } from 'fs/promises'
import path from 'path'
import { sql, type Kysely } from 'kysely'

export interface FillInTheBlank {
  clue: string
  answer: string
}

/** Marcador de elemento de lista ordenada (`1.`, `2)`, con sangría). */
const ITEM_RE = /^\s*\d+[.)]\s+/
/** Mismo patrón que el plugin de remark: `... ___ ... (respuesta)` al final. */
const ANSWER_RE = /^(.*___.*)\s+\(([^)]+)\)\s*$/s

/**
 * Extrae las preguntas con su respuesta del Markdown de una guía.
 *
 * Un elemento puede ocupar varias líneas: se acumulan hasta el siguiente
 * elemento, como haría remark al armar el nodo de texto del párrafo. Una línea en
 * blanco (o un encabezado) cierra el elemento: remark no incluiría el párrafo ni
 * el título siguiente en el mismo nodo, y dejarlos dentro rompería el `$` de la
 * expresión (el caso real: la última pregunta seguida de "### Referencias").
 */
export function parseFillInTheBlank(markdown: string): FillInTheBlank[] {
  if (!markdown) return []
  const lines = markdown.split(/\r?\n/)
  const found: FillInTheBlank[] = []
  let current: string[] | null = null

  const flush = () => {
    if (current === null) return
    const text = current.join('\n').trim()
    const match = ANSWER_RE.exec(text)
    if (match) {
      found.push({ clue: match[1].trim(), answer: match[2].trim() })
    }
    current = null
  }

  for (const line of lines) {
    if (ITEM_RE.test(line)) {
      flush()
      // remark quita el espacio final de cada línea al armar el nodo de texto.
      current = [line.replace(ITEM_RE, '').replace(/\s+$/, '')]
    } else if (line.trim() === '' || /^\s*(#|```|---\s*$)/.test(line)) {
      flush()
    } else if (current !== null) {
      current.push(line.trim())
    }
  }
  flush()
  return found
}

/**
 * Empareja las respuestas de la guía con las colocaciones del crucigrama por el
 * texto de la pista, y devuelve una respuesta por colocación en el mismo orden.
 * Devuelve `null` si alguna colocación no tiene una pregunta equivalente: sin
 * coincidencia completa no se puede validar, y adivinar marcaría como incorrecta
 * una respuesta correcta.
 */
export function answersForPlacements(
  answers: FillInTheBlank[],
  placements: { clue?: string }[],
): string[] | null {
  if (!Array.isArray(placements) || placements.length === 0) return null
  const byClue = new Map<string, string>()
  for (const item of answers) byClue.set(normalize(item.clue), item.answer)

  const result: string[] = []
  for (const placement of placements) {
    const answer = byClue.get(normalize(placement?.clue ?? ''))
    if (!answer) return null
    result.push(answer)
  }
  return result
}

/** Espacios y finales de línea no deben decidir si dos pistas son la misma. */
function normalize(clue: string): string {
  return String(clue ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * Respuestas de la guía `guideId` (1-based, en el orden que publica el curso)
 * leídas del Markdown que vive en `resources/`.
 *
 * Devuelve `[]` cuando no se puede leer (curso o guía inexistente, archivo
 * ausente): quien llama decide entonces si conserva las respuestas que ya tenía.
 */
export async function guideAnswersFromDisk(
  db: Kysely<any>,
  courseId: number,
  guideId: number,
  resourcesRoot?: string,
): Promise<FillInTheBlank[]> {
  const course = await db
    .selectFrom('cor1440_gen_proyectofinanciero')
    .select(['idioma', 'prefijoRuta'])
    .where('id', '=', courseId)
    .executeTakeFirst()
  if (!course?.prefijoRuta) return []

  const guides = await sql<any>`
    SELECT "sufijoRuta"
    FROM cor1440_gen_actividadpf
    WHERE proyectofinanciero_id = ${courseId}
      AND "sufijoRuta" IS NOT NULL
      AND "sufijoRuta" <> ''
    ORDER BY nombrecorto
  `.execute(db)
  const suffix = guides.rows?.[guideId - 1]?.sufijoRuta
  if (!suffix) return []

  const root = resourcesRoot || path.join(process.cwd(), '..', '..', 'resources')
  const prefix = String(course.prefijoRuta).replace(/^\/+/, '')
  const lang = course.idioma || 'en'
  try {
    const markdown = await readFile(path.join(root, String(lang), prefix, `${suffix}.md`), 'utf8')
    return parseFillInTheBlank(markdown)
  } catch {
    return []
  }
}
