import { describe, it, expect } from 'vitest'
import { guideProcessor } from '@/lib/guide-markdown.mjs'
import {
  diagramId,
  diagramUrl,
  extractMermaidDiagrams,
} from '@/lib/remarkMermaid.mjs'

describe('guideProcessor', () => {
  it('keeps scripture references with a colon intact', () => {
    const html = guideProcessor()
      .processSync('Ecclesiastes 4:12 says a cord of three strands is not quickly broken.')
      .toString()

    expect(html).toContain('Ecclesiastes 4:12')
    expect(html).not.toContain('<div')
  })

  it('keeps times and ratios intact', () => {
    const html = guideProcessor().processSync('At 10:30 the ratio is 1:3.').toString()

    expect(html).toContain('10:30')
    expect(html).toContain('1:3')
  })

  it('renders emphasis, links and images', () => {
    const html = guideProcessor()
      .processSync('**bold** and [a link](/en/x) ![img](/img/a.jpg)')
      .toString()

    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('href="/en/x"')
    expect(html).toContain('src="/img/a.jpg"')
  })

  it('escapes raw html when allowDangerousHtml is false', () => {
    const html = guideProcessor({ allowDangerousHtml: false })
      .processSync('a <span>tag</span>')
      .toString()

    expect(html).not.toContain('<span>tag</span>')
  })

  it('exposes the fill in the blank questions and adds the puzzle link', () => {
    const processor = guideProcessor({
      url: '/en/course/guide1/test',
      lang: 'en',
      fillInTheBlank: true,
    })
    const file = processor.processSync(
      '## Questions\n\n1. An ___ spoke to Philip. (angel)\n\n2. The queen was ___. (Candace)\n',
    )
    const html = file.toString()

    expect((file.data as any).fillInTheBlank).toEqual([
      { clue: 'An ___ spoke to Philip.', answer: 'angel' },
      { clue: 'The queen was ___.', answer: 'Candace' },
    ])
    expect(html).toContain('/en/course/guide1/test')
    expect(html).toContain('Solve a puzzle')
  })
})

describe('mermaid diagrams', () => {
  const source = 'flowchart LR\n  A[Church] --> B[Cluster]'
  const fence = '```mermaid Three churches form a cluster\n' + source + '\n```\n'

  it('turns a mermaid fence into an image of the generated SVG', () => {
    const html = guideProcessor().processSync(fence).toString()

    expect(html).toContain(`src="${diagramUrl(source)}"`)
    expect(html).toContain('alt="Three churches form a cluster"')
    expect(html).not.toContain('language-mermaid')
    expect(html).not.toContain('<svg')
  })

  it('keeps the diagram when raw html is not allowed (course page)', () => {
    const html = guideProcessor({ allowDangerousHtml: false }).processSync(fence).toString()

    expect(html).toContain(diagramUrl(source))
  })

  it('survives the second render the guide page does over the api html', () => {
    const once = guideProcessor().processSync(fence).toString()
    const twice = guideProcessor().processSync(once).toString()

    expect(twice).toContain(diagramUrl(source))
  })

  it('falls back to the nearest heading as alt text', () => {
    const html = guideProcessor()
      .processSync('## The three-year cycle\n\n```mermaid\n' + source + '\n```\n')
      .toString()

    expect(html).toContain('alt="The three-year cycle"')
  })

  it('leaves other languages and the option to disable the plugin alone', () => {
    const other = guideProcessor().processSync('```js\nconst a = 1\n```\n').toString()
    expect(other).toContain('language-js')

    const off = guideProcessor({ mermaid: false }).processSync(fence).toString()
    expect(off).toContain('language-mermaid')
  })

  it('extracts the same id the renderer uses', () => {
    const diagrams = extractMermaidDiagrams(
      `# Guide\n\n${fence}\n\n\`\`\`mermaid\nsequenceDiagram\n  A->>B: hi\n\`\`\`\n`,
    )

    expect(diagrams.map((d) => d.source)).toEqual([
      source,
      'sequenceDiagram\n  A->>B: hi',
    ])
    expect(diagrams[0].line).toBe(3)
    expect(diagrams[0].alt).toBe('Three churches form a cluster')
    expect(diagramUrl(diagrams[1].source)).toContain(diagrams[1].id)
  })

  it('ignores the trailing spaces and line endings when hashing', () => {
    expect(diagramId('flowchart LR   \r\n  A-->B')).toBe(diagramId('flowchart LR\n  A-->B'))
  })
})
