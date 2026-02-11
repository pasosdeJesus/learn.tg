/**
 * Crossword mocking utilities for tests
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

import { vi } from 'vitest'

/**
 * Creates mocks for fs/promises and node:fs/promises modules
 *
 * @param options Configuration options
 * @returns Object with mock functions and setup/cleanup utilities
 */
export function createFsMocks(options: {
  readFileContent?: string
  readFileError?: Error
} = {}) {
  const mockReadFile = vi.hoisted(() => vi.fn())
  const mockNodeReadFile = vi.hoisted(() => vi.fn())

  // Apply default implementations
  if (options.readFileContent !== undefined) {
    mockReadFile.mockResolvedValue(options.readFileContent)
    mockNodeReadFile.mockResolvedValue(options.readFileContent)
  } else {
    mockReadFile.mockResolvedValue('# Crossword Source\n\nTexto con blanks')
    mockNodeReadFile.mockResolvedValue('# Crossword Source (node namespace)')
  }

  if (options.readFileError !== undefined) {
    mockReadFile.mockRejectedValue(options.readFileError)
    mockNodeReadFile.mockRejectedValue(options.readFileError)
  }

  return {
    mockReadFile,
    mockNodeReadFile,

    /**
     * Setup vi.mock calls for fs modules
     * Call this in your test file's setup
     */
    setupFsMocks() {
      vi.mock('fs/promises', async (importOriginal) => {
        const actual: any = await importOriginal()
        return {
          ...actual,
          readFile: mockReadFile,
        }
      })

      vi.mock('node:fs/promises', () => ({
        readFile: mockNodeReadFile,
      }))
    },

    /**
     * Reset all mock implementations
     */
    resetFsMocks() {
      mockReadFile.mockReset()
      mockNodeReadFile.mockReset()
    },

    /**
     * Set common responses for fs mocks
     */
    setupCommonResponses() {
      mockReadFile.mockResolvedValue('# Crossword Source\n\nTexto con blanks')
      mockNodeReadFile.mockResolvedValue('# Crossword Source (node namespace)')
    },
  }
}

/**
 * Creates mock for remarkFillInTheBlank module
 *
 * @param fillInTheBlankData Array of fill-in-the-blank answers and clues
 * @returns Object with mock function and setup utility
 */
export function createRemarkFillInTheBlankMock(fillInTheBlankData: Array<{ answer: string; clue: string }> = [
  { answer: 'TEST', clue: 'A test word' },
  { answer: 'CODE', clue: 'Programming stuff' },
]) {
  const mockRemarkFillInTheBlank = vi.hoisted(() => vi.fn(() => () => {
    ;(global as any).fillInTheBlank = fillInTheBlankData
  }))

  return {
    mockRemarkFillInTheBlank,

    /**
     * Setup vi.mock call for remarkFillInTheBlank module
     */
    setupRemarkFillInTheBlankMock() {
      vi.mock('@/lib/remarkFillInTheBlank.mjs', () => ({
        remarkFillInTheBlank: mockRemarkFillInTheBlank,
      }))
    },

    /**
     * Reset mock implementation
     */
    resetRemarkFillInTheBlankMock() {
      mockRemarkFillInTheBlank.mockReset()
    },
  }
}

/**
 * Creates mock for crossword-layout-generator-with-isolated module
 *
 * @param options Configuration for generated layout
 * @returns Object with mock function and setup utility
 */
export function createCrosswordLayoutMock(options: {
  rows?: number
  cols?: number
  tableString?: string
} = {}) {
  const rows = options.rows || 5
  const cols = options.cols || 5
  const tableString = options.tableString || '-----<br>-----'

  const mockGenerateLayout = vi.hoisted(() => vi.fn((scrambled: any[]) => ({
    rows,
    cols,
    table: Array(rows).fill(null).map(() => Array(cols).fill('-')),
    table_string: tableString,
    result: scrambled.map((e, i) => ({
      answer: e.answer,
      clue: e.clue,
      startx: 1 + i,
      starty: 1,
      orientation: i % 2 === 0 ? 'across' : 'down',
    })),
  })))

  return {
    mockGenerateLayout,

    /**
     * Setup vi.mock call for crossword-layout-generator-with-isolated module
     */
    setupCrosswordLayoutMock() {
      vi.mock('crossword-layout-generator-with-isolated', () => ({
        __esModule: true,
        default: {
          generateLayout: mockGenerateLayout,
        },
      }))
    },

    /**
     * Reset mock implementation
     */
    resetCrosswordLayoutMock() {
      mockGenerateLayout.mockReset()
    },

    /**
     * Set common response for layout generator
     */
    setupCommonResponse() {
      mockGenerateLayout.mockImplementation((scrambled: any[]) => ({
        rows,
        cols,
        table: Array(rows).fill(null).map(() => Array(cols).fill('-')),
        table_string: tableString,
        result: scrambled.map((e, i) => ({
          answer: e.answer,
          clue: e.clue,
          startx: 1 + i,
          starty: 1,
          orientation: i % 2 === 0 ? 'across' : 'down',
        })),
      }))
    },
  }
}

/**
 * Pre-configured mocks for crossword API tests
 */
export const crosswordMocks = {
  fs: createFsMocks(),
  remarkFillInTheBlank: createRemarkFillInTheBlankMock(),
  crosswordLayout: createCrosswordLayoutMock(),
}

/**
 * Setup all crossword-related mocks at once
 * Call this in your test file's beforeAll
 */
export function setupCrosswordMocks() {
  crosswordMocks.fs.setupFsMocks()
  crosswordMocks.remarkFillInTheBlank.setupRemarkFillInTheBlankMock()
  crosswordMocks.crosswordLayout.setupCrosswordLayoutMock()
}

/**
 * Reset all crossword-related mocks
 * Call this in your test file's beforeEach
 */
export function resetCrosswordMocks() {
  crosswordMocks.fs.resetFsMocks()
  crosswordMocks.remarkFillInTheBlank.resetRemarkFillInTheBlankMock()
  crosswordMocks.crosswordLayout.resetCrosswordLayoutMock()
  crosswordMocks.fs.setupCommonResponses()
  crosswordMocks.crosswordLayout.setupCommonResponse()
}