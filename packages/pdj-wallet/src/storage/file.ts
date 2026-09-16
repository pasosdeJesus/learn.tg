import type { StorageAdapter, StoredWallet } from '../types.js'

type FsPromises = typeof import('node:fs/promises')

async function fs(): Promise<FsPromises> {
  try {
    return await import('node:fs/promises')
  } catch {
    throw new Error('FileStorage requires Node.js (node:fs/promises is not available here)')
  }
}

/**
 * Node.js storage adapter: the encrypted record lives in a JSON file, so E2E
 * tests (and any Node script) can use the real wallet without a browser.
 *
 * The import is dynamic on purpose: this module must stay loadable from a
 * browser bundle (`node:fs/promises` is only imported when a method runs), which
 * is also why it is exported from `@learn-tg/pdj-wallet/storage` and not from the
 * package root.
 */
export class FileStorage implements StorageAdapter {
  constructor(private readonly filePath: string) {}

  async get(): Promise<StoredWallet | null> {
    const { readFile } = await fs()
    try {
      const raw = await readFile(this.filePath, 'utf8')
      return JSON.parse(raw) as StoredWallet
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') return null
      throw error
    }
  }

  async set(record: StoredWallet): Promise<void> {
    const { writeFile } = await fs()
    // 0600: the file holds the encrypted key, nobody else needs to read it.
    await writeFile(this.filePath, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 })
  }

  async delete(): Promise<void> {
    const { rm } = await fs()
    await rm(this.filePath, { force: true })
  }

  async has(): Promise<boolean> {
    return (await this.get()) !== null
  }
}
