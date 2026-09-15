import type { StorageAdapter, StoredWallet } from '../types'

const DB_NAME = 'learn-tg-pdj-wallet'
const DB_VERSION = 1
const STORE = 'wallet'
const KEY = 'current'

function indexedDb(): IDBFactory {
  const idb = (globalThis as { indexedDB?: IDBFactory }).indexedDB
  if (!idb) throw new Error('IndexedDB is not available in this environment')
  return idb
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDb().open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
  })
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const request = fn(tx.objectStore(STORE))
        request.onsuccess = () => resolve(request.result as T)
        request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
        tx.oncomplete = () => db.close()
      }),
  )
}

export class IndexedDBStorage implements StorageAdapter {
  async get(): Promise<StoredWallet | null> {
    const value = await run<StoredWallet | undefined>('readonly', (store) => store.get(KEY))
    return value ?? null
  }

  async set(record: StoredWallet): Promise<void> {
    await run<IDBValidKey>('readwrite', (store) => store.put(record, KEY))
  }

  async delete(): Promise<void> {
    await run<undefined>('readwrite', (store) => store.delete(KEY))
  }

  async has(): Promise<boolean> {
    return (await this.get()) !== null
  }
}
