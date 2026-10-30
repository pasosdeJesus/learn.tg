import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import {
  CHAIN_STATE_SCHEMA,
  chainStatePath,
  openChainState,
  type ChainStateFile,
} from '../chain-state'

interface Snapshot {
  courses: Array<{ courseId: number; balanceUsdt: string }>
}

type File = ChainStateFile<Snapshot> & { drained: string; pausedByUs: boolean }

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chain-state-'))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

const baseOptions = () => ({
  dir,
  contract: 'LearnTGVaults',
  from: 'V5',
  to: 'V6',
  network: 'celo',
  chainId: 42220,
  addresses: { from: '0xAAA', to: '0xBBB' },
  create: (): File => ({
    schema: 0,
    contract: '',
    from: '',
    to: '',
    network: '',
    chainId: 0,
    addresses: {},
    createdAt: '',
    updatedAt: '',
    status: 'running',
    snapshot: { courses: [{ courseId: 106, balanceUsdt: '8000000' }] },
    pending: {},
    transactions: [],
    drained: '0',
    pausedByUs: false,
  }),
})

describe('chainStatePath', () => {
  it('names the file after the contract, the versions and the network', () => {
    expect(chainStatePath('/x', 'LearnTGVaults', 'V5', 'V6', 'celo'))
      .toBe('/x/LearnTGVaults-v5-to-v6-celo.json')
  })
})

describe('openChainState', () => {
  it('creates the file with the schema, the base fields and no transactions', async () => {
    const store = await openChainState<File>(baseOptions())
    expect(store.resumed).toBe(false)
    expect(store.file.schema).toBe(CHAIN_STATE_SCHEMA)
    expect(store.file.contract).toBe('LearnTGVaults')
    expect(store.file.chainId).toBe(42220)
    expect(store.file.addresses).toEqual({ from: '0xAAA', to: '0xBBB' })
    expect(store.file.transactions).toEqual([])
    expect(fs.existsSync(store.path)).toBe(true)
  })

  it('resumes an existing file without rebuilding the snapshot', async () => {
    const first = await openChainState<File>(baseOptions())
    first.recordTx('pause', '0x01')
    first.setPending('drainUsdt', '8248137')

    let built = 0
    const second = await openChainState<File>({
      ...baseOptions(),
      create: () => { built++; return baseOptions().create() },
    })
    expect(second.resumed).toBe(true)
    expect(built).toBe(0)
    expect(second.file.snapshot?.courses[0].courseId).toBe(106)
    expect(second.file.transactions).toEqual([{ step: 'pause', hash: '0x01', at: expect.any(String) }])
    expect(second.getPending('drainUsdt')).toBe('8248137')
  })

  it('refuses a file whose chain or schema does not match', async () => {
    // The network and the versions are part of the file name, so a mismatch there means
    // another file; the chain and the schema can be wrong inside the right file.
    const store = await openChainState<File>(baseOptions())
    const onDisk = JSON.parse(fs.readFileSync(store.path, 'utf8'))

    fs.writeFileSync(store.path, JSON.stringify({ ...onDisk, chainId: 11142220 }))
    await expect(openChainState<File>(baseOptions()))
      .rejects.toThrow(/belongs to another migration \(chainId 11142220, expected 42220\)/)

    fs.writeFileSync(store.path, JSON.stringify({ ...onDisk, schema: 99 }))
    await expect(openChainState<File>(baseOptions()))
      .rejects.toThrow(/unsupported schema 99/)
  })

  it('refuses a file written for a different address', async () => {
    await openChainState<File>(baseOptions())
    await expect(openChainState<File>({
      ...baseOptions(),
      addresses: { from: '0xAAA', to: '0xCCC' },
    })).rejects.toThrow(/different to address/)
  })

  it('tracks pending values and clears them', async () => {
    const store = await openChainState<File>(baseOptions())
    store.setPending('drainSlearn', '30112')
    expect(JSON.parse(fs.readFileSync(store.path, 'utf8')).pending).toEqual({ drainSlearn: '30112' })
    store.clearPending('drainSlearn')
    expect(store.getPending('drainSlearn')).toBeUndefined()
    expect(JSON.parse(fs.readFileSync(store.path, 'utf8')).pending).toEqual({})
  })

  it('records verification and failure without inferring the status', async () => {
    const store = await openChainState<File>(baseOptions())
    store.fail(['recorded USDT != snapshot'])
    expect(store.file.status).toBe('failed')
    expect(store.file.problems).toEqual(['recorded USDT != snapshot'])

    store.markVerified()
    expect(store.file.status).toBe('verified')
    expect(store.file.problems).toBeUndefined()
    const onDisk = JSON.parse(fs.readFileSync(store.path, 'utf8'))
    expect(onDisk.status).toBe('verified')
  })
})
