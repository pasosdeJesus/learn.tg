import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
    dedupe: ['react', 'react-dom'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    hookTimeout: 30000,
    deps: {
      inline: ['lz-string', '@pasosdejesus/m'],
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
