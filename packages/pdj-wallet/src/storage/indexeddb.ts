import { runInDb, STORE_WALLET } from './idb.js'
import type { StorageAdapter, StoredWallet } from '../types.js'

const KEY = 'current'

export class IndexedDBStorage implements StorageAdapter {
  async get(): Promise<StoredWallet | null> {
    const value = await runInDb<StoredWallet | undefined>(STORE_WALLET, 'readonly', (store) =>
      store.get(KEY),
    )
    return value ?? null
  }

  async set(record: StoredWallet): Promise<void> {
    await runInDb<IDBValidKey>(STORE_WALLET, 'readwrite', (store) => store.put(record, KEY))
  }

  async delete(): Promise<void> {
    await runInDb<undefined>(STORE_WALLET, 'readwrite', (store) => store.delete(KEY))
  }

  async has(): Promise<boolean> {
    return (await this.get()) !== null
  }
}
