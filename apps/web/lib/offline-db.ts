'use client'

export const OFFLINE_DB_NAME = 'learn-tg-offline'
// v2: se agrega `courses` (descarga completa de un curso, R-#256). El upgrade
// crea el store sin tocar `guides` ni `pending` (las colas sin enviar no se
// pierden: R-#240 §4b item 9).
export const OFFLINE_DB_VERSION = 2
export const GUIDE_STORE = 'guides'
export const PENDING_STORE = 'pending'
export const COURSE_STORE = 'courses'

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
      if (!db.objectStoreNames.contains(COURSE_STORE)) {
        db.createObjectStore(COURSE_STORE, { keyPath: 'key' })
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
