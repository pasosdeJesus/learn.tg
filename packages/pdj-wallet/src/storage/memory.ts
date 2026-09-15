import type { StorageAdapter, StoredWallet } from '../types'

export class MemoryStorage implements StorageAdapter {
  private record: StoredWallet | null

  constructor(initial: StoredWallet | null = null) {
    this.record = initial
  }

  async get(): Promise<StoredWallet | null> {
    return this.record
  }

  async set(record: StoredWallet): Promise<void> {
    this.record = record
  }

  async delete(): Promise<void> {
    this.record = null
  }

  async has(): Promise<boolean> {
    return this.record !== null
  }
}
