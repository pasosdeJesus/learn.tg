// Setup global para pruebas
import '@testing-library/jest-dom/vitest'
import React from 'react'
import { vi } from 'vitest'

// Hacer React accesible si algún transform no inyecta automáticamente
// (Vitest + esbuild jsx automatic normalmente no lo requiere, pero por seguridad)
// @ts-ignore
global.React = React

// Mock liviano de RainbowKit para pruebas evitando lógica interna compleja
vi.mock('@rainbow-me/rainbowkit', () => {
  return {
    RainbowKitProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    ConnectButton: () => React.createElement('button', null, 'Connect Wallet'),
  }
})

// Silenciar logs ruidosos de las rutas API y del modal durante pruebas
const originalError = console.error
const originalLog = console.log
const originalWarn = console.warn
const NOISY_PATTERNS = [
  'ECONNREFUSED',
  'crossword GET req=',
  'Donating raw (scaled) amount:',
  '** fname=',
  '** cwd=',
]
function shouldSilence(arg: any) {
  return typeof arg === 'string' && NOISY_PATTERNS.some((p) => arg.includes(p))
}
console.error = (...args: any[]) => {
  if (args.some(shouldSilence)) return
  originalError(...args)
}
console.log = (...args: any[]) => {
  if (args.some(shouldSilence)) return
  originalLog(...args)
}
console.warn = (...args: any[]) => {
  if (args.some(shouldSilence)) return
  originalWarn(...args)
}

// Mock lz-string to avoid CommonJS/ES module compatibility issues
vi.mock('lz-string', () => ({
  compressToEncodedURIComponent: vi.fn((input) => input),
  decompressFromEncodedURIComponent: vi.fn((input) => input),
}))

// Mock @goodsdks/citizen-sdk to avoid lz-string import issues
vi.mock('@goodsdks/citizen-sdk', () => ({
  ClaimSDK: vi.fn(),
  useIdentitySDK: vi.fn(),
}))
