// Guía de migración servida (R-#270 §3.3.2): el documento vive en el repositorio y
// se convierte con el mismo pipeline de remark que las guías de curso.

import { describe, it, expect } from 'vitest'
import { migrationGuideFile, migrationGuideHtml, readMigrationGuide } from '../migration-guide'

describe('migration guide', () => {
  it('resolves the document per language (English by default)', () => {
    expect(migrationGuideFile('en')).toMatch(/doc\/migration-in-app-wallet\/en\.md$/)
    expect(migrationGuideFile('es')).toMatch(/doc\/migration-in-app-wallet\/es\.md$/)
    expect(migrationGuideFile('fr')).toMatch(/en\.md$/)
  })

  it('reads both languages', async () => {
    expect(await readMigrationGuide('en')).toMatch(/Move your wallet into learn\.tg/)
    expect(await readMigrationGuide('es')).toMatch(/Pasa tu billetera a learn\.tg/)
  })

  it('converts the guide to HTML with headings and tables', async () => {
    const html = migrationGuideHtml(await readMigrationGuide('en'))
    expect(html).toContain('<h1>')
    expect(html).toContain('<table>')
    expect(html).toContain('recovery phrase')
    // El enlace compartido por WhatsApp debe existir en la guía publicada.
    expect(html).not.toContain('learn.tg/migracion"')
  })
})
