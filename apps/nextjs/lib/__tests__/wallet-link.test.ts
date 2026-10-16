// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// R-#265 §3.2: el SIWE del enlace lo firma la **billetera activa**; se aísla la llamada
// a la ruta (`linkAccountWallet`) y el `fetch` del `csrfToken`. El mock global de `siwe`
// de `vitest.setup.ts` no construye mensajes, así que aquí se usa el real.
vi.unmock('siwe')

const mocks = vi.hoisted(() => ({ linkAccountWallet: vi.fn() }))
vi.mock('@/lib/wallet-account', () => ({ linkAccountWallet: mocks.linkAccountWallet }))

import { detectActiveWalletSigner, linkActiveWallet } from '@/lib/wallet-link'

const SESSION = '0x1111111111111111111111111111111111111111'
const INAPP = '0x2222222222222222222222222222222222222222'
const EXTERNAL = '0x3333333333333333333333333333333333333333'

type Provider = { request: ReturnType<typeof vi.fn> }

/** Proveedor falso: `eth_accounts` responde `accounts` salvo que `impl` diga otra cosa. */
function provider(
  accounts: string[] | null,
  impl?: (args: { method: string }) => Promise<unknown>,
): Provider {
  return { request: vi.fn(impl ?? (async () => accounts ?? [])) }
}

describe('detectActiveWalletSigner (R-#265 §3.2)', () => {
  it('returns no-wallet when nothing can sign', async () => {
    expect(
      await detectActiveWalletSigner({ inAppUnlocked: false, sessionAddress: SESSION }),
    ).toEqual({ ok: false, reason: 'no-wallet' })
  })

  it('prefers the unlocked in-app wallet when it is not the session wallet', async () => {
    const external = provider([EXTERNAL])
    const resolution = await detectActiveWalletSigner({
      inAppUnlocked: true,
      inAppAddress: INAPP,
      inAppProvider: provider([INAPP]) as never,
      externalProvider: external as never,
      sessionAddress: SESSION,
    })
    expect(resolution.ok && resolution.signer.address).toBe(INAPP)
    // No se molesta a la extensión si la billetera de la aplicación ya sirve.
    expect(external.request).not.toHaveBeenCalled()
  })

  it('uses the external wallet when it already has permission', async () => {
    const external = provider([EXTERNAL])
    const resolution = await detectActiveWalletSigner({
      inAppUnlocked: true,
      inAppAddress: SESSION,
      inAppProvider: provider([SESSION]) as never,
      externalProvider: external as never,
      sessionAddress: SESSION,
    })
    expect(resolution.ok && resolution.signer.address).toBe(EXTERNAL)
    expect(external.request).toHaveBeenCalledWith({ method: 'eth_accounts' })
    expect(external.request).not.toHaveBeenCalledWith({ method: 'eth_requestAccounts' })
  })

  // Caso reportado por el operador (2026-10-16): conectó la billetera de la aplicación,
  // activó OneKey y "Vincular" decía que la billetera ya estaba en la cuenta. La extensión
  // no tenía permiso del sitio (`eth_accounts` = []), así que hay que pedirlo.
  it('asks the external wallet for access when the site has none yet', async () => {
    const external = provider(null, async (args) =>
      args.method === 'eth_requestAccounts' ? [EXTERNAL] : [],
    )
    const resolution = await detectActiveWalletSigner({
      inAppUnlocked: true,
      inAppAddress: SESSION,
      inAppProvider: provider([SESSION]) as never,
      externalProvider: external as never,
      sessionAddress: SESSION,
    })
    expect(resolution.ok && resolution.signer.address).toBe(EXTERNAL)
    expect(external.request).toHaveBeenCalledWith({ method: 'eth_requestAccounts' })
  })

  it('reports a cancelled external access request', async () => {
    const external = provider(null, async (args) => {
      if (args.method === 'eth_requestAccounts') {
        throw Object.assign(new Error('denied'), { code: 4001 })
      }
      return []
    })
    const resolution = await detectActiveWalletSigner({
      inAppUnlocked: true,
      inAppAddress: SESSION,
      inAppProvider: provider([SESSION]) as never,
      externalProvider: external as never,
      sessionAddress: SESSION,
    })
    expect(resolution).toEqual({ ok: false, reason: 'cancelled' })
  })

  it('reports is-session-wallet when the only wallet is the session one', async () => {
    const resolution = await detectActiveWalletSigner({
      inAppUnlocked: true,
      inAppAddress: SESSION,
      inAppProvider: provider([SESSION]) as never,
      sessionAddress: SESSION,
    })
    expect(resolution).toEqual({ ok: false, reason: 'is-session-wallet' })
  })

  it('ignores an external provider that fails both account calls', async () => {
    const resolution = await detectActiveWalletSigner({
      inAppUnlocked: false,
      sessionAddress: SESSION,
      externalProvider: provider(null, async () => {
        throw new Error('locked')
      }) as never,
    })
    expect(resolution).toEqual({ ok: false, reason: 'no-wallet' })
  })
})

describe('linkActiveWallet (R-#265 §3.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ csrfToken: 'csrfnonce1234' }) })),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('signs with the active wallet and posts the link', async () => {
    const signerProvider = { request: vi.fn(async () => '0xsig') }
    mocks.linkAccountWallet.mockResolvedValue({ ok: true, wallets: [] })

    const result = await linkActiveWallet({
      signer: { address: INAPP, provider: signerProvider as never },
      sessionWallet: SESSION,
    })

    expect(result).toEqual({ ok: true, wallets: [] })
    expect(signerProvider.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'personal_sign',
        params: [expect.stringContaining('csrfnonce1234'), INAPP],
      }),
    )
    expect(mocks.linkAccountWallet).toHaveBeenCalledWith(
      expect.objectContaining({
        walletAddress: SESSION,
        message: expect.stringContaining('csrfnonce1234'),
        signature: '0xsig',
      }),
    )
  })

  it('reports a cancelled signature without linking', async () => {
    const signerProvider = {
      request: vi.fn(async () => {
        throw Object.assign(new Error('denied'), { code: 4001 })
      }),
    }

    const result = await linkActiveWallet({
      signer: { address: INAPP, provider: signerProvider as never },
      sessionWallet: SESSION,
    })

    expect(result).toEqual({ ok: false, reason: 'cancelled' })
    expect(mocks.linkAccountWallet).not.toHaveBeenCalled()
  })

  it('fails when the CSRF nonce cannot be read', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )

    const result = await linkActiveWallet({
      signer: { address: INAPP, provider: { request: vi.fn() } as never },
      sessionWallet: SESSION,
    })

    expect(result).toEqual({ ok: false, reason: 'error' })
  })
})
