import { describe, it, expect, beforeEach, vi } from 'vitest'
import { downloadAllAccessible, listAccessibleCourses, type DownloadOptions } from '../offline-course-download'
import { deleteDownloadedCourses, getDownloadedCourse, saveDownloadedCourse } from '../offline-course-db'

// Sincronización de **todo lo accesible** (R-#256, pedido del operador 2026-09-23:
// offline solo estaba la guía visitada). Reglas: gratuitos siempre; de pago solo si
// esta billetera los compró; de contenido sensible solo con el interruptor de
// R-#259 encendido.

const WALLET = '0x84272a6dd0d5fe9ea2ab28cf96e72f4f7da00c5c'

const CATALOG = [
  { id: 105, prefijoRuta: '/web3-and-ubi', idioma: 'en', titulo: 'Web3 and UBI', porPagar: null, contenido_sensible: false },
  { id: 2, prefijoRuta: '/a-relationship-with-Jesus', idioma: 'en', titulo: 'A relationship with Jesus', porPagar: null, contenido_sensible: true },
  { id: 10, prefijoRuta: '/gdcluster', idioma: 'en', titulo: 'Global Disciples', porPagar: 1, contenido_sensible: true },
  { id: 103, prefijoRuta: '/save-in-dollars-on-OKX', idioma: 'en', titulo: 'OKX', porPagar: 1, contenido_sensible: false },
]

interface FakeOptions {
  publicSensitiveCourses?: boolean
  purchased?: number[]
  failDetailFor?: number[]
}

function makeGet(options: FakeOptions = {}) {
  return vi.fn(async (url: string) => {
    if (url.startsWith('/api/course-catalog?')) return { data: CATALOG }
    if (url === '/api/settings') {
      return { data: { publicCourses: true, publicSensitiveCourses: options.publicSensitiveCourses === true } }
    }
    if (url === '/api/courses/premium/mine') {
      return { data: { courses: (options.purchased || []).map((course_id) => ({ course_id })) } }
    }
    const detail = /^\/api\/course-catalog\/(\d+)$/.exec(url)
    if (detail) {
      const id = Number(detail[1])
      if ((options.failDetailFor || []).includes(id)) throw new Error('offline')
      return { data: { guias: [{ sufijoRuta: 'guide1', titulo: 'What is a cluster?' }, { sufijoRuta: 'guide2', titulo: 'Your first three churches' }] } }
    }
    if (url.startsWith('/api/guide?')) return { data: { markdown: '<p>guía</p>' } }
    if (url.startsWith('/api/crossword?')) return { data: { grid: [[]], placements: [] } }
    throw new Error(`unexpected ${url}`)
  })
}

describe('listAccessibleCourses (R-#256)', () => {
  it('takes the free non-sensitive courses and leaves the rest out with a reason', async () => {
    const { courses, skipped, total } = await listAccessibleCourses(makeGet() as any, { lang: 'en', authenticated: true })

    expect(total).toBe(4)
    expect(courses.map((course) => course.prefix)).toEqual(['web3-and-ubi'])
    expect(courses[0].guides).toEqual(['guide1', 'guide2'])
    // El título por sufijo viaja con el descriptor para que el índice sin conexión
    // muestre el título y no `guide1` (operador, 2026-09-25).
    expect(courses[0].guideTitles).toEqual({
      guide1: 'What is a cluster?',
      guide2: 'Your first three churches',
    })
    expect(skipped).toEqual(expect.arrayContaining([
      { prefix: 'a-relationship-with-Jesus', reason: 'privacy' },
      { prefix: 'gdcluster', reason: 'privacy' },
      { prefix: 'save-in-dollars-on-OKX', reason: 'not-purchased' },
    ]))
  })

  it('includes sensitive courses when the learner turned the switch on', async () => {
    const { courses } = await listAccessibleCourses(
      makeGet({ publicSensitiveCourses: true }) as any,
      { lang: 'en', authenticated: true },
    )

    expect(courses.map((course) => course.prefix)).toEqual(['web3-and-ubi', 'a-relationship-with-Jesus'])
  })

  it('includes a paid course only when this wallet bought it', async () => {
    const { courses } = await listAccessibleCourses(
      makeGet({ purchased: [103] }) as any,
      { lang: 'en', authenticated: true },
    )

    expect(courses.map((course) => course.prefix)).toEqual(['web3-and-ubi', 'save-in-dollars-on-OKX'])
  })

  it('never includes a sensitive paid course without the switch, even if purchased', async () => {
    const { courses, skipped } = await listAccessibleCourses(
      makeGet({ purchased: [10] }) as any,
      { lang: 'en', authenticated: true },
    )

    expect(courses.map((course) => course.prefix)).not.toContain('gdcluster')
    expect(skipped).toContainEqual({ prefix: 'gdcluster', reason: 'privacy' })
  })

  it('for an anonymous visitor only the free non-sensitive courses count', async () => {
    const { courses } = await listAccessibleCourses(makeGet() as any, { lang: 'en', authenticated: false })

    expect(courses.map((course) => course.prefix)).toEqual(['web3-and-ubi'])
  })

  it('skips a course whose detail cannot be read', async () => {
    const { courses } = await listAccessibleCourses(
      makeGet({ failDetailFor: [105] }) as any,
      { lang: 'en', authenticated: true },
    )

    expect(courses).toEqual([])
  })
})

describe('downloadAllAccessible (R-#256)', () => {
  beforeEach(async () => {
    await deleteDownloadedCourses({})
  })

  const options = (): Parameters<typeof downloadAllAccessible>[1] => ({
    lang: 'en',
    wallet: WALLET,
    authenticated: true,
  })

  it('downloads every accessible course', async () => {
    const get = makeGet({ publicSensitiveCourses: true, purchased: [103] })

    const result = await downloadAllAccessible(get as any, options())

    expect(result.downloaded.sort()).toEqual(['en/a-relationship-with-Jesus', 'en/save-in-dollars-on-OKX', 'en/web3-and-ubi'])
    expect(result.failed).toEqual([])
    for (const key of result.downloaded) {
      expect(await getDownloadedCourse(key)).not.toBeNull()
    }
  })

  it('is idempotent: a current copy is not downloaded again', async () => {
    const get = makeGet()
    await downloadAllAccessible(get as any, options())
    const callsAfterFirst = get.mock.calls.length

    const second = await downloadAllAccessible(get as any, options())

    expect(second.downloaded).toEqual([])
    expect(second.skipped).toContainEqual({ key: 'en/web3-and-ubi', reason: 'already-current' })
    // La segunda pasada no vuelve a pedir el contenido de las guías
    expect(get.mock.calls.length - callsAfterFirst).toBeLessThan(6)
  })

  it('keeps going when one course fails', async () => {
    const get = makeGet({ publicSensitiveCourses: true })
    // El curso gratuito falla al descargar sus guías
    get.mockImplementation(async (url: string) => {
      if (url.startsWith('/api/guide?')) throw new Error('offline')
      if (url.startsWith('/api/course-catalog?')) return { data: CATALOG }
      if (url === '/api/settings') return { data: { publicCourses: true, publicSensitiveCourses: true } }
      if (url === '/api/courses/premium/mine') return { data: { courses: [] } }
      if (/^\/api\/course-catalog\/\d+$/.test(url)) return { data: { guias: [{ sufijoRuta: 'guide1', titulo: 'Guía' }] } }
      throw new Error('unexpected')
    })

    const result = await downloadAllAccessible(get as any, options())

    expect(result.failed.map((item) => item.key).sort()).toEqual(['en/a-relationship-with-Jesus', 'en/web3-and-ubi'])
    expect(result.downloaded).toEqual([])
  })

  // Una copia descargada antes de que se guardaran los títulos (2026-09-25) se refresca
  // sola: si no, el índice sin conexión seguiría mostrando `guide1` para siempre.
  it('refreshes a copy that has the guides but no titles', async () => {
    const get = makeGet()
    await saveDownloadedCourse({
      key: 'en/web3-and-ubi',
      courseId: 105,
      lang: 'en',
      prefix: 'web3-and-ubi',
      titulo: 'Web3 and UBI',
      contenidoSensible: false,
      isPremium: false,
      wallet: WALLET,
      downloadedAt: Date.now(),
      revision: 'vieja',
      guides: [{ suffix: 'guide1', puzzle: null }, { suffix: 'guide2', puzzle: null }],
      bytes: 10,
    } as any)

    const result = await downloadAllAccessible(get as any, options())

    expect(result.downloaded).toContain('en/web3-and-ubi')
    expect((await getDownloadedCourse('en/web3-and-ubi'))?.guides[0].titulo).toBe('What is a cluster?')
  })

  it('drops a copy whose guide list changed (a new guide must be downloaded)', async () => {    const get = makeGet()
    await saveDownloadedCourse({
      key: 'en/web3-and-ubi',
      courseId: 105,
      lang: 'en',
      prefix: 'web3-and-ubi',
      titulo: 'Web3 and UBI',
      contenidoSensible: false,
      isPremium: false,
      wallet: WALLET,
      downloadedAt: Date.now(),
      revision: 'vieja',
      guides: [{ suffix: 'guide1', puzzle: null }],
      bytes: 10,
    } as any)

    const result = await downloadAllAccessible(get as any, options())

    expect(result.downloaded).toContain('en/web3-and-ubi')
    expect((await getDownloadedCourse('en/web3-and-ubi'))?.guides.map((guide) => guide.suffix))
      .toEqual(['guide1', 'guide2'])
  })
})
