/**
 * Crossword mocking utilities for tests
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

import { vi } from 'vitest'
import { createFsMocks } from '@pasosdejesus/m/test-utils/fs-mocks'

/**
 * Creates mock for remarkFillInTheBlank module
 *
 * @param fillInTheBlankData Array of fill-in-the-blank answers and clues
 * @returns Object with mock function and setup utility
 */
function createRemarkFillInTheBlankMock(fillInTheBlankData: Array<{ answer: string; clue: string }> = [
  { answer: 'TEST', clue: 'A test word' },
  { answer: 'CODE', clue: 'Programming stuff' },
]) {
  const mockRemarkFillInTheBlank = vi.fn(() => () => {
    ;(global as any).fillInTheBlank = fillInTheBlankData
  })

  return {
    mockRemarkFillInTheBlank,

    /**
     * @deprecated `vi.mock()` no se hoistea desde una función importada (Vitest 3).
     * El `vi.mock` de este módulo vive a module scope en `vitest.setup.ts`.
     */
    setupRemarkFillInTheBlankMock() {
      // no-op: conservado por compatibilidad.
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
function createCrosswordLayoutMock(options: {
  rows?: number
  cols?: number
  tableString?: string
} = {}) {
  const rows = options.rows || 5
  const cols = options.cols || 5
  const tableString = options.tableString || '-----<br>-----'

  const mockGenerateLayout = vi.fn((scrambled: any[]) => ({
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

  return {
    mockGenerateLayout,

    /**
     * @deprecated `vi.mock()` no se hoistea desde una función importada (Vitest 3).
     * El `vi.mock` de este módulo vive a module scope en `vitest.setup.ts`.
     */
    setupCrosswordLayoutMock() {
      // no-op: conservado por compatibilidad.
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