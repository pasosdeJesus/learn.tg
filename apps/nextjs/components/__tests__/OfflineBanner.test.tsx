import * as React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { beforeEach, describe, it, expect, vi } from 'vitest'

const useOfflineStatusMock = vi.fn(() => ({ isOffline: false }))
vi.mock('@/lib/hooks/useOfflineStatus', () => ({
  useOfflineStatus: () => useOfflineStatusMock(),
}))

import { OfflineBanner } from '../OfflineBanner'

describe('OfflineBanner', () => {
  beforeEach(() => {
    useOfflineStatusMock.mockReturnValue({ isOffline: false })
  })

  it('renders nothing while online', () => {
    const { container } = render(<OfflineBanner lang="en" />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument()
  })

  it('shows the English message when offline', () => {
    useOfflineStatusMock.mockReturnValue({ isOffline: true })
    render(<OfflineBanner lang="en" />)
    expect(screen.getByTestId('offline-banner')).toHaveTextContent(/progress will be saved locally/i)
  })

  it('shows the Spanish message when offline', () => {
    useOfflineStatusMock.mockReturnValue({ isOffline: true })
    render(<OfflineBanner lang="es" />)
    expect(screen.getByTestId('offline-banner')).toHaveTextContent(/se guardará localmente/i)
  })
})
