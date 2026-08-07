import { defineConfig } from 'vitest/config'
import path from 'path'

const modulesDir = path.resolve(__dirname, 'node_modules')
const radixDir = path.join(modulesDir, '@radix-ui')

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      // React — una sola instancia desde el node_modules de learn.tg
      'react': path.join(modulesDir, 'react'),
      'react-dom': path.join(modulesDir, 'react-dom'),
      'viem': path.join(modulesDir, 'viem'),
      // Radix UI
      '@radix-ui/react-accordion': path.join(radixDir, 'react-accordion'),
      '@radix-ui/react-alert-dialog': path.join(radixDir, 'react-alert-dialog'),
      '@radix-ui/react-arrow': path.join(radixDir, 'react-arrow'),
      '@radix-ui/react-avatar': path.join(radixDir, 'react-avatar'),
      '@radix-ui/react-checkbox': path.join(radixDir, 'react-checkbox'),
      '@radix-ui/react-collection': path.join(radixDir, 'react-collection'),
      '@radix-ui/react-compose-refs': path.join(radixDir, 'react-compose-refs'),
      '@radix-ui/react-context': path.join(radixDir, 'react-context'),
      '@radix-ui/react-dialog': path.join(radixDir, 'react-dialog'),
      '@radix-ui/react-direction': path.join(radixDir, 'react-direction'),
      '@radix-ui/react-dismissable-layer': path.join(radixDir, 'react-dismissable-layer'),
      '@radix-ui/react-dropdown-menu': path.join(radixDir, 'react-dropdown-menu'),
      '@radix-ui/react-focus-guards': path.join(radixDir, 'react-focus-guards'),
      '@radix-ui/react-focus-scope': path.join(radixDir, 'react-focus-scope'),
      '@radix-ui/react-id': path.join(radixDir, 'react-id'),
      '@radix-ui/react-label': path.join(radixDir, 'react-label'),
      '@radix-ui/react-menu': path.join(radixDir, 'react-menu'),
      '@radix-ui/react-menubar': path.join(radixDir, 'react-menubar'),
      '@radix-ui/react-popover': path.join(radixDir, 'react-popover'),
      '@radix-ui/react-popper': path.join(radixDir, 'react-popper'),
      '@radix-ui/react-portal': path.join(radixDir, 'react-portal'),
      '@radix-ui/react-presence': path.join(radixDir, 'react-presence'),
      '@radix-ui/react-primitive': path.join(radixDir, 'react-primitive'),
      '@radix-ui/react-progress': path.join(radixDir, 'react-progress'),
      '@radix-ui/react-radio-group': path.join(radixDir, 'react-radio-group'),
      '@radix-ui/react-roving-focus': path.join(radixDir, 'react-roving-focus'),
      '@radix-ui/react-scroll-area': path.join(radixDir, 'react-scroll-area'),
      '@radix-ui/react-select': path.join(radixDir, 'react-select'),
      '@radix-ui/react-separator': path.join(radixDir, 'react-separator'),
      '@radix-ui/react-slider': path.join(radixDir, 'react-slider'),
      '@radix-ui/react-slot': path.join(radixDir, 'react-slot'),
      '@radix-ui/react-switch': path.join(radixDir, 'react-switch'),
      '@radix-ui/react-tabs': path.join(radixDir, 'react-tabs'),
      '@radix-ui/react-toast': path.join(radixDir, 'react-toast'),
      '@radix-ui/react-toggle': path.join(radixDir, 'react-toggle'),
      '@radix-ui/react-tooltip': path.join(radixDir, 'react-tooltip'),
      '@radix-ui/react-use-callback-ref': path.join(radixDir, 'react-use-callback-ref'),
      '@radix-ui/react-use-controllable-state': path.join(radixDir, 'react-use-controllable-state'),
      '@radix-ui/react-use-escape-keydown': path.join(radixDir, 'react-use-escape-keydown'),
      '@radix-ui/react-use-layout-effect': path.join(radixDir, 'react-use-layout-effect'),
      '@radix-ui/react-use-previous': path.join(radixDir, 'react-use-previous'),
      '@radix-ui/react-use-rect': path.join(radixDir, 'react-use-rect'),
      '@radix-ui/react-use-size': path.join(radixDir, 'react-use-size'),
      '@radix-ui/react-visually-hidden': path.join(radixDir, 'react-visually-hidden'),
      'lucide-react': path.join(modulesDir, 'lucide-react'),
      'react-hook-form': path.join(modulesDir, 'react-hook-form'),
      'react-remove-scroll': path.join(modulesDir, 'react-remove-scroll'),
      'class-variance-authority': path.join(modulesDir, 'class-variance-authority'),
      'clsx': path.join(modulesDir, 'clsx'),
      'tailwind-merge': path.join(modulesDir, 'tailwind-merge'),
    },
    dedupe: ['react', 'react-dom'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    hookTimeout: 30000,
    server: {
      deps: {
        inline: ['lz-string', '@pasosdejesus/m'],
      },
    },
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
    onConsoleLog: (log, type) => type !== 'stderr',
    // Excluir E2E tests — requieren servidor corriendo (solo CI)
    exclude: ['e2e/**', 'node_modules/**'],
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
})
