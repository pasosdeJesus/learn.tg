import { describe, expect, it } from 'vitest'
import { KDF_ITERATIONS, decryptSecret, encryptSecret, fromBase64, toBase64 } from '../crypto'

describe('crypto', () => {
  it('round-trips a secret with the password', async () => {
    const secret = await encryptSecret('0x' + 'ab'.repeat(32), '123456')
    expect(secret.kdf.name).toBe('PBKDF2')
    expect(secret.kdf.hash).toBe('SHA-256')
    expect(secret.kdf.iterations).toBe(KDF_ITERATIONS)
    expect(secret.cipher.name).toBe('AES-GCM')
    expect(secret.kdf.salt).not.toBe('')
    expect(secret.cipher.iv).not.toBe('')
    expect(secret.cipher.data).not.toContain('ab'.repeat(32))
    await expect(decryptSecret(secret, '123456')).resolves.toBe('0x' + 'ab'.repeat(32))
  })

  it('uses 600,000 PBKDF2 iterations', () => {
    expect(KDF_ITERATIONS).toBe(600_000)
  })

  it('uses a fresh salt and IV per encryption', async () => {
    const first = await encryptSecret('secret', '123456')
    const second = await encryptSecret('secret', '123456')
    expect(first.kdf.salt).not.toBe(second.kdf.salt)
    expect(first.cipher.iv).not.toBe(second.cipher.iv)
    expect(first.cipher.data).not.toBe(second.cipher.data)
  })

  it('rejects a wrong password', async () => {
    const secret = await encryptSecret('secret', '123456')
    await expect(decryptSecret(secret, '654321')).rejects.toThrow(/Wrong password/i)
  })

  it('round-trips base64 helpers', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255])
    expect(Array.from(fromBase64(toBase64(bytes)))).toEqual([0, 1, 2, 250, 255])
  })
})
