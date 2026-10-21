// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'

// Aviso global del resultado de una respuesta resuelta sin conexión (R-#242). Se monta en
// el layout, así que el estudiante se entera aunque haya dejado la página del crucigrama.
const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  lastResult: null as { url: string; body: unknown } | null,
  lastRejection: null as { url: string; status: number; message?: string; needsSignIn?: boolean } | null,
  clearLastResult: vi.fn(),
  clearLastRejection: vi.fn(),
}))

vi.mock('@/lib/hooks/useOfflineQueue', () => ({
  useOfflineQueue: () => ({
    lastResult: mocks.lastResult,
    clearLastResult: mocks.clearLastResult,
    lastRejection: mocks.lastRejection,
    clearLastRejection: mocks.clearLastRejection,
  }),
}))

vi.mock('@pasosdejesus/m/shadcn-components/ui/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}))

import { OfflineQueueSync } from '../OfflineQueueSync'

describe('OfflineQueueSync (R-#242)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.lastResult = null
    mocks.lastRejection = null
  })

  // Opción A de https://github.com/pasosdeJesus/learn.tg/issues/234 §4.9: sin sesión válida
  // la respuesta sigue guardada, así que el aviso invita a volver a firmar en vez de
  // presentarlo como un rechazo del contenido.
  it('invita a firmar cuando el replay no tenía sesión (401)', async () => {
    mocks.lastRejection = { url: '/api/check-crossword', status: 401, needsSignIn: true }
    render(<OfflineQueueSync lang="es" />)

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled())
    expect(mocks.toast.mock.calls[0][0]).toMatchObject({
      title: expect.stringMatching(/vuelve a firmar/i),
      variant: 'default',
    })
    expect(mocks.clearLastRejection).toHaveBeenCalled()
  })

  it('sigue mostrando un rechazo del contenido como error', async () => {
    mocks.lastRejection = {
      url: '/api/check-crossword',
      status: 200,
      message: 'You need at least 50 points',
    }
    render(<OfflineQueueSync lang="es" />)

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled())
    expect(mocks.toast.mock.calls[0][0]).toMatchObject({
      description: 'You need at least 50 points',
      variant: 'destructive',
    })
  })
})
