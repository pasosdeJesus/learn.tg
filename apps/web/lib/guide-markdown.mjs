import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { remarkFillInTheBlank } from './remarkFillInTheBlank.mjs'
import { remarkMermaid } from './remarkMermaid.mjs'

/**
 * @param {{ url?: string, lang?: string, fillInTheBlank?: boolean,
 *   allowDangerousHtml?: boolean, mermaid?: boolean }} [options]
 */
export function guideProcessor({
  url = '',
  lang,
  fillInTheBlank = false,
  allowDangerousHtml = true,
  mermaid = true,
} = {}) {
  let processor = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter)

  if (mermaid) {
    processor = processor.use(remarkMermaid, {
      alt: lang === 'es' ? 'Diagrama' : 'Diagram',
    })
  }

  if (fillInTheBlank) {
    processor = processor.use(remarkFillInTheBlank, { url, lang })
  }

  const rehypeOptions = allowDangerousHtml ? { allowDangerousHtml: true } : {}

  return processor
    .use(remarkRehype, rehypeOptions)
    .use(rehypeStringify, rehypeOptions)
}
