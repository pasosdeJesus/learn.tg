import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import Page from '../page'
import React, { Suspense } from 'react'
import axios from 'axios'
import { useSession, getCsrfToken } from 'next-auth/react'
import { useAccount } from 'wagmi'

// --- Mocks ---

vi.mock('react', async (importOriginal) => {
  const actualReact = await importOriginal<typeof React>()
  return { ...actualReact, use: vi.fn((promise) => promise) }
})

vi.mock('axios')
vi.mock('next-auth/react')
vi.mock('wagmi')

vi.mock('@/components/DonateModal', () => ({
  DonateModal: () => <div data-testid="donate-modal" />,
}))

vi.mock('@/components/CourseStatistics', () => ({
  CourseStatistics: ({ lang, full, address, totalGuides, scholarshipPerGuide, profileScore, canSubmit, completedGuides, paidGuides, percentageCompleted, percentagePaid, scholarshipPaid }: any) => {
    if (canSubmit === null) return null // No renderizar si canSubmit es null
    return (
      <div>
        <h2>Scholarship Stats</h2>
        <span>{canSubmit ? 'Eligible' : 'Not Eligible'}</span>
      </div>
    )
  },
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/gooddollar',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ lang: 'en', pathPrefix: 'gooddollar' }),
}))

const mockedAxios = vi.mocked(axios) as any
const mockedUseSession = vi.mocked(useSession)
const mockedUseAccount = vi.mocked(useAccount)
const mockedGetCsrfToken = vi.mocked(getCsrfToken)

function renderWithProviders(ui: React.ReactElement) {
  return render(<Suspense fallback={<div>Loading...</div>}>{ui}</Suspense>)
}

describe('Course Page (Integration)', () => {
  const mockParams = Promise.resolve({ lang: 'en', pathPrefix: 'gooddollar' })
  const mockCourse = { id: 'course-1', titulo: 'GoodDollar Course', guias: [{ sufijoRuta: 'guide1' }] }
  const mockScholarship = { canSubmit: true, amountScholarship: 1000, isEligible: true } // isEligible añadido

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_API_BUSCA_CURSOS_URL', 'https://fake.local/courses')
    vi.stubEnv('NEXT_PUBLIC_API_PRESENTA_CURSO_URL', 'https://fake.local/presenta_curso_id')

    vi.clearAllMocks()
    mockedGetCsrfToken.mockResolvedValue('mock-csrf-token')

    mockedUseSession.mockReturnValue({
      data: { address: '0x123', expires: new Date().toISOString() },
      status: 'authenticated',
      update: vi.fn(),
    } as any)
    mockedUseAccount.mockReturnValue({
      address: '0x123',
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      isReconnecting: false,
      status: 'connected',
      addresses: ['0x123'],
      chain: undefined,
      chainId: 1,
      connector: undefined,
    } as any)

    mockedAxios.get.mockImplementation((url: string) => {
      if (url.startsWith(process.env.NEXT_PUBLIC_API_BUSCA_CURSOS_URL!))
        return Promise.resolve({ data: [mockCourse] })
      if (url.includes('presenta'))
        return Promise.resolve({ data: mockCourse })
      if (url.includes('scholarship'))
        return Promise.resolve({ data: mockScholarship })
      if (url.includes('guide-status'))
        return Promise.resolve({ data: { completed: true } })
      return Promise.reject(new Error(`Unhandled GET to ${url}`))
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('shows partial login message when session and wallet addresses differ', async () => {
    mockedUseSession.mockReturnValue({
      data: { address: '0xAAA', expires: new Date().toISOString() },
      status: 'authenticated',
      update: vi.fn(),
    } as any)
    mockedUseAccount.mockReturnValue({
      address: '0xBBB',
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      isReconnecting: false,
      status: 'connected',
      addresses: ['0xBBB'],
      chain: undefined,
      chainId: 1,
      connector: undefined,
    } as any)

    renderWithProviders(<Page params={mockParams} />)

    await waitFor(() => {
      expect(screen.getByText(/Partial login/)).toBeInTheDocument()
    })
  })

  it('calls APIs and renders course when session exists and matches', async () => {
    renderWithProviders(<Page params={mockParams} />)

    await waitFor(() => {
        expect(screen.getByText('GoodDollar Course')).toBeInTheDocument()
        expect(screen.getByText('Scholarship Stats')).toBeInTheDocument()
        expect(screen.getByText('Eligible')).toBeInTheDocument()
    })
  })

  it('does not call secure APIs when no session', async () => {
    mockedUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: vi.fn(),
    } as any)
    mockedUseAccount.mockReturnValue({
      address: undefined,
      isConnected: false,
      isConnecting: false,
      isDisconnected: true,
      isReconnecting: false,
      status: 'disconnected',
      addresses: undefined,
      chain: undefined,
      chainId: undefined,
      connector: undefined,
    } as any)

    renderWithProviders(<Page params={mockParams} />)

    await waitFor(() => {
      expect(screen.getByText('GoodDollar Course')).toBeInTheDocument()
    })

    expect(screen.queryByText('Scholarship Stats')).not.toBeInTheDocument()
  })
})
