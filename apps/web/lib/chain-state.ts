// Journal of an on-chain migration: the snapshot of a contract before it changes, the
// amount already moved, the pending steps and every transaction hash, in one JSON file
// under `db/chain-state/`.
//
// It is deliberately free of project imports (only `fs` and `path`) so it can move to
// `m` unchanged — the candidate API is `@pasosdejesus/m/blockchain/chain-state`:
//
//   const store = await openChainState({
//     dir, contract: 'LearnTGVaults', from: 'V5', to: 'V6', network, chainId,
//     addresses: { from, to },
//     create: () => ({ ...baseFieldsWeNeedToday }),
//   })
//   store.file    // the typed file, loaded (resumed) or just created
//   store.save(); store.recordTx(step, hash); store.setPending('drainUsdt', amount)
//
// Why a journal and not a "backup": a dump in `db/backups/` is disposable and
// gitignored; this file is the only record of numbers that no longer exist on-chain
// (the source's per-course books are zeroed at the start), it is the audit trail of a
// migration and it is meant to be committed once the migration is verified.
//
// The rules it enforces:
//   * the file is written before the first transaction, so a crash never loses the
//     snapshot;
//   * resuming validates the base fields (contract, versions, network, chainId,
//     addresses): a file from another migration, another network or another pair of
//     contracts is refused instead of silently used;
//   * `transactions` grows one entry per sent transaction, so the operator can check
//     them one by one;
//   * the status is explicit (`running`, `verified`, `failed`), never inferred.

import * as fs from 'fs'
import * as path from 'path'

export const CHAIN_STATE_SCHEMA = 1

export interface ChainStateTx {
  step: string
  hash: string
  at: string
}

export interface ChainStateFile<TSnapshot = unknown> {
  schema: number
  contract: string
  from: string
  to: string
  network: string
  chainId: number
  addresses: Record<string, string>
  createdAt: string
  updatedAt: string
  status: 'running' | 'verified' | 'failed'
  snapshot?: TSnapshot
  /** Values written just before an irreversible step and cleared after it. */
  pending: Record<string, unknown>
  transactions: ChainStateTx[]
  problems?: string[]
  [extra: string]: unknown
}

export interface OpenChainStateOptions<TFile extends ChainStateFile<any>> {
  /** Absolute path of the folder, e.g. `apps/web/db/chain-state`. */
  dir: string
  contract: string
  from: string
  to: string
  network: string
  chainId: number
  addresses: Record<string, string>
  /** Built only when the file does not exist: it reads the chain, so it is lazy. */
  create: () => TFile | Promise<TFile>
}

export interface ChainStateStore<TFile extends ChainStateFile<any>> {
  path: string
  file: TFile
  resumed: boolean
  save(): void
  recordTx(step: string, hash: string): void
  setPending(name: string, value: unknown): void
  clearPending(name: string): void
  getPending<T = unknown>(name: string): T | undefined
  markVerified(): void
  fail(problems: string[]): void
}

/** The empty file of a migration, so a caller only adds its own fields. */
export function baseChainStateFile(options: {
  contract: string
  from: string
  to: string
  network: string
  chainId: number
  addresses: Record<string, string>
}): ChainStateFile<never> {
  const now = new Date().toISOString()
  return {
    schema: CHAIN_STATE_SCHEMA,
    ...options,
    createdAt: now,
    updatedAt: now,
    status: 'running',
    pending: {},
    transactions: [],
  }
}

export function chainStatePath(
  dir: string,
  contract: string,
  from: string,
  to: string,
  network: string,
): string {
  return path.join(dir, `${contract}-${from.toLowerCase()}-to-${to.toLowerCase()}-${network}.json`)
}

function assertSameMigration<TFile extends ChainStateFile<any>>(
  file: TFile,
  options: OpenChainStateOptions<TFile>,
): void {
  const expected: Array<[string, unknown, unknown]> = [
    ['contract', options.contract, file.contract],
    ['from', options.from, file.from],
    ['to', options.to, file.to],
    ['network', options.network, file.network],
    ['chainId', options.chainId, file.chainId],
  ]
  for (const [field, want, got] of expected) {
    if (want !== got) {
      throw new Error(
        `chain-state: the file belongs to another migration (${field} ${String(got)}, expected ${String(want)})`,
      )
    }
  }
  for (const [name, address] of Object.entries(options.addresses)) {
    const stored = file.addresses?.[name]
    if (!stored || stored.toLowerCase() !== address.toLowerCase()) {
      throw new Error(
        `chain-state: the file was written for a different ${name} address (${stored || 'none'}, expected ${address})`,
      )
    }
  }
  if (file.schema !== CHAIN_STATE_SCHEMA) {
    throw new Error(`chain-state: unsupported schema ${file.schema} (this code reads ${CHAIN_STATE_SCHEMA})`)
  }
}

export async function openChainState<TFile extends ChainStateFile<any>>(
  options: OpenChainStateOptions<TFile>,
): Promise<ChainStateStore<TFile>> {
  const file = chainStatePath(options.dir, options.contract, options.from, options.to, options.network)
  const resumed = fs.existsSync(file)

  let data: TFile
  if (resumed) {
    data = JSON.parse(fs.readFileSync(file, 'utf8')) as TFile
    assertSameMigration(data, options)
  } else {
    data = await options.create()
    data.schema = CHAIN_STATE_SCHEMA
    data.contract = options.contract
    data.from = options.from
    data.to = options.to
    data.network = options.network
    data.chainId = options.chainId
    data.addresses = options.addresses
    data.createdAt = data.createdAt || new Date().toISOString()
    data.status = data.status || 'running'
    data.pending = data.pending || {}
    data.transactions = data.transactions || []
  }

  const save = (): void => {
    data.updatedAt = new Date().toISOString()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(data, null, 2))
  }
  if (!resumed) save()

  return {
    path: file,
    file: data,
    resumed,
    save,
    recordTx(step: string, hash: string): void {
      data.transactions.push({ step, hash, at: new Date().toISOString() })
      save()
    },
    setPending(name: string, value: unknown): void {
      data.pending[name] = value
      save()
    },
    clearPending(name: string): void {
      delete data.pending[name]
      save()
    },
    getPending<T = unknown>(name: string): T | undefined {
      return data.pending[name] as T | undefined
    },
    markVerified(): void {
      data.status = 'verified'
      delete data.problems
      save()
    },
    fail(problems: string[]): void {
      data.status = 'failed'
      data.problems = problems
      save()
    },
  }
}
