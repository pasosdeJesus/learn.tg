/**
 * Layer L2 of https://github.com/pasosdeJesus/learn.tg/issues/246: the wallet key
 * sealed with the WebAuthn **PRF** secret.
 *
 * The private key is never written in plaintext. The stored record only holds the
 * ciphertext plus the (non-secret) salts and the credential id; the key that opens
 * it can only be produced by the authenticator, after the user verifies (Face ID /
 * fingerprint / device password). The password-encrypted record of `wallet.ts` is untouched
 * and remains the recovery path.
 */
import { fromBase64, toBase64, wipe } from './crypto.js'
import { runInDb, STORE_BIOMETRIC } from './storage/idb.js'
import { deriveWrappingKey, signalUnknownCredential, toArrayBuffer } from './web-authn.js'

const KEY = 'current'
const IV_BYTES = 12
export const PRF_SALT_BYTES = 32
export const HKDF_SALT_BYTES = 16

/** Stored (non-secret) material needed to re-derive the wrapping key. */
export interface BiometricRecord {
  v: 1
  address: string
  credentialId: string
  prfSalt: string
  hkdfSalt: string
  iv: string
  data: string
  createdAt: number
}

async function subtle(): Promise<SubtleCrypto> {
  const c = (globalThis as { crypto?: Crypto }).crypto?.subtle
  if (!c) throw new Error('Web Crypto (crypto.subtle) is not available')
  return c
}

function randomBytes(length: number): Uint8Array {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (!c?.getRandomValues) throw new Error('crypto.getRandomValues is not available')
  const bytes = new Uint8Array(length)
  c.getRandomValues(bytes)
  return bytes
}

export async function readBiometricRecord(): Promise<BiometricRecord | null> {
  const value = await runInDb<BiometricRecord | undefined>(STORE_BIOMETRIC, 'readonly', (store) =>
    store.get(KEY),
  )
  return value ?? null
}

export async function writeBiometricRecord(record: BiometricRecord): Promise<void> {
  await runInDb<IDBValidKey>(STORE_BIOMETRIC, 'readwrite', (store) => store.put(record, KEY))
}

export async function deleteBiometricRecord(): Promise<void> {
  await runInDb<undefined>(STORE_BIOMETRIC, 'readwrite', (store) => store.delete(KEY))
}

/**
 * Drops the sealed copy **and** tells the authenticator the passkey is gone
 * (R-#246 §14 item 1). Used when the user turns the gesture off or deletes the
 * wallet: before this, the orphan passkey stayed in the OS list.
 */
export async function forgetBiometricCredential(): Promise<void> {
  const record = await readBiometricRecord().catch(() => null)
  if (record?.credentialId) await signalUnknownCredential(record.credentialId)
  await deleteBiometricRecord().catch(() => undefined)
}

/** Encrypts `privateKey` with the key derived from the PRF secret of `prfSalt`. */
export async function sealWithPrfSecret(
  prfSecret: Uint8Array,
  prfSalt: Uint8Array,
  privateKey: `0x${string}`,
  { address, credentialId }: { address: string; credentialId: string },
): Promise<BiometricRecord> {
  const hkdfSalt = randomBytes(HKDF_SALT_BYTES)
  const iv = randomBytes(IV_BYTES)
  const key = await deriveWrappingKey(prfSecret, hkdfSalt)
  const data = await (await subtle()).encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(new TextEncoder().encode(privateKey)),
  )
  return {
    v: 1,
    address,
    credentialId,
    prfSalt: toBase64(prfSalt),
    hkdfSalt: toBase64(hkdfSalt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(data)),
    createdAt: Date.now(),
  }
}

/** Decrypts the sealed key with the PRF secret. Throws `auth-failed` on failure. */
export async function unsealWithPrfSecret(
  prfSecret: Uint8Array,
  record: BiometricRecord,
): Promise<`0x${string}`> {
  const key = await deriveWrappingKey(prfSecret, fromBase64(record.hkdfSalt))
  try {
    const plain = await (await subtle()).decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(fromBase64(record.iv)) },
      key,
      toArrayBuffer(fromBase64(record.data)),
    )
    return new TextDecoder().decode(plain) as `0x${string}`
  } catch {
    throw new Error('auth-failed')
  }
}

export function wipePrfSecret(secret: Uint8Array | null | undefined): void {
  wipe(secret)
}

/** Fresh salt for a `prf.eval` call; stored next to the sealed record. */
export function newPrfSalt(): Uint8Array {
  return randomBytes(PRF_SALT_BYTES)
}
