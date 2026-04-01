import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DonationSuccessAlert } from '../DonationSuccessAlert'

// Mock de los componentes de UI para simplificar pruebas
vi.mock('@/components/ui/alert', () => ({
  Alert: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="alert" className={className}>
      {children}
    </div>
  ),
  AlertDescription: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-description">{children}</div>
  ),
  AlertTitle: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-title">{children}</div>
  ),
}))

describe('DonationSuccessAlert', () => {
  it('renders with Spanish text when lang="es"', () => {
    const mockOnClose = vi.fn()
    render(<DonationSuccessAlert increment={100} onClose={mockOnClose} lang="es" />)

    expect(screen.getByTestId('alert')).toBeInTheDocument()
    expect(screen.getByTestId('alert-title')).toHaveTextContent('¡Donación Exitosa!')
    expect(screen.getByTestId('alert-description')).toHaveTextContent(
      'Has ganado 100 puntos de aprendizaje.',
    )
  })

  it('renders with English text when lang="en"', () => {
    const mockOnClose = vi.fn()
    render(<DonationSuccessAlert increment={50} onClose={mockOnClose} lang="en" />)

    expect(screen.getByTestId('alert-title')).toHaveTextContent('Donation Successful!')
    expect(screen.getByTestId('alert-description')).toHaveTextContent(
      'You have earned 50 learning points.',
    )
  })

  it('renders with correct increment value in text', () => {
    const mockOnClose = vi.fn()
    render(<DonationSuccessAlert increment={1234} onClose={mockOnClose} lang="en" />)

    expect(screen.getByTestId('alert-description')).toHaveTextContent('1234')
  })

  it('calls onClose when close button is clicked', () => {
    const mockOnClose = vi.fn()
    render(<DonationSuccessAlert increment={100} onClose={mockOnClose} lang="en" />)

    const closeButton = screen.getByRole('button', { name: /×/ })
    fireEvent.click(closeButton)

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('applies correct CSS classes', () => {
    const mockOnClose = vi.fn()
    render(<DonationSuccessAlert increment={100} onClose={mockOnClose} lang="en" />)

    const alert = screen.getByTestId('alert')
    expect(alert).toHaveClass('fixed')
    expect(alert).toHaveClass('top-5')
    expect(alert).toHaveClass('right-5')
    expect(alert).toHaveClass('bg-green-100')
    expect(alert).toHaveClass('border-green-400')
    expect(alert).toHaveClass('text-green-700')
  })
})