'use client'

import { render, screen, fireEvent } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { CeloSupportStreamButton } from '../CeloSupportStreamButton'

jest.mock('next-auth/react')

describe('CeloSupportStreamButton', () => {
  const mockUseSession = useSession as jest.Mock

  it('should render the button in English', () => {
    mockUseSession.mockReturnValue({ data: null })
    render(<CeloSupportStreamButton lang="en" />)
    expect(screen.getByText('Claim Celo Support')).toBeInTheDocument()
  })

  it('should render the button in Spanish', () => {
    mockUseSession.mockReturnValue({ data: null })
    render(<CeloSupportStreamButton lang="es" />)
    expect(screen.getByText('Reclamar Apoyo de Celo')).toBeInTheDocument()
  })

  it('should disable the button when the user is not logged in', () => {
    mockUseSession.mockReturnValue({ data: null })
    render(<CeloSupportStreamButton />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('should enable the button when the user is logged in', () => {
    mockUseSession.mockReturnValue({ data: { user: { email: 'test@example.com' } } })
    render(<CeloSupportStreamButton />)
    expect(screen.getByRole('button')).not.toBeDisabled()
  })

  it('should show a success message when the claim is successful', async () => {
    mockUseSession.mockReturnValue({ data: { user: { email: 'test@example.com' } } })
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: 'Success!' }),
    })

    render(<CeloSupportStreamButton />)
    fireEvent.click(screen.getByRole('button'))

    expect(await screen.findByText('Success!')).toBeInTheDocument()
  })

  it('should show an error message when the claim fails', async () => {
    mockUseSession.mockReturnValue({ data: { user: { email: 'test@example.com' } } })
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ message: 'Error!' }),
    })

    render(<CeloSupportStreamButton />)
    fireEvent.click(screen.getByRole('button'))

    expect(await screen.findByText('Error!')).toBeInTheDocument()
  })
})
