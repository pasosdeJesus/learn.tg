const PBKDF2_ITERATIONS = 600_000
const SALT_BYTES = 16
const IV_BYTES = 12

export const KDF_ITERATIONS = PBKDF2_ITERATIONS

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

export async function encryptSecret(plaintext: string, password: string): Promise<EncryptedSecret> {
  const salt = randomBytes(SALT_BYTES)
  const iv = randomBytes(IV_BYTES)
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS)
  const data = await subtle().encrypt(
    { name: 'AES-GCM', iv: iv as unknown as ArrayBuffer },
    key,
    new TextEncoder().encode(plaintext) as unknown as ArrayBuffer,
  )
  return {
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS, salt: toBase64(salt) },
    cipher: { name: 'AES-GCM', iv: toBase64(iv), data: toBase64(new Uint8Array(data)) },
  }
}

export async function decryptSecret(secret: EncryptedSecret, password: string): Promise<string> {
  const salt = fromBase64(secret.kdf.salt)
  const iv = fromBase64(secret.cipher.iv)
  const key = await deriveKey(password, salt, secret.kdf.iterations)
  try {
    const plain = await subtle().decrypt(
      { name: 'AES-GCM', iv: iv as unknown as ArrayBuffer },
      key,
      fromBase64(secret.cipher.data) as unknown as ArrayBuffer,
    )
    return new TextDecoder().decode(plain)
  } catch {
    throw new Error('Wrong password or corrupted wallet data')
  }
}

export function wipe(bytes: Uint8Array | null | undefined): void {
  if (bytes) bytes.fill(0)
}

/** SHA-256 over bytes. Used by the BIP39 checksum of `isValidMnemonic`. */
export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const digest = await subtle().digest('SHA-256', bytes as unknown as ArrayBuffer)
  return new Uint8Array(digest)
}
