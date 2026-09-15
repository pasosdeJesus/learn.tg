'use client'

import { PENDING_STORE, hasIndexedDB, withStore } from '@/lib/offline-db'

const MAX_ATTEMPTS = 5

export interface PendingSubmission {
  id: string
  url: string
  body: unknown
  createdAt: number
  attempts: number
}

const memory = new Map<string, PendingSubmission>()

function newId(): string {
  const random = Math.random().toString(36).slice(2, 10)
  return `${Date.now().toString(36)}-${random}`
}

/**
 * Queues a mutation that could not reach the server (offline) so it can be
 * replayed when the connection returns (R-#241/R-#242).
 */
export async function enqueueSubmission(url: string, body: unknown): Promise<PendingSubmission> {
  const record: PendingSubmission = {
    id: newId(),
    url,
    body,
    createdAt: Date.now(),
    attempts: 0,
  }
  if (!hasIndexedDB()) {
    memory.set(record.id, record)
    return record
  }
  try {
    await withStore(PENDING_STORE, 'readwrite', (store) => store.put(record))
  } catch {
    memory.set(record.id, record)
  }
  return record
}

export async function listPending(): Promise<PendingSubmission[]> {
  if (!hasIndexedDB()) return [...memory.values()].sort((a, b) => a.createdAt - b.createdAt)
  try {
    const records = await withStore<PendingSubmission[]>(PENDING_STORE, 'readonly', (store) => store.getAll())
    return (records ?? []).sort((a, b) => a.createdAt - b.createdAt)
  } catch {
    return [...memory.values()].sort((a, b) => a.createdAt - b.createdAt)
  }
}

export async function pendingCount(): Promise<number> {
  return (await listPending()).length
}

export async function dequeueSubmission(id: string): Promise<void> {
  memory.delete(id)
  if (!hasIndexedDB()) return
  try {
    await withStore(PENDING_STORE, 'readwrite', (store) => store.delete(id))
  } catch {
    // the in-memory copy is already gone
  }
}

/** Records a failed attempt; drops the item after too many tries. */
export async function registerAttempt(id: string): Promise<void> {
  const items = await listPending()
  const item = items.find((candidate) => candidate.id === id)
  if (!item) return
  const attempts = item.attempts + 1
  if (attempts >= MAX_ATTEMPTS) {
    await dequeueSubmission(id)
    return
  }
  const record = { ...item, attempts }
  if (!hasIndexedDB()) {
    memory.set(id, record)
    return
  }
  try {
    await withStore(PENDING_STORE, 'readwrite', (store) => store.put(record))
  } catch {
    memory.set(id, record)
  }
}
