/// <reference types="vitest/globals" />

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import Page from '../page.tsx'
import React, { Suspense } from 'react'
import axios from 'axios'

// Mock entire modules first
vi.mock('axios')
vi.mock('next/navigation', () => ({
  usePathname: () => '/en',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('next-auth/react')
vi.mock('wagmi')

// Then, define the mock implementations
const mockedAxios = vi.mocked(axios, true)
const { useSession, getCsrfToken } = await import('next-auth/react')
const { useAccount, usePublicClient, useWalletClient } = await import('wagmi')

const useSessionMock = useSession as vi.Mock
const getCsrfTokenMock = getCsrfToken as vi.Mock
const useAccountMock = useAccount as vi.Mock
const usePublicClientMock = usePublicClient as vi.Mock
const useWalletClientMock = useWalletClient as vi.Mock

// Render direct
function renderWithProviders(ui: React.ReactElement) {
  return render(<Suspense fallback={<div>Loading...</div>}>{ui}</Suspense>)
}

describe('Main Page Component', () => {
  const defaultProps = {
    params: Promise.resolve({ lang: 'en' }),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useSessionMock.mockReturnValue({
      data: { address: '0x123', user: { name: 'Test User' } },
      status: 'authenticated',
    })
    getCsrfTokenMock.mockResolvedValue('mock-csrf-token')
    useAccountMock.mockReturnValue({ address: '0x123', isConnected: true })
    usePublicClientMock.mockReturnValue({
      readContract: vi.fn().mockResolvedValue(0n),
      getBalance: vi.fn().mockResolvedValue(1000n), // Provide a balance
      getGasPrice: vi.fn().mockResolvedValue(1n),
      estimateContractGas: vi.fn().mockResolvedValue(21000n),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success' }),
    })
    useWalletClientMock.mockReturnValue({
      data: { writeContract: vi.fn().mockResolvedValue('0xhash') },
    })
    mockedAxios.get.mockResolvedValue({ data: [] })
    // @ts-expect-error
    global.window.alert = vi.fn()
  })

  it('shows partial login message when session and account addresses differ', async () => {
    useSessionMock.mockReturnValue({
      data: { address: '0xAAA', user: { name: 'Test User' } },
      status: 'authenticated',
    })
    useAccountMock.mockReturnValue({ address: '0xBBB', isConnected: true })
    
    await act(async () => {
      renderWithProviders(<Page {...defaultProps} />)
    })

    await waitFor(() => {
      expect(screen.getByText(/Partial login/)).toBeInTheDocument()
      expect(mockedAxios.get).not.toHaveBeenCalled()
    })
  })

  it('fetches courses with progress when wallet is connected and session matches', async () => {
    const mockCourses = [
      {
        id: 1,
        idioma: 'en',
        prefijoRuta: '/course-1',
        imagen: '/image1.jpg',
        titulo: 'Course 1',
        subtitulo: 'Description 1',
        percentageCompleted: 50,
        percentagePaid: 25,
      },
    ]
    mockedAxios.get.mockResolvedValueOnce({ data: mockCourses })

    await act(async () => {
      renderWithProviders(<Page {...defaultProps} />)
    })

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledTimes(1)
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/courses-with-progress?lang=en&walletAddress=0x123')
      expect(screen.getByText('Course 1')).toBeInTheDocument()
      expect(screen.getByText('50%')).toBeInTheDocument()
      expect(screen.getByText('Progress')).toBeInTheDocument()
    })
  })

  it('handles API errors gracefully without crashing', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('API Error'))
    
    await act(async () => {
      renderWithProviders(<Page {...defaultProps} />)
    })

    await waitFor(() => {
      expect(global.window.alert).toHaveBeenCalledWith('API Error')
      expect(screen.queryByText('Course 1')).not.toBeInTheDocument()
    })
  })

  it('clears courses when wallet disconnects', async () => {
    const mockCourses = [
      { id: 1, titulo: 'Course 1', subtitulo: 'Desc 1', percentageCompleted: 10, percentagePaid: 5, idioma: 'en', prefijoRuta: '/c1', imagen: '/i1.jpg' },
    ]
    mockedAxios.get.mockResolvedValueOnce({ data: mockCourses })

    const { rerender } = renderWithProviders(<Page {...defaultProps} />);
    
    await waitFor(() => {
        expect(screen.getByText('Course 1')).toBeInTheDocument()
    })

    // Simulate wallet disconnect
    useAccountMock.mockReturnValue({ address: undefined, isConnected: false })
    
    await act(async () => {
        rerender(<Page {...defaultProps} />)
    })

    await waitFor(() => {
        expect(screen.queryByText('Course 1')).not.toBeInTheDocument()
        // Ensure we don't re-fetch when address is undefined
        expect(mockedAxios.get).toHaveBeenCalledTimes(1)
    })
  })
})
