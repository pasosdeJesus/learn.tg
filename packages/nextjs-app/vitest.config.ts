import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
  esbuild: {
    // Asegura runtime JSX automático para no requerir import manual de React
    jsx: 'automatic',
    jsxImportSource: 'react'
  }
})
