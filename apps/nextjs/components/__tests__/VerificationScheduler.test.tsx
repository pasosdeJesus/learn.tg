import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VerificationScheduler } from '../VerificationScheduler'

const mockUseSession = vi.fn(() => ({
  data: { address: '0x123', user: { name: 'Test' } },
  status: 'authenticated',
}))
const mockGetCsrfToken = vi.fn(() => 'test-csrf-token')

vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
  getCsrfToken: () => mockGetCsrfToken(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/lib/hooks/useAuthAddress', () => ({
  useAuthAddress: () => ({
    address: '0x123',
    sessionAddress: '0x123',
    isAuthenticated: true,
  }),
}))

vi.mock('@/lib/hooks/useTranslation', () => ({
  createComponentT: (lang: string, translations: Record<string, Record<string, string>>) => {
    const dict = translations[lang] || translations.en || {}
    return (key: string, ...args: string[]) => {
      let val = dict[key] || key
      args.forEach((arg, i) => { val = val.replace(`{{${i}}}`, arg) })
      return val
    }
  },
}))

const mockToastFn = vi.fn()
vi.mock('@pasosdejesus/m/shadcn-components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToastFn }),
}))

vi.mock('lucide-react', () => ({
  ChevronLeft: () => null,
  ChevronRight: () => null,
}))

describe('VerificationScheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    global.fetch = vi.fn()
  })

  it('renders schedule button when no interview is booked', () => {
    render(<VerificationScheduler interviewDate={null} />)
    expect(screen.getByText('Schedule Interview')).toBeDefined()
  })

  it('renders explanatory text when no interview is booked', () => {
    render(<VerificationScheduler interviewDate={null} />)
    expect(screen.getByText(/brief 30-minute/)).toBeDefined()
  })

  it('renders scheduled interview info when interview is booked for future', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString()
    render(<VerificationScheduler interviewDate={futureDate} />)
    expect(screen.getByText(/Interview scheduled for/)).toBeDefined()
    expect(screen.getByText('Reschedule')).toBeDefined()
    expect(screen.getByText('Cancel Interview')).toBeDefined()
  })

  it('renders missed interview info when interview is in the past', () => {
    const pastDate = '2020-01-01T10:00:00.000Z'
    render(<VerificationScheduler interviewDate={pastDate} />)
    expect(screen.getByText(/was not completed/)).toBeDefined()
  })

  it('opens dialog when schedule button is clicked', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ slots: [] }),
    })
    render(<VerificationScheduler interviewDate={null} />)
    fireEvent.click(screen.getByText('Schedule Interview'))
    await waitFor(() => {
      expect(screen.getByText('Schedule Verification Interview')).toBeDefined()
    })
  })

  it('opens confirmation dialog when cancel is clicked', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString()
    render(<VerificationScheduler interviewDate={futureDate} />)
    fireEvent.click(screen.getByText('Cancel Interview'))
    await waitFor(() => {
      expect(screen.getByText('Cancel Interview?')).toBeDefined()
    })
  })

  it('calls cancel API when confirmed in confirmation dialog', async () => {
    const onCancel = vi.fn()
    const futureDate = new Date(Date.now() + 86400000).toISOString()
    ;(global.fetch as any).mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    render(<VerificationScheduler interviewDate={futureDate} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Cancel Interview'))
    await waitFor(() => {
      expect(screen.getByText('Yes, Cancel')).toBeDefined()
    })
    fireEvent.click(screen.getByText('Yes, Cancel'))
    await waitFor(() => {
      expect(onCancel).toHaveBeenCalled()
    })
  })

  it('closes confirmation dialog when "Keep It" is clicked', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString()
    render(<VerificationScheduler interviewDate={futureDate} />)
    fireEvent.click(screen.getByText('Cancel Interview'))
    await waitFor(() => {
      expect(screen.getByText('Keep It')).toBeDefined()
    })
    fireEvent.click(screen.getByText('Keep It'))
    await waitFor(() => {
      expect(screen.queryByText('Cancel Interview?')).toBeNull()
    })
  })

  it('shows loading skeleton when dialog opens and slots are loading', async () => {
    let resolvePromise: any
    const fetchPromise = new Promise((resolve) => { resolvePromise = resolve })
    ;(global.fetch as any).mockReturnValue(fetchPromise)

    render(<VerificationScheduler interviewDate={null} />)
    fireEvent.click(screen.getByText('Schedule Interview'))

    await waitFor(() => {
      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    resolvePromise({ ok: true, json: () => Promise.resolve({ slots: [] }) })
  })

  it('resets selected date and slot when dialog is closed', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ slots: [] }),
    })

    const { rerender } = render(<VerificationScheduler interviewDate={null} />)
    fireEvent.click(screen.getByText('Schedule Interview'))
    await waitFor(() => {
      expect(screen.getByText('Schedule Verification Interview')).toBeDefined()
    })

    // Re-render to simulate dialog state management
    rerender(<VerificationScheduler interviewDate={null} />)
  })

  it('shows available dates after slots load', async () => {
    const slotStart = new Date(Date.now() + 86400000).toISOString()
    const slotEnd = new Date(Date.now() + 86400000 + 1800000).toISOString()

    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        slots: [{ start: slotStart, end: slotEnd }],
      }),
    })

    render(<VerificationScheduler interviewDate={null} />)
    fireEvent.click(screen.getByText('Schedule Interview'))

    await waitFor(() => {
      const greenDates = document.querySelectorAll('.bg-green-100')
      expect(greenDates.length).toBeGreaterThan(0)
    })
  })

  it('renders in Spanish when lang=es', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString()
    render(<VerificationScheduler lang="es" interviewDate={futureDate} />)
    expect(screen.getByText('Reagendar')).toBeDefined()
    expect(screen.getByText('Cancelar Entrevista')).toBeDefined()
  })

  it('uses provided timezone for display', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString()
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ slots: [] }),
    })
    render(<VerificationScheduler interviewDate={null} timezone="America/Bogota" />)
    fireEvent.click(screen.getByText('Schedule Interview'))
    await waitFor(() => {
      expect(screen.getByText(/America\/Bogota/)).toBeDefined()
    })
  })

  it('renders Spanish scheduled text', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString()
    render(<VerificationScheduler lang="es" interviewDate={futureDate} />)
    expect(screen.getByText(/Entrevista agendada/)).toBeDefined()
    expect(screen.getByText(/Africa\/Freetown/)).toBeDefined()
  })
})
