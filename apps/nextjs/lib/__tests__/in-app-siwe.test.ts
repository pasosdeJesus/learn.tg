// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// El inicio de sesión usa `signIn()` de next-auth/react (refresca el SessionProvider);
// aquí se aísla y se simulan sus intentos: el 1ro rechazado (invitación), el 2do OK.
const authMocks = vi.hoisted(() => ({ signIn: vi.fn() }))
vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => authMocks.signIn(...args),
}))

import { signInWithInAppWallet } from '@/lib/in-app-siwe'

// El mock global de `siwe` (vitest.setup.ts) no implementa `prepareMessage`, que es
// justo lo que el cliente usa para firmar. Aquí se prueba el mensaje real.
vi.unmock('siwe')

const ADDRESS = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'

function makeProvider() {
  return {
    request: vi.fn(async ({ method }: { method: string }) => {
      if (method === 'eth_accounts') return [ADDRESS]
      if (method === 'personal_sign') return '0xsignature'
      throw new Error(`unexpected ${method}`)
    }),
  }
}

function respond(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response)
}

/**
 * R-#265 §3.2: cuando el callback rechaza una billetera **invitada** (no crea su
 * propia cuenta), `signInWithInAppWallet` consulta la invitación, pide confirmación,
 * la acepta y reintenta con la misma firma. Aquí se fija ese contrato.
 */
describe('signInWithInAppWallet — invitación pendiente (R-#265 §3.2)', () => {
  let callbackCalls = 0
  let acceptBodies: Array<Record<string, unknown>> = []
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    callbackCalls = 0
    acceptBodies = []
    window.localStorage.clear()
    authMocks.signIn.mockReset()
    authMocks.signIn.mockImplementation(async () => {
      callbackCalls++
      return callbackCalls === 1
        ? { ok: false, status: 401, error: 'CredentialsSignin', url: null }
        : { ok: true, status: 200, error: null, url: '/en' }
    })
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/auth/csrf') return respond(200, { csrfToken: 'abcdef12' })
      if (url === '/api/wallet/accept') {
        const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>
        acceptBodies.push(body)
        return respond(200, body.confirm ? { accepted: true, invitedBy: 'ana' } : { pending: true, invitedBy: 'ana' })
      }
      throw new Error(`unexpected fetch ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('probes, asks, accepts and retries with the same signature', async () => {
    const confirm = vi.fn(() => true)

    const address = await signInWithInAppWallet(makeProvider() as any, {
      lang: 'en',
      confirmInvitation: confirm,
    })

    expect(address).toBe(ADDRESS)
    expect(confirm).toHaveBeenCalledWith('ana')
    expect(callbackCalls).toBe(2)
    // El sondeo no confirma; la aceptación sí, y con la misma firma.
    expect(acceptBodies[0]?.confirm).toBeUndefined()
    expect(acceptBodies[1]?.confirm).toBe(true)
    expect(acceptBodies[0]?.message).toBe(acceptBodies[1]?.message)
    expect(acceptBodies[0]?.signature).toBe(acceptBodies[1]?.signature)
    expect(window.localStorage.getItem('learn.tg.sessionAddress')).toBe(ADDRESS)
  })

  it('does not link nor retry when the learner declines', async () => {
    const confirm = vi.fn(() => false)

    await expect(
      signInWithInAppWallet(makeProvider() as any, { lang: 'es', confirmInvitation: confirm }),
    ).rejects.toThrow('auth-failed')

    expect(confirm).toHaveBeenCalledWith('ana')
    expect(callbackCalls).toBe(1)
    // Solo el sondeo (sin `confirm`); no se aceptó.
    expect(acceptBodies).toHaveLength(1)
    expect(acceptBodies[0]?.confirm).toBeUndefined()
    expect(window.localStorage.getItem('learn.tg.sessionAddress')).toBeNull()
  })

  it('keeps the happy path untouched (no probe when the callback succeeds)', async () => {
    authMocks.signIn.mockImplementation(async () => {
      callbackCalls++
      return { ok: true, status: 200, error: null, url: '/en' }
    })

    const address = await signInWithInAppWallet(makeProvider() as any)

    expect(address).toBe(ADDRESS)
    expect(callbackCalls).toBe(1)
    expect(acceptBodies).toHaveLength(0)
    expect(window.localStorage.getItem('learn.tg.sessionAddress')).toBe(ADDRESS)
  })
})
