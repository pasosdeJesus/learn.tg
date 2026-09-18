/**
 * Single owner of the `learn-tg-pdj-wallet` IndexedDB database.
 *
 * Two object stores live here: `wallet` (the PIN-encrypted record, see
 * `storage/indexeddb.ts`) and `biometric` (the key sealed with the WebAuthn PRF
 * secret, see `biometric.ts`). Both modules must open the database with the same
 * version, so the version lives here and nowhere else.
 */
export const DB_NAME = 'learn-tg-pdj-wallet'
export const DB_VERSION = 2
export const STORE_WALLET = 'wallet'
export const STORE_BIOMETRIC = 'biometric'

function indexedDb(): IDBFactory {
  const idb = (globalThis as { indexedDB?: IDBFactory }).indexedDB
  if (!idb) throw new Error('IndexedDB is not available in this environment')
  return idb
}

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDb().open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_WALLET)) db.createObjectStore(STORE_WALLET)
      if (!db.objectStoreNames.contains(STORE_BIOMETRIC)) db.createObjectStore(STORE_BIOMETRIC)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
  })
}

/** Runs one request inside its own transaction and closes the connection. */
export function runInDb<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode)
        const request = fn(tx.objectStore(storeName))
        request.onsuccess = () => resolve(request.result as T)
        request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
        tx.oncomplete = () => db.close()
      }),
  )
}
