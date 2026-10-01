import { describe, it, expect } from 'vitest'
import {
  CHUNK_RELOAD_KEY,
  isChunkLoadError,
  shouldReloadForChunkError,
} from '../sw-recovery'

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial }
  return {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => { data[k] = v },
    _data: data,
  }
}

describe('isChunkLoadError', () => {
  it('detects the webpack ChunkLoadError message', () => {
    expect(isChunkLoadError('ChunkLoadError: Loading chunk 911 failed.')).toBe(true)
  })

  it('detects the error object', () => {
    expect(isChunkLoadError(new Error('Loading chunk 2233 failed.'))).toBe(true)
  })

  it('detects a CSS chunk failure', () => {
    expect(isChunkLoadError('Loading CSS chunk 7 failed.')).toBe(true)
  })

  it('ignores unrelated errors', () => {
    expect(isChunkLoadError('TypeError: x is not a function')).toBe(false)
    expect(isChunkLoadError(undefined)).toBe(false)
  })
})

describe('shouldReloadForChunkError', () => {
  it('allows the first reload and records the time', () => {
    const storage = fakeStorage()
    expect(shouldReloadForChunkError(storage, 1000)).toBe(true)
    expect(storage._data[CHUNK_RELOAD_KEY]).toBe('1000')
  })

  it('blocks a second reload inside the window', () => {
    const storage = fakeStorage({ [CHUNK_RELOAD_KEY]: '1000' })
    expect(shouldReloadForChunkError(storage, 1000 + 9_000)).toBe(false)
  })

  it('allows a reload again after the window', () => {
    const storage = fakeStorage({ [CHUNK_RELOAD_KEY]: '1000' })
    expect(shouldReloadForChunkError(storage, 1000 + 11_000)).toBe(true)
  })

  it('reloads when there is no storage (private mode) and does not throw', () => {
    expect(shouldReloadForChunkError(null, 1000)).toBe(true)
  })

  it('survives a storage that throws', () => {
    const storage = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    }
    expect(shouldReloadForChunkError(storage, 1000)).toBe(true)
  })
})
