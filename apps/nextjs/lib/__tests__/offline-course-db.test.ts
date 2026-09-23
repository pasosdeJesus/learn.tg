import { describe, it, expect, beforeEach } from 'vitest'
import {
  belongsToWallet,
  computeRevision,
  courseKey,
  deleteDownloadedCourse,
  deleteDownloadedCourses,
  getDownloadedCourse,
  isStale,
  listDownloadedCourses,
  revisionChanged,
  saveCourseGuide,
  saveDownloadedCourse,
  type DownloadedCourse,
} from '../offline-course-db'
import { getGuide } from '../offline-guide-db'

// Descarga completa de cursos para leer sin conexión
// (https://github.com/pasosdeJesus/learn.tg/issues/256). Sin IndexedDB (jsdom)
// los módulos usan su respaldo en memoria, que es lo que se ejercita aquí.

function record(overrides: Partial<DownloadedCourse> = {}): DownloadedCourse {
  return {
    key: 'en/gdcluster',
    courseId: 10,
    lang: 'en',
    prefix: 'gdcluster',
    titulo: 'Global Disciples',
    contenidoCristiano: true,
    isPremium: true,
    wallet: '0x84272a6dd0d5fe9ea2ab28cf96e72f4f7da00c5c',
    downloadedAt: Date.now(),
    revision: 'abc',
    guides: [{ suffix: 'guide1', puzzle: { grid: [], placements: [] } }],
    bytes: 100,
    ...overrides,
  }
}

describe('offline-course-db (R-#256)', () => {
  // El store en memoria del módulo persiste entre pruebas del archivo (como lo
  // haría IndexedDB en un dispositivo): cada prueba parte de cero.
  beforeEach(async () => {
    await deleteDownloadedCourses({})
  })

  it('normalises the key to one record per course and language', () => {
    expect(courseKey('es', '/redgd')).toBe('es/redgd')
    expect(courseKey('en', 'gdcluster')).toBe('en/gdcluster')
  })

  it('saves, reads and lists the downloaded courses, newest first', async () => {
    await saveDownloadedCourse(record({ key: 'en/gdcluster', downloadedAt: 1000 }))
    await saveDownloadedCourse(record({ key: 'es/redgd', prefix: 'redgd', lang: 'es', downloadedAt: 2000 }))

    expect((await getDownloadedCourse('en/gdcluster'))?.titulo).toBe('Global Disciples')
    const keys = (await listDownloadedCourses()).map((course) => course.key)
    expect(keys.indexOf('es/redgd')).toBeLessThan(keys.indexOf('en/gdcluster'))
  })

  it('returns null for a course that was never downloaded', async () => {
    expect(await getDownloadedCourse('en/never')).toBeNull()
  })

  it('deletes the course copy and the guides it had stored', async () => {
    await saveCourseGuide('en/gdcluster', 'guide1', '<p>guía</p>')
    await saveDownloadedCourse(record())
    expect((await getGuide('en/gdcluster/guide1'))?.markdown).toBe('<p>guía</p>')

    await deleteDownloadedCourse('en/gdcluster')

    expect(await getDownloadedCourse('en/gdcluster')).toBeNull()
    // Sin la copia del curso no queda material suelto legible
    expect(await getGuide('en/gdcluster/guide1')).toBeNull()
  })

  it('revalidates after 24 h and keeps the copy before that', () => {
    const now = 10 * 24 * 60 * 60 * 1000
    expect(isStale({ downloadedAt: now - 1000 }, now)).toBe(false)
    expect(isStale({ downloadedAt: now - 24 * 60 * 60 * 1000 }, now)).toBe(true)
  })

  it('compares revisions and computes a stable hash', () => {
    const a = computeRevision(['uno', 'dos'])
    expect(a).toBe(computeRevision(['uno', 'dos']))
    expect(a).not.toBe(computeRevision(['uno', 'tres']))

    expect(revisionChanged({ revision: a }, a)).toBe(false)
    expect(revisionChanged({ revision: a }, 'otra')).toBe(true)
  })

  it('only reads a paid course with the wallet that downloaded it', () => {
    const WALLET = '0x84272a6dd0d5fe9ea2ab28cf96e72f4f7da00c5c'
    expect(belongsToWallet({ isPremium: true, wallet: WALLET }, WALLET.toUpperCase())).toBe(true)
    expect(belongsToWallet({ isPremium: true, wallet: WALLET }, '0xotra')).toBe(false)
    expect(belongsToWallet({ isPremium: true, wallet: WALLET }, null)).toBe(false)
    // Un curso gratuito no depende de la billetera
    expect(belongsToWallet({ isPremium: false, wallet: null }, null)).toBe(true)
  })

  it('deletes copies by category (disconnect, wallet deletion, privacy switch)', async () => {
    await saveDownloadedCourse(record({ key: 'en/gdcluster', isPremium: true, contenidoCristiano: true }))
    await saveDownloadedCourse(record({
      key: 'en/web3-and-ubi',
      prefix: 'web3-and-ubi',
      courseId: 3,
      isPremium: false,
      contenidoCristiano: false,
    }))

    const deleted = await deleteDownloadedCourses({ premium: true })

    expect(deleted).toEqual(['en/gdcluster'])
    expect(await getDownloadedCourse('en/gdcluster')).toBeNull()
    expect(await getDownloadedCourse('en/web3-and-ubi')).not.toBeNull()
  })

  it('deletes only the Christian copies of this wallet when the switch goes off', async () => {
    const WALLET = '0x84272a6dd0d5fe9ea2ab28cf96e72f4f7da00c5c'
    await saveDownloadedCourse(record({
      key: 'en/cristiano',
      prefix: 'cristiano',
      contenidoCristiano: true,
      isPremium: false,
      wallet: WALLET,
    }))
    await saveDownloadedCourse(record({
      key: 'en/tecnico',
      prefix: 'tecnico',
      contenidoCristiano: false,
      isPremium: false,
      wallet: WALLET,
    }))

    const deleted = await deleteDownloadedCourses({ christian: true })

    expect(deleted).toEqual(['en/cristiano'])
    expect(await getDownloadedCourse('en/tecnico')).not.toBeNull()
  })
})
