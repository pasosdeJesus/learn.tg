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
    globals: false,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
    deps: {
      inline: ['lz-string'],
    },
  },
  server: {},
  esbuild: {
    // Asegura runtime JSX automático para no requerir import manual de React
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
})
