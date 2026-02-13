import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import ProfileForm from '../page'
import React from 'react'

// Hoisted mocks
const mockGetUniversalLink = vi.hoisted(() => vi.fn())
const mockSelfAppBuilder = vi.hoisted(() => vi.fn())
const mockAxiosPost = vi.hoisted(() => vi.fn())
const mockSiweMessage = vi.hoisted(() => vi.fn())
const mockGetCsrfToken = vi.hoisted(() => vi.fn())
const mockUseSession = vi.hoisted(() => vi.fn())
const mockUseAccount = vi.hoisted(() => vi.fn())

describe('Profile Page', () => {
  beforeAll(async () => {
    // Reset modules to ensure mocks are applied
    vi.resetModules()

    // Mock axios as default export with post method only (ProfileForm uses axios.post for update scores)
    vi.mock('axios', () => ({
      default: { post: mockAxiosPost }
    }))

    // Mock @selfxyz/core
    vi.mock('@selfxyz/core', () => ({
      getUniversalLink: mockGetUniversalLink,
    }))

    // Mock @selfxyz/qrcode
    vi.mock('@selfxyz/qrcode', () => ({
      SelfAppBuilder: mockSelfAppBuilder,
      SelfQRcodeWrapper: vi.fn(),
    }))

    // Mock useMobileDetection
    vi.mock('@/lib/mobile-detection', () => ({
      useMobileDetection: () => false,
    }))

    // Mock SIWE (siwe)
    vi.mock('siwe', () => ({ SiweMessage: mockSiweMessage }))

    // Mock next-auth/react
    vi.mock('next-auth/react', () => ({
      getCsrfToken: () => mockGetCsrfToken(),
      useSession: () => mockUseSession(),
    }))

    // Mock wagmi
    vi.mock('wagmi', () => ({
      useAccount: () => mockUseAccount(),
    }))

    // Mock React.use to resolve params promise and spy on useEffect
    vi.mock('react', async () => {
      const actual = await vi.importActual('react')
      return {
        ...actual,
        use: (promise: any) => {
          if (promise && typeof promise.then === 'function') {
            // If it's a promise, return resolved value
            return { lang: 'en' }
          }
          return promise
        },
        useEffect: (effect: any, deps: any) => {
          console.log('useEffect called with deps:', deps)
          const wrappedEffect = () => {
            console.log('useEffect executing, deps:', deps)
            try {
              const result = effect()
              console.log('useEffect executed successfully')
              return result
            } catch (error) {
              console.error('Error in useEffect:', error)
              throw error
            }
          }
          // Call the original useEffect with wrapped effect
          return actual.useEffect(wrappedEffect, deps)
        },
      }
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock alert and console
    global.alert = vi.fn()
    console.error = vi.fn()

    // Mock environment variables
    process.env.NEXT_PUBLIC_API_COUNTRIES = 'http://example.com/countries'
    process.env.NEXT_PUBLIC_API_RELIGIONS = 'http://example.com/religions'
    process.env.NEXT_PUBLIC_API_USERS = 'http://example.com/users'
    process.env.NEXT_PUBLIC_API_SHOW_USER = 'http://example.com/show_user'
    process.env.NEXT_PUBLIC_API_UPDATE_USER = 'http://example.com/update_user/usuario_id'
    process.env.NEXT_PUBLIC_AUTH_URL = 'http://example.com'
    process.env.NEXT_PUBLIC_SELF_ENDPOINT = 'https://self.example.com'

    // Mock global.fetch for all API calls (ProfileForm uses fetch, not axios.get)
    global.fetch = vi.fn((url: string) => {
      console.log('fetch called with URL:', url)

      // Countries
      if (url === process.env.NEXT_PUBLIC_API_COUNTRIES) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: 1, nombre: 'Country1' }, { id: 2, nombre: 'Country2' }],
        })
      }

      // Religions
      if (url === process.env.NEXT_PUBLIC_API_RELIGIONS) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: 1, nombre: 'Religion1' }, { id: 2, nombre: 'Religion2' }],
        })
      }

      // User data (URL includes query parameters)
      if (url.includes(process.env.NEXT_PUBLIC_API_USERS)) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: 1,
              pais_id: 1,
              email: 'test@example.com',
              lastgooddollarverification: null,
              learningscore: 100,        // IMPORTANT: scores come from API response
              nombre: 'John Doe',
              passport_name: 'John Doe',
              passport_nationality: 1,
              foto_file_name: '',
              profilescore: 75,          // IMPORTANT: scores come from API response
              religion_id: 1,
              nusuario: 'johndoe',
            },
          ],
        })
      }

      // Default response
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' }),
      })
    })

    // Auth mocks (NO scores in session.user)
    mockUseSession.mockImplementation(() => {
      console.log('useSession called')
      const session = {
        data: {
          user: { name: 'Test User' },
          address: '0x1234567890123456789012345678901234567890',
        },
        status: 'authenticated',
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }
      console.log('session object:', session)
      console.log('session.data.address:', session.data.address)
      return session
    })

    mockUseAccount.mockImplementation(() => {
      console.log('useAccount called')
      const account = {
        address: '0x1234567890123456789012345678901234567890',
        isConnected: true,
      }
      console.log('account.address:', account.address)
      return account
    })

    mockGetCsrfToken.mockResolvedValue('mock-csrf-token')

    // Axios mock only for post (update scores)
    mockAxiosPost.mockImplementation((...args) => {
      console.log('mockAxiosPost called with', args.length, 'arguments:')
      args.forEach((arg, i) => {
        console.log(`  arg[${i}]:`, typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg)
      })
      return Promise.resolve({ data: { success: true } })
    })

    // Self mocks
    mockGetUniversalLink.mockReturnValue('self://deeplink')
    mockSelfAppBuilder.mockReturnValue({
      build: vi.fn(() => ({})),
    })
  })

  it('should render loading state initially', async () => {
    render(<ProfileForm params={Promise.resolve({ lang: 'en' })} />)
    expect(screen.getByText('Loading profile...')).toBeInTheDocument()
    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('Loading profile...')).not.toBeInTheDocument()
    })
  })

  it('should render profile form after loading', async () => {
    render(<ProfileForm params={Promise.resolve({ lang: 'en' })} />)
    await waitFor(() => {
      expect(screen.getByText('Edit Profile')).toBeInTheDocument()
    })
    expect(screen.getByLabelText('Display name')).toBeInTheDocument()
    expect(screen.getByLabelText(/Full Name/)).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Religion')).toBeInTheDocument()
    expect(screen.getByLabelText(/Country/)).toBeInTheDocument()
  })

  it('should display profile scores', async () => {
    render(<ProfileForm params={Promise.resolve({ lang: 'en' })} />)
    await waitFor(() => {
      expect(screen.getByText('Profile Score')).toBeInTheDocument()
    })
    expect(screen.getByText('Learning Score')).toBeInTheDocument()
    expect(screen.getByText('75')).toBeInTheDocument() // profilescore
    expect(screen.getByText('100')).toBeInTheDocument() // learningscore
  })

  it('should handle profile update', async () => {
    render(<ProfileForm params={Promise.resolve({ lang: 'en' })} />)
    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument()
    })

    // Mock successful update
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
    })

    const saveButton = screen.getByText('Save Changes')
    fireEvent.click(saveButton)

    // Should show saving state
    await waitFor(() => {
      expect(screen.getByText('Saving')).toBeInTheDocument()
    })
  })

  it('should handle update scores button click', async () => {
    render(<ProfileForm params={Promise.resolve({ lang: 'en' })} />)
    await waitFor(() => {
      expect(screen.getByText('Update scores')).toBeInTheDocument()
    })

    console.log('NEXT_PUBLIC_AUTH_URL:', process.env.NEXT_PUBLIC_AUTH_URL)
    console.log('session:', mockUseSession())
    console.log('address:', mockUseAccount())

    const updateButton = screen.getByText('Update scores')
    fireEvent.click(updateButton)

    // Wait a bit for async operations
    await new Promise(resolve => setTimeout(resolve, 100))

    console.log('mockAxiosPost mock calls:', mockAxiosPost.mock.calls)
    // Should call axios.post
    expect(mockAxiosPost).toHaveBeenCalledWith(
      'http://example.com/api/update-scores',
      {
        lang: 'en',
        walletAddress: '0x1234567890123456789012345678901234567890',
        token: 'mock-csrf-token',
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  })

  it('should handle self verify button click', async () => {
    render(<ProfileForm params={Promise.resolve({ lang: 'en' })} />)
    await waitFor(() => {
      expect(screen.getByText('Verify with self')).toBeInTheDocument()
    })

    const verifyButton = screen.getByText('Verify with self')
    fireEvent.click(verifyButton)

    // Should set self app and show QR dialog
    expect(mockSelfAppBuilder).toHaveBeenCalled()
    expect(mockGetUniversalLink).toHaveBeenCalled()
  })

  it('should show error when session and address mismatch', async () => {
    // Mock mismatched session
    mockUseSession.mockReturnValue({
      data: {
        user: { name: 'Test User' },
        address: '0xother',
      },
      status: 'authenticated',
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    mockUseAccount.mockReturnValue({
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
    })

    render(<ProfileForm params={Promise.resolve({ lang: 'en' })} />)
    await waitFor(() => {
      expect(screen.getByText(/Partial login/)).toBeInTheDocument()
    })
  })
})