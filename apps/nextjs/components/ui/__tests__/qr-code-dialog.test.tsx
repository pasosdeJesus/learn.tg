import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

vi.mock('@pasosdejesus/m/shadcn-components/ui/dialog', () => {
  const D = ({ open, children }: any) => (open ? children : null)
  const Frag = ({ children }: any) => children
  return { Dialog: D, DialogContent: Frag, DialogDescription: Frag, DialogFooter: Frag, DialogHeader: Frag, DialogTitle: Frag }
})
vi.mock('@pasosdejesus/m/shadcn-components/ui/button', () => ({
  Button: ({ children, onClick, type, variant, className, size }: any) =>
    React.createElement('button', { onClick, type, className }, children),
  buttonVariants: () => '',
}))
vi.mock('@selfxyz/core', () => ({
  getUniversalLink: vi.fn(() => 'https://self.xyz/verify/test'),
}))

import React from 'react'
import { QRCodeDialog } from '@/components/ui/qr-code-dialog'

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

  it('shows QR code wrapper on desktop (not mobile)', () => {
    render(<QRCodeDialog {...defaultProps} />)
    expect(screen.getByTestId('mock-qr-wrapper')).toBeInTheDocument()
  })

  it('calls onOpenChange when cancel button is clicked', () => {
    render(<QRCodeDialog {...defaultProps} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
  })

  it('handles QR wrapper success', () => {
    render(<QRCodeDialog {...defaultProps} />)
    fireEvent.click(screen.getByText('Mock Success'))
    expect(defaultProps.onSuccess).toHaveBeenCalledTimes(1)
  })

  it('handles QR wrapper error with reason', () => {
    render(<QRCodeDialog {...defaultProps} />)
    fireEvent.click(screen.getByText('Mock Error With Reason'))
    expect(defaultProps.onError).toHaveBeenCalledWith('Mock Error With Reason')
  })

  it('handles QR wrapper error without reason', () => {
    render(<QRCodeDialog {...defaultProps} />)
    fireEvent.click(screen.getByText('Mock Error Without Reason'))
    expect(defaultProps.onError).toHaveBeenCalledWith('Verification failed')
  })

  it('does not render QR wrapper when selfApp is null', () => {
    render(<QRCodeDialog {...defaultProps} selfApp={null} />)
    expect(screen.queryByTestId('mock-qr-wrapper')).not.toBeInTheDocument()
  })
})
