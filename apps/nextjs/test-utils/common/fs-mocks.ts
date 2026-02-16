/**
 * File system mocking utilities for tests
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