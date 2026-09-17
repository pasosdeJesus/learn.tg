import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryStorage } from '../storage/memory'
import {
  forgetUnlockedSession,
  readUnlockedSession,
  rememberUnlockedSession,
  SESSION_UNLOCK_TTL_MS,
} from '../session'
import {
  createWallet,
  deleteWallet,
  importWallet,
  lockWallet,
  restoreUnlockedSession,
  unlockWallet,
} from '../wallet'

const PIN = '123456'
const PN = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const KEY = 'learn.tg:in-app-wallet:unlocked'

function installSessionStorage(): Map<string, string> {
  const map = new Map<string, string>()
  const store = {
    getItem: (key: string) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key: string, value: string) => { map.set(key, String(value)) },
    removeItem: (key: string) => { map.delete(key) },
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() { return map.size },
  }
  ;(globalThis as { sessionStorage?: unknown }).sessionStorage = store
  return map
}

afterEach(() => {
  delete (globalThis as { sessionStorage?: unknown }).sessionStorage
  delete (globalThis as { unlocked?: unknown }).unlocked
  vi.resetModules()
})

describe('session-scoped unlock (R-#244)', () => {
  it('remembers the unlocked key for the tab and reads it back', () => {
    installSessionStorage()
    rememberUnlockedSession(ADDRESS, PN as `0x${string}`)

    const entry = readUnlockedSession()
    expect(entry?.address).toBe(ADDRESS)
    expect(entry?.privateKey).toBe(PN)
    expect(entry?.expiresAt).toBeGreaterThan(Date.now())
  })

  it('drops the entry once it expires', () => {
    const map = installSessionStorage()
    rememberUnlockedSession(ADDRESS, PN as `0x${string}`, -1)

    expect(readUnlockedSession()).toBeNull()
    expect(map.has(KEY)).toBe(false)
  })

  it('ignores and removes a corrupted entry', () => {
    const map = installSessionStorage()
    map.set(KEY, 'not json')

    expect(readUnlockedSession()).toBeNull()
    expect(map.has(KEY)).toBe(false)
  })

  it('forgets the entry on demand', () => {
    installSessionStorage()
    rememberUnlockedSession(ADDRESS, PN as `0x${string}`)
    forgetUnlockedSession()
    expect(readUnlockedSession()).toBeNull()
  })

  // Node, Safari en modo privado o una cuota llena: nunca debe romper el flujo.
  it('is a no-op without sessionStorage', () => {
    expect(() => rememberUnlockedSession(ADDRESS, PN as `0x${string}`)).not.toThrow()
    expect(readUnlockedSession()).toBeNull()
    expect(() => forgetUnlockedSession()).not.toThrow()
  })

  it('keeps the entry valid for the configured TTL', () => {
    installSessionStorage()
    rememberUnlockedSession(ADDRESS, PN as `0x${string}`)
    const entry = readUnlockedSession()
    expect(entry!.expiresAt - Date.now()).toBeLessThanOrEqual(SESSION_UNLOCK_TTL_MS)
  })
})

describe('restoreUnlockedSession (R-#244)', () => {
  it('restores the unlock after a reload, so no modal asks for the PIN again', async () => {
    installSessionStorage()
    const storage = new MemoryStorage()
    await importWallet({ privateKey: PN as `0x${string}`, pin: PIN, storage })
    expect(readUnlockedSession()?.address).toBe(ADDRESS)

    // Una recarga vacía la memoria del módulo pero conserva la pestaña.
    vi.resetModules()
    const fresh = await import('../wallet')
    expect(fresh.isUnlocked()).toBe(false)

    const info = await fresh.restoreUnlockedSession(storage)
    expect(info?.address).toBe(ADDRESS)
    expect(fresh.isUnlocked()).toBe(true)
    expect(fresh.getUnlockedInfo()?.address).toBe(ADDRESS)
  })

  it('does not restore after locking or deleting the wallet', async () => {
    installSessionStorage()
    const storage = new MemoryStorage()
    await createWallet({ pin: PIN, storage })
    await lockWallet()
    expect(readUnlockedSession()).toBeNull()

    vi.resetModules()
    const fresh = await import('../wallet')
    expect(await fresh.restoreUnlockedSession(storage)).toBeNull()
    expect(fresh.isUnlocked()).toBe(false)

    // Y al borrarla tampoco queda rastro
    await unlockWallet(PIN, storage)
    await deleteWallet(storage)
    expect(readUnlockedSession()).toBeNull()
    vi.resetModules()
    const fresh2 = await import('../wallet')
    expect(await fresh2.restoreUnlockedSession(storage)).toBeNull()
  })

  it('ignores the entry when the stored wallet changed', async () => {
    installSessionStorage()
    const storage = new MemoryStorage()
    await createWallet({ pin: PIN, storage })
    expect(readUnlockedSession()).not.toBeNull()

    // La billetera guardada ya no está (borrada, o reemplazada por otra)
    await storage.delete()

    vi.resetModules()
    const fresh = await import('../wallet')
    expect(await fresh.restoreUnlockedSession(storage)).toBeNull()
    expect(fresh.isUnlocked()).toBe(false)
    expect(readUnlockedSession()).toBeNull()
  })

  it('renews the TTL when the tab keeps using the wallet', async () => {
    installSessionStorage()
    const storage = new MemoryStorage()
    await importWallet({ privateKey: PN as `0x${string}`, pin: PIN, storage })

    // Simula que ya se consumió casi todo el TTL
    const store = (globalThis as { sessionStorage: Storage }).sessionStorage
    const stored = JSON.parse(store.getItem(KEY) as string)
    stored.expiresAt = Date.now() + 1000
    store.setItem(KEY, JSON.stringify(stored))

    const info = await restoreUnlockedSession(storage)
    expect(info?.address).toBe(ADDRESS)
    expect(readUnlockedSession()!.expiresAt - Date.now()).toBeGreaterThan(60_000)
  })
})
