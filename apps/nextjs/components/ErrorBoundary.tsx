'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-6">
          <div className="max-w-md text-center space-y-4">
            <h2 className="text-xl font-semibold text-gray-800">Connection Error</h2>
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
