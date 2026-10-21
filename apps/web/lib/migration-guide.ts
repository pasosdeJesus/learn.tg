import { readFile } from 'fs/promises'
import path from 'path'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'

/**
 * Guía de migración servida (R-#270 §3.3.2).
 *
 * El documento vive en el repositorio, versionado, y se sirve como página pública
 * en `/en/migration-in-app-wallet` y `/es/migracion-billetera-app`. Se convierte
 * con el mismo pipeline de remark que las guías de curso (`app/[lang]/[pathPrefix]`).
 */
const GUIDE_DIR = path.join(process.cwd(), '..', '..', 'doc', 'migration-in-app-wallet')

/** Archivo de la guía para un idioma (español sólo con `es`; el resto, inglés). */
export function migrationGuideFile(lang: string): string {
  return path.join(GUIDE_DIR, lang === 'es' ? 'es.md' : 'en.md')
}

export async function readMigrationGuide(lang: string): Promise<string> {
  return readFile(migrationGuideFile(lang), 'utf8')
}

/** Markdown a HTML con el pipeline compartido (el documento es nuestro: es confiable). */
export function migrationGuideHtml(md: string): string {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .processSync(md)
    .toString()
}
