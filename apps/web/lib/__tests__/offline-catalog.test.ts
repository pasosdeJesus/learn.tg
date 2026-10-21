import { describe, it, expect, beforeEach } from 'vitest'
import { clearCourseCatalog, getCourseCatalog, saveCourseCatalog } from '../offline-catalog'

describe('offline-catalog (R-#240 §4b)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when the list was never seen', () => {
    expect(getCourseCatalog('en')).toBeNull()
  })

  it('saves and reads the last course list per language', () => {
    saveCourseCatalog('en', [{ id: '1', titulo: 'Alpha' }])
    saveCourseCatalog('es', [{ id: '2', titulo: 'Beta' }])

    expect(getCourseCatalog<{ titulo: string }>('en')?.courses[0].titulo).toBe('Alpha')
    expect(getCourseCatalog<{ titulo: string }>('es')?.courses[0].titulo).toBe('Beta')
    expect(getCourseCatalog('en')?.savedAt).toBeGreaterThan(0)
  })

  it('does not overwrite a good copy with an empty list', () => {
    saveCourseCatalog('en', [{ id: '1', titulo: 'Alpha' }])
    saveCourseCatalog('en', [])
    expect(getCourseCatalog('en')?.courses).toHaveLength(1)
  })

  it('ignores corrupt storage and clears on demand', () => {
    localStorage.setItem('learn.tg.coursesCache.en', 'not-json')
    expect(getCourseCatalog('en')).toBeNull()

    saveCourseCatalog('en', [{ id: '1' }])
    clearCourseCatalog('en')
    expect(getCourseCatalog('en')).toBeNull()
  })
})
