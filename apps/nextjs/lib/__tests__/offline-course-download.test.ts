import { describe, it, expect, beforeEach, vi } from 'vitest'
import { downloadCourse, revalidateCourse } from '../offline-course-download'
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
