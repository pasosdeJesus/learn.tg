import { describe, it, expect } from 'vitest'
import { guideProcessor } from '@/lib/guide-markdown.mjs'

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
