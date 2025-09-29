// Setup global para pruebas
import '@testing-library/jest-dom'
import React from 'react'
import { vi } from 'vitest'

// Hacer React accesible si algún transform no inyecta automáticamente
// (Vitest + esbuild jsx automatic normalmente no lo requiere, pero por seguridad)
// @ts-ignore
global.React = React

// Mock liviano de RainbowKit para pruebas evitando lógica interna compleja
vi.mock('@rainbow-me/rainbowkit', () => {
  return {
    RainbowKitProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    ConnectButton: () => React.createElement('button', null, 'Connect Wallet')
  }
})

// Silenciar logs ruidosos de las rutas API durante pruebas
const originalError = console.error
console.error = (...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].includes('ECONNREFUSED')) {
    return
  }
  originalError(...args)
}
