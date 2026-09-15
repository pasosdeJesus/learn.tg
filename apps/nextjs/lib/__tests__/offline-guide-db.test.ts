import { describe, it, expect } from 'vitest'
import { deleteGuide, getGuide, saveGuide } from '../offline-guide-db'

describe('offline-guide-db (R-#241)', () => {
  it('returns null for a guide that was never saved', async () => {
    expect(await getGuide('en/gdcluster/guide99')).toBeNull()
  })

  it('saves and reads the markdown of a guide', async () => {
    await saveGuide('en/gdcluster/guide1', '# Guía de prueba')
    const cached = await getGuide('en/gdcluster/guide1')
    expect(cached?.markdown).toBe('# Guía de prueba')
    expect(cached?.savedAt).toBeGreaterThan(0)
  })

  it('overwrites the previous copy of the same guide', async () => {
    await saveGuide('es/gdcluster/guide1', 'primera')
    await saveGuide('es/gdcluster/guide1', 'segunda')
    expect((await getGuide('es/gdcluster/guide1'))?.markdown).toBe('segunda')
  })

  it('deletes a cached guide', async () => {
    await saveGuide('es/gdcluster/guide2', 'borrar')
    await deleteGuide('es/gdcluster/guide2')
    expect(await getGuide('es/gdcluster/guide2')).toBeNull()
  })
})
