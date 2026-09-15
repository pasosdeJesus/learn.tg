'use client'

import { GUIDE_STORE, hasIndexedDB, withStore } from '@/lib/offline-db'

export interface CachedGuide {
  key: string
  markdown: string
  savedAt: number
}

const memory = new Map<string, CachedGuide>()

/** Stores the Markdown of a guide so it can be read offline (R-#241). */
export async function saveGuide(key: string, markdown: string): Promise<void> {
  const record: CachedGuide = { key, markdown, savedAt: Date.now() }
  if (!hasIndexedDB()) {
    memory.set(key, record)
    return
  }
  try {
    await withStore(GUIDE_STORE, 'readwrite', (store) => store.put(record))
  } catch {
    memory.set(key, record)
  }
}

/** Returns the cached Markdown of a guide, or null when it was never visited. */
export async function getGuide(key: string): Promise<CachedGuide | null> {
  if (!hasIndexedDB()) return memory.get(key) ?? null
  try {
    const record = await withStore<CachedGuide | undefined>(GUIDE_STORE, 'readonly', (store) => store.get(key))
    return record ?? memory.get(key) ?? null
  } catch {
    return memory.get(key) ?? null
  }
}

export async function deleteGuide(key: string): Promise<void> {
  memory.delete(key)
  if (!hasIndexedDB()) return
  try {
    await withStore(GUIDE_STORE, 'readwrite', (store) => store.delete(key))
  } catch {
    // the in-memory copy is already gone
  }
}
