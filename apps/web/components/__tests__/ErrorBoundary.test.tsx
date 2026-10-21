// @vitest-environment jsdom
import * as React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// La página de error global decía solo "Connection Error": sin la causa no se puede
// arreglar lo que la dispara (reporte del operador en un iPhone/Android, 2026-09-23).
vi.mock('@pasosdejesus/m/debug', () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}))

import { ErrorBoundary } from '../ErrorBoundary'
import { logger } from '@pasosdejesus/m/debug'

function Boom(): React.ReactNode {
  throw new Error('eth_requestAccounts is not available')
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the fallback and logs the cause', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Connection Error')).toBeInTheDocument()
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('eth_requestAccounts is not available'),
      'ErrorBoundary',
    )
  })

  it('shows the message outside production so it can be reported', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )

    expect(screen.getByTestId('error-boundary-detail')).toHaveTextContent(
      'eth_requestAccounts is not available',
    )
  })

  it('renders the children when nothing fails', () => {
    render(
      <ErrorBoundary>
        <p>contenido</p>
      </ErrorBoundary>,
    )

    expect(screen.getByText('contenido')).toBeInTheDocument()
  })
})
