import { describe, it, expect } from 'vitest'
import { deleteGuide, getGuide, listGuides, saveGuide } from '../offline-guide-db'

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

  // R-#240/R-#241: la página /offline lista lo que sí se puede leer sin conexión.
  it('lists the cached guides, newest first, and forgets the deleted ones', async () => {
    await saveGuide('en/gdcluster/guide3', 'tres')
    await deleteGuide('en/gdcluster/guide3')
    await saveGuide('en/a-relationship-with-Jesus/guide1', 'uno')
    await saveGuide('en/a-relationship-with-Jesus/guide2', 'dos')

    const keys = (await listGuides()).map((guide) => guide.key)
    expect(keys).toContain('en/a-relationship-with-Jesus/guide1')
    expect(keys).toContain('en/a-relationship-with-Jesus/guide2')
    expect(keys).not.toContain('en/gdcluster/guide3')
    // Orden por `savedAt` descendente (dos guías pueden compartir milisegundo).
    const times = (await listGuides()).map((guide) => guide.savedAt)
    expect([...times].sort((a, b) => b - a)).toEqual(times)
  })
})
