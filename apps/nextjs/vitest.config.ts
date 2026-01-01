import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      'lz-string': path.resolve(__dirname, './__mocks__/lz-string.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    deps: {
      inline: ['lz-string'],
    },
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
    onConsoleLog: (log, type) => type !== 'stderr',
  },
  esbuild: {
    // Asegura runtime JSX automático para no requerir import manual de React
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
})
