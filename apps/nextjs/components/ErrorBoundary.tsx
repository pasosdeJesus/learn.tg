'use client'

import { Component, type ReactNode } from 'react'
import { logger } from '@pasosdejesus/m/debug'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  /** Mensaje del error, para poder diagnosticarlo (se muestra fuera de producción). */
  detail?: string
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, detail: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }
  }

  componentDidCatch(error: unknown) {
    // El reporte del operador (2026-09-23) solo decía "Connection Error": sin la causa
    // no se puede arreglar. Queda en la consola (y en el DebugConsole con ?debug=1).
    logger.error(`ErrorBoundary: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`, 'ErrorBoundary')
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-6">
          <div className="max-w-md text-center space-y-4">
            <h2 className="text-xl font-semibold text-gray-800">Connection Error</h2>
            {process.env.NODE_ENV !== 'production' && this.state.detail && (
              <p className="text-xs text-red-700 break-words" data-testid="error-boundary-detail">
                {this.state.detail}
              </p>
            )}
            <p className="text-sm text-gray-600">
              A wallet connection error occurred. Please try:
            </p>
            <ul className="text-sm text-gray-500 space-y-1 text-left list-disc pl-6">
              <li>Refreshing the page</li>
              <li>Ensuring your wallet extension is enabled</li>
              <li>Using a different wallet (OneKey, MetaMask, or WalletConnect)</li>
            </ul>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.reload() }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
