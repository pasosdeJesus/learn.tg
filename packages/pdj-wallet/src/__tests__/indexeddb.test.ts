import { describe, expect, it } from 'vitest'

let fakeIndexedDB: (() => void) | null = null
try {
  const mod = (await import('fake-indexeddb/auto')) as { default?: () => void }
  fakeIndexedDB = mod.default ?? (() => {})
} catch {
  fakeIndexedDB = null
}

const describeIdb = fakeIndexedDB ? describe : describe.skip

describeIdb('IndexedDBStorage', () => {
  it('stores, reads and deletes the wallet record', async () => {
    const { IndexedDBStorage } = await import('../storage/indexeddb')
    const storage = new IndexedDBStorage()
    await storage.delete()
    expect(await storage.has()).toBe(false)
    expect(await storage.get()).toBeNull()

    const record = {
      version: 1 as const,
      address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as `0x${string}`,
      chain: 'celoSepolia' as const,
      createdAt: 1,
      kdf: { name: 'PBKDF2' as const, hash: 'SHA-256' as const, iterations: 600000, salt: 's' },
      cipher: { name: 'AES-GCM' as const, iv: 'i', data: 'd' },
    }
    await storage.set(record)
    expect(await storage.has()).toBe(true)
    expect((await storage.get())?.address).toBe(record.address)
    await storage.delete()
    expect(await storage.get()).toBeNull()
  })
})
