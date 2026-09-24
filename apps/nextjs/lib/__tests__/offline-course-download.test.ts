import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { downloadCourse, revalidateCourse, PAGE_CACHE_NAME } from '../offline-course-download'
import { deleteDownloadedCourses, getDownloadedCourse } from '../offline-course-db'
import { getGuide } from '../offline-guide-db'

// Descarga de un curso completo (https://github.com/pasosdeJesus/learn.tg/issues/256):
// se piden el HTML de cada guía y su crucigrama (sin respuestas) y se guardan
// juntos, de modo que la guía se lee sin conexión aunque nunca se haya abierto.

const WALLET = '0x84272a6dd0d5fe9ea2ab28cf96e72f4f7da00c5c'

const DESCRIPTOR = {
  courseId: 10,
  lang: 'en',
  prefix: '/gdcluster',
  titulo: 'Global Disciples',
  contenidoSensible: true,
  isPremium: true,
  guides: ['guide1', 'guide2'],
}

function makeGet() {
  return vi.fn(async (url: string) => {
    if (url.startsWith('/api/guide?')) {
      const suffix = /guide=([^&]+)/.exec(url)?.[1]
      return { data: { markdown: `<p>guía ${suffix}</p>`, message: '' } }
    }
    if (url.startsWith('/api/crossword?')) {
      return {
        data: {
          grid: [[{ letter: '', isBlocked: true, userInput: '', belongsToWords: [] }]],
          placements: [{ word: '-', row: 0, col: 0, direction: 'across', number: 1, clue: 'Pregunta ___' }],
        },
      }
    }
    throw new Error(`unexpected ${url}`)
  })
}

describe('downloadCourse (R-#256)', () => {
  beforeEach(async () => {
    await deleteDownloadedCourses({})
  })

  it('stores every guide and its puzzle, plus the entitlement snapshot', async () => {
    const get = makeGet()
    const progress: number[] = []

    const course = await downloadCourse(DESCRIPTOR, {
      get: get as any,
      wallet: WALLET,
      onProgress: (p) => progress.push(p.done),
    })

    expect(course.key).toBe('en/gdcluster')
    expect(course.prefix).toBe('gdcluster')
    expect(course.wallet).toBe(WALLET)
    expect(course.isPremium).toBe(true)
    expect(course.contenidoSensible).toBe(true)
    expect(course.guides.map((g) => g.suffix)).toEqual(['guide1', 'guide2'])
    expect(course.revision).toMatch(/^[0-9a-z]+$/)
    expect(course.bytes).toBeGreaterThan(0)

    // Las dos guías quedaron legibles sin conexión, aunque nunca se abrieran
    expect((await getGuide('en/gdcluster/guide1'))?.markdown).toBe('<p>guía guide1</p>')
    expect((await getGuide('en/gdcluster/guide2'))?.markdown).toBe('<p>guía guide2</p>')
    // El progreso avanza una vez por descarga (0 inicial, guía y crucigrama)
    expect(progress).toEqual([0, 1, 2, 3, 4])
  })

  it('never stores the crossword solution', async () => {
    const course = await downloadCourse(DESCRIPTOR, { get: makeGet() as any, wallet: WALLET })

    for (const guide of course.guides) {
      const placements = guide.puzzle?.placements as any[]
      const grid = guide.puzzle?.grid as any[][]
      expect(placements[0].word).toBe('-')
      expect(grid[0][0].letter).toBe('')
    }
  })

  it('keeps the course when a guide has no puzzle', async () => {
    const get = vi.fn(async (url: string) => {
      if (url.startsWith('/api/guide?')) return { data: { markdown: '<p>guía</p>' } }
      throw new Error('no puzzle')
    })

    const course = await downloadCourse(DESCRIPTOR, { get: get as any, wallet: WALLET })

    expect(course.guides).toHaveLength(2)
    expect(course.guides.every((g) => g.puzzle === null)).toBe(true)
  })

  // R-#256: sin sesión, `/api/crossword` responde 200 con la cuadrícula vacía y
  // "conecta tu billetera" (medido 2026-09-24 en el sitio de desarrollo). Eso no es un
  // crucigrama: guardarlo pintaba una cuadrícula sin celdas al abrirlo sin conexión.
  it('does not store a puzzle without placements (200 with an empty grid)', async () => {
    const get = vi.fn(async (url: string) => {
      if (url.startsWith('/api/guide?')) return { data: { markdown: '<p>guía</p>' } }
      return {
        data: {
          grid: [[{ letter: '', isBlocked: true, userInput: '', belongsToWords: [] }]],
          placements: [],
          message: 'To solve the puzzle, please connect your web3 Wallet',
        },
      }
    })

    const course = await downloadCourse(DESCRIPTOR, { get: get as any, wallet: WALLET })

    expect(course.guides).toHaveLength(2)
    expect(course.guides.every((g) => g.puzzle === null)).toBe(true)
  })

  it('fails instead of saving half a course when a guide is missing', async () => {
    const get = vi.fn(async (url: string) => {
      if (url.includes('guide=guide1')) return { data: { markdown: '<p>ok</p>' } }
      return { data: { error: 'premium_required' } }
    })

    await expect(downloadCourse(DESCRIPTOR, { get: get as any, wallet: WALLET }))
      .rejects.toThrow('Guide guide2 could not be downloaded')
    expect(await getDownloadedCourse('en/gdcluster')).toBeNull()
  })
})

describe('revalidateCourse (R-#256 §3.6)', () => {
  beforeEach(async () => {
    await deleteDownloadedCourses({})
  })

  it('reports no update when the server content is the same', async () => {
    await downloadCourse(DESCRIPTOR, { get: makeGet() as any, wallet: WALLET })

    const result = await revalidateCourse(DESCRIPTOR, { get: makeGet() as any, wallet: WALLET })

    expect(result.updated).toBe(false)
    expect(result.course).not.toBeNull()
  })

  it('reports and stores a change when a guide was edited', async () => {
    await downloadCourse(DESCRIPTOR, { get: makeGet() as any, wallet: WALLET })

    const edited = vi.fn(async (url: string) => {
      if (url.startsWith('/api/guide?')) {
        const suffix = /guide=([^&]+)/.exec(url)?.[1]
        return { data: { markdown: `<p>guía ${suffix} corregida</p>` } }
      }
      return { data: { grid: [[]], placements: [] } }
    })

    const result = await revalidateCourse(DESCRIPTOR, { get: edited as any, wallet: WALLET })

    expect(result.updated).toBe(true)
    expect((await getGuide('en/gdcluster/guide1'))?.markdown).toBe('<p>guía guide1 corregida</p>')
  })

  it('keeps the previous copy when the server refuses (access lost)', async () => {
    await downloadCourse(DESCRIPTOR, { get: makeGet() as any, wallet: WALLET })

    const denied = vi.fn(async () => { throw new Error('403') })
    const result = await revalidateCourse(DESCRIPTOR, { get: denied as any, wallet: WALLET })

    expect(result.updated).toBe(false)
    expect(result.course).toBeNull()
    expect(await getDownloadedCourse('en/gdcluster')).not.toBeNull()
  })
})

// El documento de la guía y el de su crucigrama tienen que quedar en la misma caché
// que lee la regla de `next.config.ts`: sin eso, abrir la guía descargada sin conexión
// cae en `/offline`. El operador lo reportó con un iPhone el 2026-09-23 (ahí el
// service worker todavía no controlaba la página, así que el `fetch` solo no bastaba).
describe('warmPageCache (R-#256)', () => {
  const put = vi.fn(async (_request: Request, _response?: Response) => undefined)
  const open = vi.fn(async () => ({ put }))

  beforeEach(async () => {
    put.mockClear()
    open.mockClear()
    Object.defineProperty(window, 'caches', { value: { open }, configurable: true })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>guía</html>', { status: 200 })))
    await deleteDownloadedCourses({})
  })

  it('stores the guide page and its crossword page in the pages cache', async () => {
    await downloadCourse(DESCRIPTOR, { get: makeGet() as any, wallet: WALLET })

    expect(open).toHaveBeenCalledWith(PAGE_CACHE_NAME)
    const urls = put.mock.calls.map((call) => String((call[0] as Request).url))
    expect(urls.some((url) => url.endsWith('/en/gdcluster/guide1'))).toBe(true)
    expect(urls.some((url) => url.endsWith('/en/gdcluster/guide1/test'))).toBe(true)
  })

  it('keeps the cache name in sync with next.config.ts', () => {
    const config = readFileSync(join(__dirname, '..', '..', 'next.config.ts'), 'utf8')
    const pagesRule = /\(en\|es\)[\s\S]*?cacheName:\s*'([^']+)'/.exec(config)

    expect(pagesRule?.[1]).toBe(PAGE_CACHE_NAME)
  })
})
