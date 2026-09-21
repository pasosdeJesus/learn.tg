const PBKDF2_ITERATIONS = 600_000
const SALT_BYTES = 16
const IV_BYTES = 12

/** Default work factor (R-#251). */
export const KDF_ITERATIONS = PBKDF2_ITERATIONS
/** Never below the historical value: an old record must not get weaker. */
export const KDF_ITERATIONS_FLOOR = PBKDF2_ITERATIONS
/** Ceiling so a slow phone cannot hang when calibrating (R-#251). */
export const KDF_ITERATIONS_CEILING = 5_000_000
/** Target cost of one derivation on the device (R-#251). */
export const KDF_BUDGET_MS = 400

/**
 * Accepted secret (R-#251): NFKD + trim, so a leading/trailing space or a composed
 * accent does not lock the user out of their own wallet. Idempotent.
 */
export function normalizePassword(password: string): string {
  return typeof password === 'string' ? password.normalize('NFKD').trim() : ''
}

function subtle(): SubtleCrypto {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (!c?.subtle) {
    throw new Error(
      'Web Crypto (crypto.subtle) is not available; Node 18+ or a secure browser context is required',
    )
  }
  return c.subtle
}

function randomBytes(length: number): Uint8Array {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (!c?.getRandomValues) {
    throw new Error('crypto.getRandomValues is not available')
  }
  const bytes = new Uint8Array(length)
  c.getRandomValues(bytes)
  return bytes
}

export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

export function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await subtle().importKey(
    'raw',
    new TextEncoder().encode(password) as unknown as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return subtle().deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as ArrayBuffer,
      iterations,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export interface EncryptedSecret {
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string }
  cipher: { name: 'AES-GCM'; iv: string; data: string }
}

export async function encryptSecret(
  plaintext: string,
  password: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<EncryptedSecret> {
  const salt = randomBytes(SALT_BYTES)
  const iv = randomBytes(IV_BYTES)
  const count =
    Number.isFinite(iterations) && iterations > 0 ? Math.floor(iterations) : PBKDF2_ITERATIONS
  const key = await deriveKey(normalizePassword(password), salt, count)
  const data = await subtle().encrypt(
    { name: 'AES-GCM', iv: iv as unknown as ArrayBuffer },
    key,
    new TextEncoder().encode(plaintext) as unknown as ArrayBuffer,
  )
  return {
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: count, salt: toBase64(salt) },
    cipher: { name: 'AES-GCM', iv: toBase64(iv), data: toBase64(new Uint8Array(data)) },
  }
}

/** One derivation with a throwaway salt, used to measure the device cost. */
async function measureDerivation(iterations: number): Promise<number> {
  const salt = randomBytes(SALT_BYTES)
  const started = Date.now()
  await deriveKey('calibration-only', salt, iterations)
  return Date.now() - started
}

/**
 * Picks the PBKDF2 work factor for this device (R-#251): measures the floor and
 * scales it to `budgetMs`, clamped to [floor, ceiling]. The count lives in the
 * record, so a device that chose 2 M and another that chose 600 k keep working.
 *
 * `measure` is injectable so tests do not depend on the machine's speed.
 */
export async function calibrateIterations(
  measure: (iterations: number) => Promise<number> = measureDerivation,
  budgetMs: number = KDF_BUDGET_MS,
): Promise<number> {
  let floorMs = 0
  try {
    floorMs = await measure(KDF_ITERATIONS_FLOOR)
  } catch {
    return KDF_ITERATIONS_FLOOR
  }
  if (!Number.isFinite(floorMs) || floorMs <= 0) return KDF_ITERATIONS_FLOOR
  const projected = Math.floor((KDF_ITERATIONS_FLOOR * budgetMs) / floorMs)
  if (!Number.isFinite(projected) || projected < KDF_ITERATIONS_FLOOR) {
    return KDF_ITERATIONS_FLOOR
  }
  return Math.min(KDF_ITERATIONS_CEILING, projected)
}

export async function decryptSecret(secret: EncryptedSecret, password: string): Promise<string> {
  const salt = fromBase64(secret.kdf.salt)
  const iv = fromBase64(secret.cipher.iv)
  // R-#251: primero con la clave normalizada (NFKD + trim) y, si el registro se
  // cifró con la clave tal cual la escribió el usuario, con esa misma. Así una clave
  // con un espacio o un acento compuesto sigue abriendo la billetera.
  const normalized = normalizePassword(password)
  const candidates = normalized === password ? [password] : [normalized, password]
  for (const candidate of candidates) {
    const key = await deriveKey(candidate, salt, secret.kdf.iterations)
    try {
      const plain = await subtle().decrypt(
        { name: 'AES-GCM', iv: iv as unknown as ArrayBuffer },
        key,
        fromBase64(secret.cipher.data) as unknown as ArrayBuffer,
      )
      return new TextDecoder().decode(plain)
    } catch {
      // se prueba la siguiente variante
    }
  }
  throw new Error('Wrong password or corrupted wallet data')
}

export function wipe(bytes: Uint8Array | null | undefined): void {
  if (bytes) bytes.fill(0)
}

/** SHA-256 over bytes. Used by the BIP39 checksum of `isValidMnemonic`. */
export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const digest = await subtle().digest('SHA-256', bytes as unknown as ArrayBuffer)
  return new Uint8Array(digest)
}
