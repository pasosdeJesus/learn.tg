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
    // Suppress console.error for Radix UI accessibility warnings in tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  })

  afterEach(() => {
    (console.error as Mock).mockRestore();
  });

  it('should render the button in English and be disabled when not logged in', () => {
    render(
      <SessionProvider session={null}>
        <CeloUbiButton lang="en" />
      </SessionProvider>
    )
    expect(screen.getByText('Claim Learn.tg-UBI')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('should render the button in Spanish and be enabled when logged in', () => {
    const mockSession = { address: '0x123', expires: '1' }
    render(
      <SessionProvider session={mockSession as any}>
        <CeloUbiButton lang="es" />
      </SessionProvider>
    )
    expect(screen.getByText('Reclamar Learn.tg-IBU')).toBeInTheDocument()
    expect(screen.getByRole('button')).not.toBeDisabled()
  })

  it('should show a success dialog with the amount when the claim is successful', async () => {
    const mockSession = { address: '0x123', expires: '1' };
    const mockAmount = '10';
    mockAxiosPost.mockResolvedValue({ 
      data: { 
        message: `¡Reclamo exitoso! Has recibido ${mockAmount} Celo de Learn.tg-IBU.`,
        txHash: '0xabc',
        amount: mockAmount
      }
    });

    render(
      <SessionProvider session={mockSession as any}>
        <CeloUbiButton lang="es" />
      </SessionProvider>
    );
    
    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    expect(mockAxiosPost).toHaveBeenCalledWith('/api/claim-celo-ubi', {
      walletAddress: '0x123',
      token: 'mock-csrf-token',
    });
    
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Reclamo Exitoso')).toBeInTheDocument();
    expect(screen.getByText(`¡Reclamo exitoso! Has recibido ${mockAmount} Celo de Learn.tg-IBU.`)).toBeInTheDocument();
    expect(screen.getByText('Ver transacción')).toHaveAttribute('href', `${process.env.NEXT_PUBLIC_EXPLORER_TX}/0xabc`);
  });

  it('should show an error dialog when the claim fails with a custom error', async () => {
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

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('Error en el Reclamo')).toBeInTheDocument()
    expect(screen.getByText('Error personalizado')).toBeInTheDocument()
  })

  it('should show a generic error dialog when the claim fails without a custom error', async () => {
    const mockSession = { address: '0x123', expires: '1' }
    const error = new Error('Network Error');
    mockAxiosPost.mockRejectedValue(error)

    render(
      <SessionProvider session={mockSession as any}>
        <CeloUbiButton lang="en" />
      </SessionProvider>
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    });

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('Claim Error')).toBeInTheDocument()
    expect(screen.getByText('Network Error')).toBeInTheDocument()
  })
})
