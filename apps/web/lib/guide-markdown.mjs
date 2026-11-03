import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { remarkFillInTheBlank } from './remarkFillInTheBlank.mjs'

/**
 * @param {{ url?: string, lang?: string, fillInTheBlank?: boolean,
 *   allowDangerousHtml?: boolean }} [options]
 */
export function guideProcessor({
  url = '',
  lang,
  fillInTheBlank = false,
  allowDangerousHtml = true,
} = {}) {
  let processor = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter)

  if (fillInTheBlank) {
    processor = processor.use(remarkFillInTheBlank, { url, lang })
  }

  const rehypeOptions = allowDangerousHtml ? { allowDangerousHtml: true } : {}

  return processor
    .use(remarkRehype, rehypeOptions)
    .use(rehypeStringify, rehypeOptions)
}
