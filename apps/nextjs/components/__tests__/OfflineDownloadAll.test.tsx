import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

// Sincronización de todos los cursos accesibles (R-#256, pedido del operador
// 2026-09-23: offline solo estaba la guía visitada y no había botón para bajarlos).
const hooks = vi.hoisted(() => ({
  wallet: '0x84272a6dd0d5fe9ea2ab28cf96e72f4f7da00c5c' as string | null,
  toast: vi.fn(),
  downloadAllAccessible: vi.fn(),
  listDownloadedCourses: vi.fn(),
}))

vi.mock('@/lib/hooks/useAuthedApi', () => ({
  useAuthedApi: () => ({
    authedGet: vi.fn(),
    ready: true,
    wallet: hooks.wallet,
    mismatch: false,
  }),
}))

vi.mock('@pasosdejesus/m/shadcn-components/ui/use-toast', () => ({
  useToast: () => ({ toast: hooks.toast }),
}))

vi.mock('@/lib/offline-course-download', () => ({
  downloadAllAccessible: hooks.downloadAllAccessible,
  listAccessibleCourses: vi.fn(),
}))

vi.mock('@/lib/offline-course-db', () => ({
  listDownloadedCourses: hooks.listDownloadedCourses,
  courseKey: (lang: string, prefix: string) => `${lang}/${prefix}`,
  getDownloadedCourse: vi.fn(),
  isStale: () => false,
}))

import { OfflineDownloadAll, OfflineLibrarySync } from '../OfflineDownloadAll'

describe('OfflineDownloadAll (R-#256)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hooks.wallet = '0x84272a6dd0d5fe9ea2ab28cf96e72f4f7da00c5c'
    hooks.listDownloadedCourses.mockResolvedValue([{ key: 'en/web3-and-ubi' }, { key: 'en/gdcluster' }])
    hooks.downloadAllAccessible.mockResolvedValue({
      downloaded: ['en/web3-and-ubi'],
      skipped: [
        { key: 'en/a-relationship-with-Jesus', reason: 'privacy' },
        { key: 'en/gdcluster', reason: 'already-current' },
      ],
      failed: [],
    })
    try { sessionStorage.clear() } catch { /* jsdom sin almacenamiento */ }
  })

  it('shows how many courses are saved on the device', async () => {
    render(<OfflineDownloadAll lang="en" />)

    await waitFor(() => expect(hooks.listDownloadedCourses).toHaveBeenCalled())
    expect(screen.getByTestId('offline-download-all')).toHaveTextContent('Courses on this device: 2')
    expect(screen.getByText('Download all my courses')).toBeInTheDocument()
  })

  it('syncs everything when the button is pressed and reports the result', async () => {
    render(<OfflineDownloadAll lang="en" />)

    fireEvent.click(await screen.findByText('Download all my courses'))

    await waitFor(() => expect(hooks.downloadAllAccessible).toHaveBeenCalledTimes(1))
    expect(hooks.downloadAllAccessible.mock.calls[0][1]).toMatchObject({ lang: 'en' })
    await waitFor(() => expect(hooks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('Finished') }),
    ))
    // El resumen distingue lo que no se guardó por privacidad
    expect(await screen.findByText(/not published \(Christian content\)/)).toBeInTheDocument()
  })

  it('does not sync automatically again within the interval', async () => {
    sessionStorage.setItem('learn.tg.offlineLibrarySyncedAt', String(Date.now()))

    render(<OfflineLibrarySync lang="en" />)

    await waitFor(() => expect(hooks.listDownloadedCourses).toHaveBeenCalled())
    expect(hooks.downloadAllAccessible).not.toHaveBeenCalled()
  })

  it('syncs automatically when the app opens and nothing was stamped', async () => {
    render(<OfflineLibrarySync lang="en" />)

    await waitFor(() => expect(hooks.downloadAllAccessible).toHaveBeenCalledTimes(1))
    expect(sessionStorage.getItem('learn.tg.offlineLibrarySyncedAt')).toBeTruthy()
  })
})
