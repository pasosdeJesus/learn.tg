import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock shadcn dialog to avoid React version mismatches
vi.mock('@pasosdejesus/m/shadcn-components/ui/dialog', () => {
  const D = ({ open, children }: any) => (open ? children : null)
  const Frag = ({ children }: any) => children
  return { Dialog: D, DialogContent: Frag, DialogDescription: Frag, DialogFooter: Frag, DialogHeader: Frag, DialogTitle: Frag }
})
vi.mock('@pasosdejesus/m/shadcn-components/ui/button', () => ({
  Button: ({ children, onClick, type }: any) =>
    React.createElement('button', { onClick, type }, children),
  buttonVariants: () => '',
}))

import React from 'react'
import { QRCodeDialog } from '@/components/ui/qr-code-dialog'

// Mock the SelfQRcodeWrapper component to cover all cases
vi.mock('@selfxyz/qrcode', () => ({
  SelfQRcodeWrapper: ({ onSuccess, onError }: any) => (
    <div data-testid="mock-qr-wrapper">
      <button onClick={() => onSuccess()}>Mock Success</button>
      <button onClick={() => onError({ reason: 'Mock Error With Reason' })}>
        Mock Error With Reason
      </button>
      <button onClick={() => onError()}>Mock Error Without Reason</button>
    </div>
  ),
}))

describe('QRCodeDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    selfApp: { mockApp: true },
    onSuccess: vi.fn(),
    onError: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dialog when open', () => {
    const { container } = render(<QRCodeDialog {...defaultProps} />)

    expect(container.textContent).toContain('Verify with Self')
  })

  it('does not render when closed', () => {
    render(<QRCodeDialog {...defaultProps} open={false} />)

    expect(screen.queryByText('Verify with Self')).not.toBeInTheDocument()
  })

  it('shows QR code wrapper when selfApp is provided', () => {
    render(<QRCodeDialog {...defaultProps} />)

    expect(screen.getByTestId('mock-qr-wrapper')).toBeInTheDocument()
  })

  it('calls onOpenChange when cancel button is clicked', () => {
    render(<QRCodeDialog {...defaultProps} />)

    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
  })

  it('handles QR wrapper success', () => {
    render(<QRCodeDialog {...defaultProps} />)

    const successButton = screen.getByText('Mock Success')
    fireEvent.click(successButton)

    expect(defaultProps.onSuccess).toHaveBeenCalledTimes(1)
  })

  it('handles QR wrapper error with reason', () => {
    render(<QRCodeDialog {...defaultProps} />)

    const errorButton = screen.getByText('Mock Error With Reason')
    fireEvent.click(errorButton)

    expect(defaultProps.onError).toHaveBeenCalledWith('Mock Error With Reason')
  })

  it('handles QR wrapper error without reason', () => {
    render(<QRCodeDialog {...defaultProps} />)

    const errorButton = screen.getByText('Mock Error Without Reason')
    fireEvent.click(errorButton)

    expect(defaultProps.onError).toHaveBeenCalledWith('Verification failed')
  })

  it('does not render QR wrapper when selfApp is null', () => {
    render(<QRCodeDialog {...defaultProps} selfApp={null} />)

    expect(screen.queryByTestId('mock-qr-wrapper')).not.toBeInTheDocument()
  })
})
