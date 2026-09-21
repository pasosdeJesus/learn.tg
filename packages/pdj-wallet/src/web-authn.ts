/**
 * WebAuthn helpers for the in-app wallet (layers L1/L2 of
 * https://github.com/pasosdeJesus/learn.tg/issues/246).
 *
 * Measured on real phones (2026-09-18): `PublicKeyCredential` and the `prf`
 * extension exist in Chrome/Brave for Android and in Safari (18+), and do **not**
 * exist in the in-app browsers of Rabby, MetaMask, OneKey and OKX. Every function
 * here is therefore optional and must degrade silently: nothing may throw just
 * because the device has no platform authenticator.
 */
import { fromBase64, toBase64 } from './crypto.js'

const RP_NAME = 'learn.tg'
const TIMEOUT_MS = 120_000
/** HKDF info string: separates this use of a PRF secret from any other. */
const HKDF_INFO = 'learn.tg/pdj-wallet/prf/v1'

/**
 * Ventana de gracia de la verificación del usuario (decisión del operador,
 * 2026-09-20). Una vez que el usuario verificó con el dispositivo (gesto L1 o
 * desbloqueo L2), un movimiento de fondos **a un destino ya conocido** no vuelve a
 * pedir el gesto dentro de esta ventana. Es deliberadamente corta: 15 minutos.
 *
 * Además, un **destino nuevo siempre exige el gesto** (ver `destinations.ts`),
 * aunque la ventana esté abierta: eso frena el drenaje automatizado/hostil a una
 * dirección que el usuario nunca usó.
 *
 * Compromiso explícito: en un dispositivo desbloqueado y robado, dentro de la
 * ventana se puede mover dinero a direcciones ya usadas sin gesto. La clave/PIN
 * nunca se guarda y los 12 palabras siguen siendo la recuperación.
 */
export const USER_VERIFICATION_GRACE_MS = 15 * 60 * 1000

let lastUserVerificationAt = 0

/** Records that the user just verified (called on a successful assertion/PRF). */
export function markUserVerified(now: number = Date.now()): void {
  lastUserVerificationAt = now
}

/** Forgets the verification (called when the wallet locks or is deleted). */
export function clearUserVerification(): void {
  lastUserVerificationAt = 0
}

/** Whether a user verification happened within the grace window. */
export function hasRecentUserVerification(
  windowMs: number = USER_VERIFICATION_GRACE_MS,
  now: number = Date.now(),
): boolean {
  return lastUserVerificationAt > 0 && now - lastUserVerificationAt < windowMs
}

export interface PlatformSupport {
  /** `navigator.credentials` with WebAuthn is present at all. */
  webauthn: boolean
  /** The device can verify the user (Face ID, fingerprint, device password). */
  userVerifying: boolean
  /** Whether the engine advertises the `prf` extension (may be unknown). */
  prf: boolean | null
}

function credentials(): CredentialsContainer | null {
  const c = (globalThis as { navigator?: Navigator }).navigator as
    | { credentials?: CredentialsContainer }
    | undefined
  return c?.credentials ?? null
}

export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function randomBytes(length: number): Uint8Array {
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto
  if (!cryptoObj?.getRandomValues) throw new Error('crypto.getRandomValues is not available')
  const bytes = new Uint8Array(length)
  cryptoObj.getRandomValues(bytes)
  return bytes
}

/** Reports what the device can do, never throwing. */
export async function detectPlatformSupport(): Promise<PlatformSupport> {
  const hasPublicKey = typeof (globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential !== 'undefined'
  const container = credentials()
  if (!hasPublicKey || !container?.create || !container.get) {
    return { webauthn: false, userVerifying: false, prf: null }
  }

  let userVerifying = false
  const ask = (PublicKeyCredential as unknown as {
    isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>
  }).isUserVerifyingPlatformAuthenticatorAvailable
  if (typeof ask === 'function') {
    try {
      userVerifying = await ask()
    } catch {
      userVerifying = false
    }
  }

  let prf: boolean | null = null
  const caps = (PublicKeyCredential as unknown as {
    getClientCapabilities?: () => Promise<Record<string, unknown>>
  }).getClientCapabilities
  if (typeof caps === 'function') {
    try {
      const result = await caps()
      // Chrome 133+ exposes 'extension:prf'; older builds expose 'extension:hmacCreateSecret'.
      const value = result['extension:prf'] ?? result['extension:hmacCreateSecret']
      if (typeof value === 'boolean') prf = value
    } catch {
      prf = null
    }
  }

  return { webauthn: true, userVerifying, prf }
}

export interface PrfCredential {
  credentialId: string
  /** The authenticator accepted the `prf` extension for this credential. */
  prfEnabled: boolean
}

/**
 * Creates a discoverable platform credential with the `prf` extension. The
 * credential is stored by the password manager / device, exactly like a passkey,
 * and can be removed by the user from there.
 */
export async function createPrfCredential(userName: string): Promise<PrfCredential> {
  const container = credentials()
  if (!container?.create) throw new Error('WebAuthn is not available on this device')

  const credential = (await container.create({
    publicKey: {
      challenge: toArrayBuffer(randomBytes(32)),
      rp: { name: RP_NAME },
      user: {
        id: toArrayBuffer(randomBytes(16)),
        name: userName,
        displayName: userName,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'required',
        userVerification: 'required',
      },
      timeout: TIMEOUT_MS,
      attestation: 'none',
      extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null

  if (!credential) throw new Error('The browser did not return a credential')

  const results = credential.getClientExtensionResults() as {
    prf?: { enabled?: boolean }
  }

  return {
    credentialId: toBase64(new Uint8Array(credential.rawId)),
    prfEnabled: results?.prf?.enabled === true,
  }
}

/**
 * Evaluates the PRF for `salt` and returns its 32-byte secret, asking the user to
 * verify (Face ID / fingerprint / device password). Returns `null` when the
 * authenticator does not provide a result instead of throwing.
 */
export async function evaluatePrf(credentialId: string, salt: Uint8Array): Promise<Uint8Array | null> {
  const container = credentials()
  if (!container?.get) throw new Error('WebAuthn is not available on this device')

  const assertion = (await container.get({
    publicKey: {
      challenge: toArrayBuffer(randomBytes(32)),
      allowCredentials: [
        {
          type: 'public-key',
          id: toArrayBuffer(fromBase64(credentialId)),
          transports: ['internal', 'hybrid'],
        },
      ],
      userVerification: 'required',
      timeout: TIMEOUT_MS,
      extensions: { prf: { eval: { first: toArrayBuffer(salt) } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null

  if (!assertion) return null
  markUserVerified()
  const results = assertion.getClientExtensionResults() as {
    prf?: { results?: { first?: ArrayBuffer } }
  }
  const first = results?.prf?.results?.first
  return first ? new Uint8Array(first) : null
}

/**
 * Layer L1: asks the user to verify **with the device** (Face ID / fingerprint /
 * device password) before a sensitive operation, and returns the assertion. It does not
 * need the `prf` extension: any user-verified assertion is enough. Throws
 * `no-webauthn` when there is no platform authenticator and `NotAllowedError` when
 * the user cancels.
 */
export async function assertUserVerification(
  credentialId: string,
  { timeoutMs = TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<void> {
  const container = credentials()
  if (!container?.get) throw new Error('no-webauthn')

  const assertion = (await container.get({
    publicKey: {
      challenge: toArrayBuffer(randomBytes(32)),
      allowCredentials: [
        {
          type: 'public-key',
          id: toArrayBuffer(fromBase64(credentialId)),
          transports: ['internal', 'hybrid'],
        },
      ],
      userVerification: 'required',
      timeout: timeoutMs,
    },
  })) as PublicKeyCredential | null

  if (!assertion) throw new Error('auth-failed')
  markUserVerified()
}

/** HKDF(PRF secret) → AES-GCM key that wraps the wallet key. */export async function deriveWrappingKey(
  prfSecret: Uint8Array,
  hkdfSalt: Uint8Array,
): Promise<CryptoKey> {
  const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle
  if (!subtle) throw new Error('Web Crypto (crypto.subtle) is not available')
  const material = await subtle.importKey('raw', toArrayBuffer(prfSecret), 'HKDF', false, [
    'deriveKey',
  ])
  return subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: toArrayBuffer(hkdfSalt),
      info: toArrayBuffer(new TextEncoder().encode(HKDF_INFO) as Uint8Array),
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** rpId used by the passkeys of this wallet (the page's host). */
function relyingPartyId(): string {
  const location = (globalThis as { location?: { hostname?: string } }).location
  return location?.hostname || 'localhost'
}

/**
 * Tells the authenticator that a passkey is gone (R-#246 §14 item 1, adopted from
 * Rabby: `signalUnknownCredential`). Without it, disabling the biometric unlock or
 * deleting the wallet left the passkey orphaned in the OS list until the user
 * removed it by hand.
 *
 * Best effort: the API only exists in Chrome 132+ and must never break the caller.
 */
export async function signalUnknownCredential(
  credentialId: string,
  rpId: string = relyingPartyId(),
): Promise<void> {
  if (!credentialId) return
  const signal = (
    globalThis as {
      PublicKeyCredential?: {
        signalUnknownCredential?: (options: { rpId: string; credentialId: string }) => Promise<void>
      }
    }
  ).PublicKeyCredential?.signalUnknownCredential
  if (typeof signal !== 'function') return
  try {
    await signal({ rpId, credentialId })
  } catch {
    // el passkey queda huérfano, como antes de este cambio
  }
}

/**
 * True when a WebAuthn/signing failure means "the user cancelled" (R-#246 §14
 * item 4). We used to match only `NotAllowedError`, so an abort surfaced as an
 * unknown error.
 */
export function isUserCancelledError(error: unknown): boolean {
  const name = (error as { name?: string })?.name?.toLowerCase() ?? ''
  if (name === 'notallowederror' || name === 'aborterror') return true
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /cancel|abort|notallowed/i.test(message)
}
