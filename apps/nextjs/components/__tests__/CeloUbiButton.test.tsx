'use client'

import { render, screen, fireEvent, act } from '@testing-library/react'
import { CeloUbiButton } from '@/components/CeloUbiButton'
import { vi, type Mock } from 'vitest'
import { SessionProvider, getCsrfToken } from 'next-auth/react'
import axios, { AxiosError } from 'axios'

// Mock only getCsrfToken from next-auth/react, keep the rest original
vi.mock('next-auth/react', async (importOriginal) => {
    const mod = await importOriginal<typeof import('next-auth/react')>()
    return {
        ...mod,
        getCsrfToken: vi.fn(),
    }
})

// Mock axios
vi.mock('axios')

describe('CeloUbiButton', () => {
  const mockGetCsrfToken = getCsrfToken as Mock
  const mockAxiosPost = axios.post as Mock

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCsrfToken.mockResolvedValue('mock-csrf-token')
  })

  it('should render the button in English and be disabled when not logged in', () => {
    render(
      <SessionProvider session={null}>
        <CeloUbiButton lang="en" />
      </SessionProvider>
    )
    expect(screen.getByText('Claim Celo Support')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByText('Log in to claim')).toBeInTheDocument()
  })

  it('should render the button in Spanish and be enabled when logged in', () => {
    const mockSession = { address: '0x123', expires: '1' }
    render(
      <SessionProvider session={mockSession as any}>
        <CeloUbiButton lang="es" />
      </SessionProvider>
    )
    expect(screen.getByText('Reclamar Apoyo de Celo')).toBeInTheDocument()
    expect(screen.getByRole('button')).not.toBeDisabled()
  })

  it('should show a success message when the claim is successful', async () => {
    const mockSession = { address: '0x123', expires: '1' }
    mockAxiosPost.mockResolvedValue({ data: { message: 'Éxito!' } })

    render(
      <SessionProvider session={mockSession as any}>
        <CeloUbiButton lang="es" />
      </SessionProvider>
    )
    
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    });

    expect(mockAxiosPost).toHaveBeenCalledWith('/api/claim-celo-ubi', {
      walletAddress: '0x123',
      token: 'mock-csrf-token',
    })
    expect(await screen.findByText('Éxito!')).toBeInTheDocument()
  })

  it('should show an error message when the claim fails with a custom error', async () => {
    const mockSession = { address: '0x123', expires: '1' }
    const error: Partial<AxiosError> = {
        isAxiosError: true,
        response: {
            data: { message: 'Error personalizado' },
            status: 400,
            statusText: 'Bad Request',
            headers: {} as any,
            config: { headers: {} as any }
        }
    };
    mockAxiosPost.mockRejectedValue(error);

    render(
      <SessionProvider session={mockSession as any}>
        <CeloUbiButton lang="es" />
      </SessionProvider>
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    });

    // The component shows a generic message, not the one from the API
    expect(await screen.findByText('Ocurrió un error')).toBeInTheDocument()
  })

  it('should show a generic error message when the claim fails without a custom error', async () => {
    const mockSession = { address: '0x123', expires: '1' }
    mockAxiosPost.mockRejectedValue(new Error('Network Error'))

    render(
      <SessionProvider session={mockSession as any}>
        <CeloUbiButton lang="en" />
      </SessionProvider>
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    });

    expect(await screen.findByText('Network Error')).toBeInTheDocument()
  })
})
