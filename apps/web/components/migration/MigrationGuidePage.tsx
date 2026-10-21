import { readMigrationGuide, migrationGuideHtml } from '@/lib/migration-guide'

/**
 * Página pública de la guía de migración (R-#270): lee el Markdown del repositorio
 * y lo sirve. Sin sesión, sin base de datos y sin API: es un enlace que se comparte
 * por WhatsApp y debe abrir para cualquiera (y quedar en la caché del service worker,
 * porque la ruta vive bajo `/{lang}/*`).
 */
export default async function MigrationGuidePage({ lang }: { lang: string }) {
  const markdown = await readMigrationGuide(lang)
  const html = migrationGuideHtml(markdown)

  return (
    <main className="container mx-auto py-8 px-4 max-w-3xl">
      <article
        className="migration-guide text-gray-800"
        data-testid="migration-guide"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  )
}
