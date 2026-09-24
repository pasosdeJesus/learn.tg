import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

// Sincronización de todos los cursos accesibles (R-#256, pedido del operador
// 2026-09-23: offline solo estaba la guía visitada y no había botón para bajarlos).
//
// La decisión del operador del mismo día, tras probar en un iPhone, cambió el botón
// por un aviso con el avance: la lista muestra cuántos cursos hay guardados y la
// verificación se pide con un enlace discreto ("Check now").
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
    // Ya no hay botón de descarga: el enlace solo fuerza la verificación.
    expect(screen.getByText('Check now')).toBeInTheDocument()
    expect(screen.queryByText('Download all my courses')).not.toBeInTheDocument()
  })

  it('reports the result of a manual check', async () => {
    render(<OfflineDownloadAll lang="en" />)

    fireEvent.click(await screen.findByText('Check now'))

    await waitFor(() => expect(hooks.downloadAllAccessible).toHaveBeenCalledTimes(1))
    expect(hooks.downloadAllAccessible.mock.calls[0][1]).toMatchObject({ lang: 'en' })
    // El resumen distingue lo guardado, lo que ya estaba al día y lo que no se publica.
    await waitFor(() => expect(hooks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringMatching(/1 saved · 1 already up to date · 1 not published \(Christian content\)/),
      }),
    ))
  })

  it('shows the result summary next to the count', async () => {
    render(<OfflineDownloadAll lang="en" />)

    fireEvent.click(await screen.findByText('Check now'))

    expect(await screen.findByText(/1 saved · 1 already up to date · 1 not published \(Christian content\)/)).toBeInTheDocument()
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

  it('announces the progress only when something is really missing', async () => {
    // `onStart` informa cuántos cursos faltan: si ninguno, no hay aviso.
    hooks.downloadAllAccessible.mockImplementation(async (_get: any, options: any) => {
      options.onStart?.({ total: 2, pending: 1 })
      options.onProgress?.({ done: 1, total: 2, label: 'web3-and-ubi' })
      return { downloaded: ['en/web3-and-ubi'], skipped: [], failed: [] }
    })

    render(<OfflineLibrarySync lang="en" />)

    await waitFor(() => expect(hooks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Preparing offline reading' }),
    ))
  })

  it('stays silent when everything was already saved', async () => {
    hooks.downloadAllAccessible.mockImplementation(async (_get: any, options: any) => {
      options.onStart?.({ total: 2, pending: 0 })
      return { downloaded: [], skipped: [{ key: 'en/web3-and-ubi', reason: 'already-current' }], failed: [] }
    })

    render(<OfflineLibrarySync lang="en" />)

    await waitFor(() => expect(hooks.downloadAllAccessible).toHaveBeenCalled())
    expect(hooks.toast).not.toHaveBeenCalled()
  })
})
