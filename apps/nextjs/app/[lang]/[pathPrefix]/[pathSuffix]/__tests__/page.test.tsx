'use client'

import { describe, it, expect, beforeEach, vi, type Mocked, type Mock, type MockedFunction } from 'vitest'
import Page from '../page'
import { render, screen, act } from '@testing-library/react'
import axios from 'axios'
import { unified } from 'unified'
import type { Processor } from 'unified'
import React from 'react'
import { SessionProvider } from 'next-auth/react'
import type { Session } from 'next-auth'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { celo } from 'viem/chains'
import { useParams } from 'next/navigation'

import { useGuideData } from '@/lib/hooks/useGuideData'

// Mock dependencies
vi.mock('@/components/GoodDollarClaimButton', () => ({
  GoodDollarClaimButton: () => <div data-testid="gooddollar-claim-button"></div>,
}))
vi.mock('@/components/CeloUbiButton', () => ({
  default: () => <div data-testid="celo-ubi-button"></div>,
}))
vi.mock('@/lib/hooks/useGuideData')
vi.mock('axios')
vi.mock('unified', () => ({
  unified: vi.fn(),
}))
// Mock next-auth/react to avoid network requests (only getCsrfToken)
vi.mock('next-auth/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next-auth/react')>()
  return {
    ...actual,
    getCsrfToken: vi.fn(() => Promise.resolve('mock-csrf-token')),
  }
})

// Mock next/navigation to provide useParams
vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/navigation')>()
  return {
    ...actual,
    useParams: vi.fn(),
  }
})

// Mock useAccount to provide a consistent address
vi.mock('wagmi', async (importOriginal) => {
  const actualWagmi = await importOriginal<typeof import('wagmi')>()
  return {
    ...actualWagmi,
    useAccount: vi.fn(() => ({ address: '0x123' })),
  }
})

// Setup Wagmi config for testing
const config = createConfig({
  chains: [celo],
  transports: {
    [celo.id]: http(),
  },
})

describe('Page', () => {
  const mockAxios = axios as Mocked<typeof axios>
  const mockUnified = unified as MockedFunction<typeof unified>
  const mockUseGuideData = useGuideData as Mock

  const mockProcess = vi.fn()
  const mockUse = vi.fn().mockReturnThis()
  const mockParse = vi.fn().mockReturnThis()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useParams).mockReturnValue({ lang: 'en', pathPrefix: 'guia', pathSuffix: 'celo-ubi' })
    mockUnified.mockReturnValue({
      use: mockUse,
      parse: mockParse,
      process: mockProcess,
    } as unknown as Processor)
    vi.stubGlobal('process', {
      env: { NEXT_PUBLIC_AUTH_URL: 'http://localhost:3000' },
    })
  })

  it('should render the CeloUbiButton when the markdown contains the magic string', async () => {
    const markdownContent = 'This is some content with the magic button: {CeloUbiButton}'

    mockUseGuideData.mockReturnValue({
      course: { id: 1, idioma: 'en', titulo: 'Test Course', sinBilletera: false, conBilletera: true },
      loading: false,
      error: null,
      myGuide: { titulo: 'Test Guide', completed: false, receivedScholarship: false },
      guideNumber: 1,
      nextGuidePath: null,
      previousGuidePath: null,
      coursePath: '/',
    })
    mockAxios.get.mockResolvedValue({ data: { markdown: markdownContent } })

    mockProcess.mockReturnValue({ toString: () => 'This is some content with the magic button: ' })

    const mockSession = { address: '0x123', expires: '1' };

    await act(async () => {
      render(
        <WagmiProvider config={config}>
          <SessionProvider session={mockSession as any}>
            <Page />
          </SessionProvider>
        </WagmiProvider>
      )
    })
    
    const expectedUrl = `http://localhost:3000/api/guide?courseId=1&lang=en&prefix=guia&guide=celo-ubi&guideNumber=1`
    expect(mockAxios.get).toHaveBeenCalledWith(expectedUrl)
    
    expect(await screen.findByTestId('celo-ubi-button')).toBeInTheDocument()
  })
})
