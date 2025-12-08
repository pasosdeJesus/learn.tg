import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { remarkFillInTheBlank } from '@/lib/remarkFillInTheBlank.mjs'

describe('remarkFillInTheBlank', () => {
  // Dummy position object to satisfy the transformer's expectations
  const dummyPosition = {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 1, offset: 0 }
  }

  beforeEach(() => {
    // Clear global state before each test
    if ((globalThis as any).fillInTheBlank) {
      (globalThis as any).fillInTheBlank.length = 0
    } else {
      (globalThis as any).fillInTheBlank = []
    }
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should be a function', () => {
    expect(typeof remarkFillInTheBlank).toBe('function')
  })

  it('should return a transformer function', () => {
    const transformer = remarkFillInTheBlank({})
    expect(typeof transformer).toBe('function')
  })

  it('should populate (globalThis as any).fillInTheBlank with clues and answers', () => {
    const transformer = remarkFillInTheBlank({})

    // Create a mock AST tree that matches the expected structure
    const mockTree = {
      children: [
        {
          type: 'list',
          ordered: true,
          children: [
            {
              type: 'listItem',
              children: [
                {
                  type: 'paragraph',
                  children: [
                    {
                      type: 'text',
                      value: 'A landscape mentioned in this reading is ___ (mountain)'
                    }
                  ]
                }
              ]
            },
            {
              type: 'listItem',
              children: [
                {
                  type: 'paragraph',
                  children: [
                    {
                      type: 'text',
                      value: 'Jesus had sent His disciples to ____ (Bethsaida)'
                    }
                  ]
                }
              ]
            }
          ],
          position: dummyPosition
        }
      ]
    }

    transformer(mockTree)

    expect((globalThis as any).fillInTheBlank).toHaveLength(2)
    expect((globalThis as any).fillInTheBlank[0]).toEqual({
      clue: 'A landscape mentioned in this reading is ___',
      answer: 'mountain'
    })
    expect((globalThis as any).fillInTheBlank[1]).toEqual({
      clue: 'Jesus had sent His disciples to ____',
      answer: 'Bethsaida'
    })
  })

  it('should handle text with extra spaces and parentheses', () => {
    const transformer = remarkFillInTheBlank({})

    const mockTree = {
      children: [
        {
          type: 'list',
          ordered: true,
          children: [
            {
              type: 'listItem',
              children: [
                {
                  type: 'paragraph',
                  children: [
                    {
                      type: 'text',
                      value: 'Test ___ (answer)'
                    }
                  ]
                }
              ]
            }
          ],
          position: dummyPosition
        }
      ]
    }

    transformer(mockTree)

    expect((globalThis as any).fillInTheBlank).toHaveLength(1)
    expect((globalThis as any).fillInTheBlank[0]).toEqual({
      clue: 'Test ___',
      answer: 'answer'
    })
  })

  it('should ignore non-matching lists', () => {
    const transformer = remarkFillInTheBlank({})

    const mockTree = {
      children: [
        {
          type: 'list',
          ordered: false, // unordered list should be ignored
          children: [],
          position: dummyPosition
        },
        {
          type: 'list',
          ordered: true,
          children: [
            {
              type: 'listItem',
              children: [
                {
                  type: 'paragraph',
                  children: [
                    {
                      type: 'text',
                      value: 'No blank here (just text)'
                    }
                  ]
                }
              ]
            }
          ],
          position: dummyPosition
        }
      ]
    }

    transformer(mockTree)

    // Should not populate (globalThis as any).fillInTheBlank because no blanks
    expect((globalThis as any).fillInTheBlank).toHaveLength(0)
  })

  it('should add button with url from options', () => {
    const transformer = remarkFillInTheBlank({ url: '/test-url' })

    const mockTree = {
      children: [
        {
          type: 'list',
          ordered: true,
          children: [
            {
              type: 'listItem',
              children: [
                {
                  type: 'paragraph',
                  children: [
                    {
                      type: 'text',
                      value: 'Test ___ (answer)'
                    }
                  ]
                }
              ]
            }
          ],
          position: dummyPosition
        }
      ]
    }

    transformer(mockTree)

    // Check that tree was modified (list replaced with paragraph containing button)
    expect(mockTree.children[0].type).toBe('paragraph')
    expect(mockTree.children[0].children[0].type).toBe('html')
    expect((mockTree.children[0].children[0] as any).value).toContain('href="/test-url"')
  })

  it('should handle empty options object', () => {
    const transformer = remarkFillInTheBlank({})

    const mockTree = {
      children: [
        {
          type: 'list',
          ordered: true,
          children: [
            {
              type: 'listItem',
              children: [
                {
                  type: 'paragraph',
                  children: [
                    {
                      type: 'text',
                      value: 'Test ___ (answer)'
                    }
                  ]
                }
              ]
            }
          ],
          position: dummyPosition
        }
      ]
    }

    transformer(mockTree)

    // Button should have empty href if no url in options
    expect((mockTree.children[0].children[0] as any).value).toContain('href=""')
  })

  it('should handle multiple blanks in same list', () => {
    const transformer = remarkFillInTheBlank({})

    const mockTree = {
      children: [
        {
          type: 'list',
          ordered: true,
          children: [
            {
              type: 'listItem',
              children: [
                {
                  type: 'paragraph',
                  children: [
                    {
                      type: 'text',
                      value: 'First ___ (one)'
                    }
                  ]
                }
              ]
            },
            {
              type: 'listItem',
              children: [
                {
                  type: 'paragraph',
                  children: [
                    {
                      type: 'text',
                      value: 'Second ___ (two)'
                    }
                  ]
                }
              ]
            },
            {
              type: 'listItem',
              children: [
                {
                  type: 'paragraph',
                  children: [
                    {
                      type: 'text',
                      value: 'Third ___ (three)'
                    }
                  ]
                }
              ]
            }
          ],
          position: dummyPosition
        }
      ]
    }

    transformer(mockTree)

    expect((globalThis as any).fillInTheBlank).toHaveLength(3)
    expect((globalThis as any).fillInTheBlank[2]).toEqual({
      clue: 'Third ___',
      answer: 'three'
    })
  })
})