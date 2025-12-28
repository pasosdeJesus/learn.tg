'use client'

import Page from '../page'
import { render, screen, act } from '@testing-library/react'
import axios from 'axios'
import { vi } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeReact from 'rehype-react'
import { CeloUbiButton } from '@/components/CeloUbiButton'
import React from 'react'
import { SessionProvider } from 'next-auth/react'

vi.mock('axios')
vi.mock('unified', () => ({
  unified: vi.fn(),
}))

describe('Page', () => {
  const mockAxios = axios as vi.Mocked<typeof axios>
  const mockUnified = unified as vi.Mock

  const mockProcess = vi.fn()
  const mockUse = vi.fn().mockReturnThis()
  const mockParse = vi.fn().mockReturnThis()

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()

    // Setup the mock chain for unified
    mockUnified.mockReturnValue({
      use: mockUse,
      parse: mockParse,
      process: mockProcess,
    } as any)
  })

  it('should render the CeloUbiButton when the markdown contains the magic string', async () => {
    const markdownContent = 'This is some content with the magic button: {CeloUbiButton}'
    const downloadUrl = 'http://localhost:3000/guia.md'

    mockAxios.get.mockResolvedValueOnce({ data: markdownContent })

    // Mock the result of the unified processor
    const unifiedResult = {
      result: React.createElement('div', null, 
        'This is some content with the magic button: ',
        React.createElement(CeloUbiButton, { key: 'celo-ubi-button', lang: 'en' })
      ),
    }
    mockProcess.mockResolvedValue(unifiedResult)

    const mockSession = { address: '0x123', expires: '1' };

    // Use act to wait for async operations
    await act(async () => {
      render(
        <SessionProvider session={mockSession as any}>
          <Page
            params={{
              lang: 'en',
              pathPrefix: 'guia',
              pathSuffix: 'celo-ubi',
              downloadUrl: downloadUrl,
            }}
          />
        </SessionProvider>
      )
    })
    
    // Check if axios was called with the correct URL
    expect(mockAxios.get).toHaveBeenCalledWith(downloadUrl)
    
    // Check if the button is rendered
    expect(await screen.findByTestId('celo-ubi-button')).toBeInTheDocument()
  })
})
