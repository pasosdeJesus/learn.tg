import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QRCodeDialog } from '@/components/ui/qr-code-dialog'

// Mock the SelfQRcodeWrapper component
vi.mock('@selfxyz/qrcode', () => ({
  SelfQRcodeWrapper: ({ onSuccess, onError }: any) => (
    <div data-testid="mock-qr-wrapper">
      <button onClick={() => onSuccess()}>Mock Success</button>
      <button onClick={() => onError({ message: 'Mock Error' })}>Mock Error</button>
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
    isMobile: false,
    onMobileVerify: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dialog when open', () => {
    render(<QRCodeDialog {...defaultProps} />)
    
    expect(screen.getByText('Verify with Self')).toBeInTheDocument()
    expect(screen.getByText(/Open the Self application on your phone/)).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<QRCodeDialog {...defaultProps} open={false} />)
    
    expect(screen.queryByText('Verify with Self')).not.toBeInTheDocument()
  })

  it('shows QR code wrapper for desktop', () => {
    render(<QRCodeDialog {...defaultProps} isMobile={false} />)
    
    expect(screen.getByTestId('mock-qr-wrapper')).toBeInTheDocument()
    expect(screen.queryByText('Open Self App')).not.toBeInTheDocument()
  })

  it('shows mobile button for mobile devices', () => {
    render(<QRCodeDialog {...defaultProps} isMobile={true} />)
    
    expect(screen.getByText('Open Self App')).toBeInTheDocument()
    expect(screen.queryByTestId('mock-qr-wrapper')).not.toBeInTheDocument()
  })

  it('shows correct instructions for mobile', () => {
    render(<QRCodeDialog {...defaultProps} isMobile={true} />)
    
    expect(screen.getByText(/Tap the button below to open the Self application/)).toBeInTheDocument()
  })

  it('calls onMobileVerify when mobile button is clicked', () => {
    render(<QRCodeDialog {...defaultProps} isMobile={true} />)
    
    const mobileButton = screen.getByText('Open Self App')
    fireEvent.click(mobileButton)
    
    expect(defaultProps.onMobileVerify).toHaveBeenCalledTimes(1)
  })

  it('calls onOpenChange when cancel button is clicked', () => {
    render(<QRCodeDialog {...defaultProps} />)
    
    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)
    
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
  })

  it('handles QR wrapper success', () => {
    render(<QRCodeDialog {...defaultProps} isMobile={false} />)
    
    const successButton = screen.getByText('Mock Success')
    fireEvent.click(successButton)
    
    expect(defaultProps.onSuccess).toHaveBeenCalledTimes(1)
  })

  it('handles QR wrapper error', () => {
    render(<QRCodeDialog {...defaultProps} isMobile={false} />)
    
    const errorButton = screen.getByText('Mock Error')
    fireEvent.click(errorButton)
    
    expect(defaultProps.onError).toHaveBeenCalledWith('Mock Error')
  })

  it('handles QR wrapper error without message', () => {
    const mockSelfApp = { mockApp: true }
    
    // Re-mock to test error without message
    vi.doMock('@selfxyz/qrcode', () => ({
      SelfQRcodeWrapper: ({ onError }: any) => (
        <button onClick={() => onError()}>Mock Error No Message</button>
      ),
    }))

    render(<QRCodeDialog {...defaultProps} selfApp={mockSelfApp} isMobile={false} />)
    
    const errorButton = screen.getByText('Mock Error No Message')
    fireEvent.click(errorButton)
    
    expect(defaultProps.onError).toHaveBeenCalledWith('Verification failed')
  })

  it('does not render QR wrapper when selfApp is null', () => {
    render(<QRCodeDialog {...defaultProps} selfApp={null} isMobile={false} />)
    
    expect(screen.queryByTestId('mock-qr-wrapper')).not.toBeInTheDocument()
  })
})
