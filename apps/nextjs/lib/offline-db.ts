'use client'

export const OFFLINE_DB_NAME = 'learn-tg-offline'
export const OFFLINE_DB_VERSION = 1
export const GUIDE_STORE = 'guides'
export const PENDING_STORE = 'pending'

export function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined'
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(GUIDE_STORE)) {
        db.createObjectStore(GUIDE_STORE, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(PENDING_STORE)) {
        db.createObjectStore(PENDING_STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Runs one request against a store of the offline database. */
export function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const request = run(transaction.objectStore(storeName))
    request.onsuccess = () => resolve(request.result as T)
    request.onerror = () => reject(request.error)
  }))
}
