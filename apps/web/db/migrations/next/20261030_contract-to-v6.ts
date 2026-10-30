// V5 -> V6 scholarship vault migration (proposal, not wired to `db:migrate`).
//
// It lives in `db/migrations/next/` on purpose: kysely-ctl reads only the files
// directly under `db/migrations` (`readdir`, not recursive), so `bin/m db:migrate`
// cannot run it by accident. When the operator decides, it moves one level up and
// `db:migrate` records it as applied.
//
// Design and rationale: `db/migrations/next/README.md`, `doc/LearnTGVaultsV6.md`,
// https://github.com/pasosdeJesus/learn.tg/issues/221
//
// Two rules and one accident guide every line here:
//   * every step is idempotent and convergent: it reads the chain, acts only on the
//     difference, and can run again after an interruption;
//   * the snapshot lives in a journal (`db/chain-state/LearnTGVaults-v5-to-v6-<network>.json`,
//     see `apps/web/lib/chain-state.ts`) written before the first transaction, because
//     after zeroing the source books the old numbers exist nowhere else;
//   * the V3->V4 migration was run twice on 2026-06-09/10 and its setVaultBalance
//     re-applied the snapshot, leaving 0.040910 USDT of extra books. Here the
//     balances are written only after the tokens arrive, a target with balances and
//     no state file aborts, and SLEARN is paused for the whole window.

import dotenv from 'dotenv'
dotenv.config({ path: '../.env' })
import { Kysely } from 'kysely'
import type { Address } from 'viem'
import { createPublicClient, http, formatUnits } from 'viem'
import { ethers } from 'ethers'
import { celo, celoSepolia } from 'viem/chains'
import * as fs from 'fs'
import * as path from 'path'

import { baseChainStateFile, openChainState, type ChainStateFile } from '../../../lib/chain-state'
import V5Abi from '../../../abis/LearnTGVaultsV5.json' with { type: 'json' }
import V6Abi from '../../../abis/next/LearnTGVaultsV6.json' with { type: 'json' }
import Erc20Abi from '../../../abis/IERC20.json' with { type: 'json' }
import { getNetwork, getV5Address, getV6Address } from '../_lib/contract-addresses'

const MAX_COURSE_ID = Number(process.env.V6_MAX_COURSE_ID || 200)
const BATCH_SIZE = 10

const SLEARN_ABI = [
  { name: 'pause', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'unpause', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'paused', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { name: 'learnTGVault', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'learnTGVaultSLEARN', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'setLearnTGVault', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] },
  { name: 'setLearnTGVaultSLEARN', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] },
  { name: 'authorizedTransfers', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }] },
  { name: 'addAuthorizedTransfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] },
] as const

interface CourseSnapshot {
  courseId: number
  balanceUsdt: bigint
  balanceSlearn: bigint
  perGuideUsdt: bigint
  perGuideSlearn: bigint
}

// The journal of `lib/chain-state` plus what this migration needs to remember.
// `pending` holds the withdrawal in flight (`drainUsdt` / `drainSlearn`), so a crash
// between the transaction and the bookkeeping is reconciled on the next run.
interface SnapshotJson {
  courseId: number
  balanceUsdt: string
  balanceSlearn: string
  perGuideUsdt: string
  perGuideSlearn: string
}

type V6State = ChainStateFile<SnapshotJson[]> & {
  pausedByUs: boolean
  drainedUsdt: string
  drainedSlearn: string
}

function fmt(value: bigint, decimals: number): string {
  return formatUnits(value, decimals)
}

function chainStateDir(): string {
  // `db/chain-state/`: the journal of an on-chain migration, kept and committed.
  // `db/backups/` is for the pg_dump output and is gitignored.
  const here = typeof __dirname !== 'undefined' ? __dirname : path.dirname(new URL(import.meta.url).pathname)
  return path.join(here, '..', '..', 'chain-state')
}

async function readSourceVault(pub: any, v5: Address, courseId: number): Promise<CourseSnapshot | null> {
  const row: any = await pub.readContract({
    address: v5, abi: V5Abi as any, functionName: 'vaults', args: [BigInt(courseId)],
  })
  if (!row || !row[5]) return null
  return {
    courseId,
    balanceUsdt: row[1] as bigint,
    balanceSlearn: row[2] as bigint,
    perGuideUsdt: row[3] as bigint,
    perGuideSlearn: row[4] as bigint,
  }
}

async function readTargetVault(pub: any, v6: Address, courseId: number): Promise<CourseSnapshot | null> {
  const row: any = await pub.readContract({
    address: v6, abi: V6Abi as any, functionName: 'vaults', args: [BigInt(courseId)],
  })
  if (!row || !row[5]) return null
  if (row.length > 6 && row[6]) {
    throw new Error(`course ${courseId} is retired in V6: it must not be migrated nor restored`)
  }
  return {
    courseId,
    balanceUsdt: row[1] as bigint,
    balanceSlearn: row[2] as bigint,
    perGuideUsdt: row[3] as bigint,
    perGuideSlearn: row[4] as bigint,
  }
}

interface MigrationContext {
  network: string
  chainId: number
  v5: Address
  v6: Address
  usdt: Address
  slearn: Address
}

async function buildState(pub: any, db: Kysely<any>, ctx: MigrationContext): Promise<V6State> {
  const { network, chainId, v5, v6, usdt, slearn } = ctx
  const chain = network === 'celo' ? celo : celoSepolia
  if (chainId !== chain.id) throw new Error(`the RPC answers chainId ${chainId}, expected ${chain.id} (${network})`)

  const [v5Version, v6Version] = await Promise.all([
    pub.readContract({ address: v5, abi: V5Abi as any, functionName: 'VERSION' }),
    pub.readContract({ address: v6, abi: V6Abi as any, functionName: 'VERSION' }),
  ])
  if (Number(v5Version) !== 5) throw new Error(`source ${v5} does not answer VERSION 5 (${v5Version})`)
  if (Number(v6Version) !== 6) throw new Error(`target ${v6} does not answer VERSION 6 (${v6Version})`)

  const [targetUsdt, targetSlearn] = await Promise.all([
    pub.readContract({ address: v6, abi: V6Abi as any, functionName: 'usdtToken' }) as Promise<Address>,
    pub.readContract({ address: v6, abi: V6Abi as any, functionName: 'slearnToken' }) as Promise<Address>,
  ])
  if (usdt.toLowerCase() !== targetUsdt.toLowerCase() || slearn.toLowerCase() !== targetSlearn.toLowerCase()) {
    throw new Error('the two vaults do not use the same USDT/SLEARN tokens')
  }

  const sourceState: any = await pub.readContract({ address: v5, abi: V6Abi as any, functionName: 'accountingState' }).catch(() => null)
  if (sourceState && sourceState[4]) {
    throw new Error('the source vault reports accountingBroken: reconcile it before migrating')
  }
  const targetState: any = await pub.readContract({ address: v6, abi: V6Abi as any, functionName: 'accountingState' })
  if (targetState[2] !== 0n || targetState[3] !== 0n || targetState[0] !== 0n || targetState[1] !== 0n || targetState[4]) {
    throw new Error(
      'the target has balances or totalRecorded and there is no state file: this is a foreign or half-done ' +
      'migration with unknown books, stop and reconcile by hand',
    )
  }

  const snapshot: CourseSnapshot[] = []
  for (let id = 1; id <= MAX_COURSE_ID; id++) {
    const row = await readSourceVault(pub, v5, id)
    if (row) snapshot.push(row)
  }
  const heldUsdt: bigint = sourceState
    ? sourceState[0]
    : await pub.readContract({ address: usdt, abi: Erc20Abi as any, functionName: 'balanceOf', args: [v5] })
  const heldSlearn: bigint = sourceState
    ? sourceState[1]
    : await pub.readContract({ address: slearn, abi: Erc20Abi as any, functionName: 'balanceOf', args: [v5] })
  let sumUsdt = 0n
  let sumSlearn = 0n
  for (const c of snapshot) {
    sumUsdt += c.balanceUsdt
    sumSlearn += c.balanceSlearn
  }
  if (sumUsdt > heldUsdt || sumSlearn > heldSlearn) {
    throw new Error(
      `the source books exceed its tokens (Σ ${fmt(sumUsdt, 6)}/${fmt(heldUsdt, 6)} USDT, ` +
      `${fmt(sumSlearn, 2)}/${fmt(heldSlearn, 2)} SLEARN): run make vault-check and reconcile first`,
    )
  }

  const known = new Set(
    (await db.selectFrom('cor1440_gen_proyectofinanciero').select('id').execute()).map(r => Number(r.id)),
  )
  for (const c of snapshot) {
    if (!known.has(c.courseId) && (c.balanceUsdt > 0n || c.balanceSlearn > 0n)) {
      throw new Error(
        `course ${c.courseId} has a balance but no row in cor1440_gen_proyectofinanciero: ` +
        'clean it on the source before migrating',
      )
    }
  }

  return {
    ...baseChainStateFile({
      contract: 'LearnTGVaults',
      from: 'V5',
      to: 'V6',
      network,
      chainId,
      addresses: { from: v5, to: v6, usdt, slearn },
    }),
    snapshot: snapshot.map(c => ({
      courseId: c.courseId,
      balanceUsdt: c.balanceUsdt.toString(),
      balanceSlearn: c.balanceSlearn.toString(),
      perGuideUsdt: c.perGuideUsdt.toString(),
      perGuideSlearn: c.perGuideSlearn.toString(),
    })),
    pausedByUs: false,
    drainedUsdt: '0',
    drainedSlearn: '0',
  }
}

function snapshotOf(state: V6State): CourseSnapshot[] {
  if (!state.snapshot) throw new Error('the journal has no snapshot: it was not created by this migration')
  return state.snapshot.map(c => ({
    courseId: c.courseId,
    balanceUsdt: BigInt(c.balanceUsdt),
    balanceSlearn: BigInt(c.balanceSlearn),
    perGuideUsdt: BigInt(c.perGuideUsdt),
    perGuideSlearn: BigInt(c.perGuideSlearn),
  }))
}

function printState(state: V6State, path: string, usdtDecimals: number, slearnDecimals: number): void {
  const snapshot = snapshotOf(state)
  const sumUsdt = snapshot.reduce((a, c) => a + c.balanceUsdt, 0n)
  const sumSlearn = snapshot.reduce((a, c) => a + c.balanceSlearn, 0n)
  console.log(`V5 -> V6 migration (${state.network}, chainId ${state.chainId})`)
  console.log(`  V5 ${state.addresses.from}`)
  console.log(`  V6 ${state.addresses.to}`)
  console.log(`  estado: ${path}`)
  console.log(`  iniciada: ${state.createdAt}, estado: ${state.status}`)
  console.log('')
  console.log('  Curso   libro USDT      libro SLEARN    por guía')
  for (const c of snapshot) {
    console.log(
      `  ${String(c.courseId).padEnd(7)} ${fmt(c.balanceUsdt, usdtDecimals).padStart(13)} ` +
      `${fmt(c.balanceSlearn, slearnDecimals).padStart(15)}    ` +
      `${fmt(c.perGuideUsdt, usdtDecimals)}/${fmt(c.perGuideSlearn, slearnDecimals)}`,
    )
  }
  console.log('')
  console.log(`  Σ snapshot    ${fmt(sumUsdt, usdtDecimals)} USDT / ${fmt(sumSlearn, slearnDecimals)} SLEARN`)
  console.log(`  drenado       ${fmt(BigInt(state.drainedUsdt), usdtDecimals)} USDT / ${fmt(BigInt(state.drainedSlearn), slearnDecimals)} SLEARN`)
  console.log(`  transacciones ${state.transactions.length}`)
  if (state.problems?.length) console.log(`  problemas: ${state.problems.join('; ')}`)
}

export async function up(db: Kysely<any>): Promise<void> {
  // `V6_MIGRATION_DRY_RUN=1` prints the plan and raises, so kysely-ctl records the
  // migration as failed and does not mark it as applied: the operator reviews the
  // table and runs it again for real.
  if (process.env.V6_MIGRATION_DRY_RUN === '1') {
    await run(db, { dryRun: true })
    throw new Error('dry run: the plan was printed and nothing was written (the migration is NOT recorded)')
  }
  return run(db, { dryRun: false })
}

export async function run(db: Kysely<any>, options: { dryRun: boolean }): Promise<void> {
  const network = getNetwork()
  const PRIVATE_KEY = process.env.PRIVATE_KEY
  const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL
  if (!PRIVATE_KEY) throw new Error('Missing PRIVATE_KEY (the owner wallet of the vaults)')
  if (!RPC_URL) throw new Error('Missing NEXT_PUBLIC_RPC_URL')

  const chain = network === 'celo' ? celo : celoSepolia
  const pub = createPublicClient({ chain, transport: http(RPC_URL) })
  // ethers signs: viem's `viem/accounts` subpath does not resolve under `tsx` on this
  // platform (the "types" condition wins); it does under kysely-ctl's jiti. Ethers is
  // already a dependency and keeps the file usable both ways.
  const wallet = new ethers.Wallet(PRIVATE_KEY, new ethers.JsonRpcProvider(RPC_URL))

  const v5 = getV5Address()
  const v6 = (process.env.V6_ADDRESS as Address) || getV6Address()
  const [chainId, usdt, slearn] = await Promise.all([
    pub.getChainId(),
    pub.readContract({ address: v5, abi: V5Abi as any, functionName: 'usdtToken' }) as Promise<Address>,
    pub.readContract({ address: v5, abi: V5Abi as any, functionName: 'slearnToken' }) as Promise<Address>,
  ])
  const ctx: MigrationContext = { network, chainId, v5, v6, usdt, slearn }
  const store = await openChainState<V6State>({
    dir: chainStateDir(),
    contract: 'LearnTGVaults',
    from: 'V5',
    to: 'V6',
    network,
    chainId,
    addresses: { from: v5, to: v6, usdt, slearn },
    create: () => buildState(pub, db, ctx),
  })
  const state = store.file
  const file = store.path
  const progressFile = file.replace(/\.json$/, '-guidepaid.json')
  if (store.resumed) {
    console.log(`Resuming the migration started at ${state.createdAt} (${state.transactions.length} transactions so far)`)
  } else {
    console.log(`New migration, journal written to ${file}`)
  }

  const [usdtDecimals, slearnDecimals] = await Promise.all([
    pub.readContract({ address: state.addresses.usdt as Address, abi: Erc20Abi as any, functionName: 'decimals' }) as Promise<number>,
    pub.readContract({ address: state.addresses.slearn as Address, abi: Erc20Abi as any, functionName: 'decimals' }) as Promise<number>,
  ]).then(([u, s]) => [Number(u), Number(s)] as [number, number])
  printState(state, file, usdtDecimals, slearnDecimals)
  console.log('')

  if (options.dryRun) {
    console.log('[dry-run] nothing was written.')
    return
  }
  if (process.env.V6_MIGRATION_CONFIRM !== network) {
    throw new Error(
      `refusing to move money without V6_MIGRATION_CONFIRM=${network} (got ${process.env.V6_MIGRATION_CONFIRM || 'nothing'})`,
    )
  }
  const owner = (await pub.readContract({ address: state.addresses.from as Address, abi: V5Abi as any, functionName: 'owner' })) as string
  if (wallet.address.toLowerCase() !== owner.toLowerCase()) {
    throw new Error(`the configured key (${wallet.address}) is not the owner of V5`)
  }

  const snapshot = snapshotOf(state)
  const sumUsdt = snapshot.reduce((a, c) => a + c.balanceUsdt, 0n)
  const sumSlearn = snapshot.reduce((a, c) => a + c.balanceSlearn, 0n)

  async function sendTx(address: Address, abi: any, functionName: string, args: any[], step: string): Promise<void> {
    let lastErr: any = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const contract = new ethers.Contract(address, abi as any, wallet)
        const tx = await contract[functionName](...args)
        const receipt = await tx.wait()
        if (!receipt || receipt.status !== 1) throw new Error(`${step}: transaction ${tx.hash} failed`)
        store.recordTx(step, tx.hash)
        console.log(`  [ok] ${step} ${tx.hash}`)
        return
      } catch (e: any) {
        lastErr = e
        const msg = e?.shortMessage || e?.message || String(e)
        if (!/nonce|replacement/i.test(msg)) throw e
        console.log(`  [nonce] retry ${attempt + 1}: ${msg.slice(0, 80)}`)
        await new Promise(r => setTimeout(r, 2000))
      }
    }
    throw lastErr
  }

  async function pauseSlearn(): Promise<void> {
    const paused = (await pub.readContract({ address: (state.addresses.slearn as Address), abi: SLEARN_ABI as any, functionName: 'paused' })) as boolean
    if (paused) {
      console.log('  SLEARN already paused')
      return
    }
    await sendTx((state.addresses.slearn as Address), SLEARN_ABI, 'pause', [], 'pause SLEARN')
    state.pausedByUs = true
    store.save()
  }

  async function zeroSourceBooks(): Promise<void> {
    // Fail fast if any book moved since the snapshot: a purchase or a payment during
    // the window would make the restored numbers wrong.
    const drift: string[] = []
    for (const c of snapshot) {
      const now = await readSourceVault(pub, (state.addresses.from as Address), c.courseId)
      if (!now) continue
      const untouched = now.balanceUsdt === 0n && now.balanceSlearn === 0n
      if (untouched) continue
      if (now.balanceUsdt !== c.balanceUsdt || now.balanceSlearn !== c.balanceSlearn) {
        drift.push(`${c.courseId} (${fmt(now.balanceUsdt, usdtDecimals)}/${fmt(now.balanceSlearn, slearnDecimals)})`)
      }
    }
    if (drift.length > 0) {
      throw new Error(
        `the source books changed since the snapshot: ${drift.join(', ')}. ` +
        'A purchase or a payment happened during the migration, reconcile by hand',
      )
    }

    for (const c of snapshot) {
      if (c.balanceUsdt === 0n && c.balanceSlearn === 0n) continue
      const now = await readSourceVault(pub, (state.addresses.from as Address), c.courseId)
      if (!now) continue
      if (now.balanceUsdt === 0n && now.balanceSlearn === 0n) {
        console.log(`  course ${c.courseId}: books already at zero`)
        continue
      }
      if (now.balanceUsdt !== c.balanceUsdt || now.balanceSlearn !== c.balanceSlearn) {
        throw new Error(
          `course ${c.courseId} books changed since the snapshot ` +
          `(${fmt(now.balanceUsdt, usdtDecimals)}/${fmt(now.balanceSlearn, slearnDecimals)} now, ` +
          `${fmt(c.balanceUsdt, usdtDecimals)}/${fmt(c.balanceSlearn, slearnDecimals)} expected): ` +
          'a payment or a purchase happened during the migration, reconcile by hand',
        )
      }
      await sendTx((state.addresses.from as Address), V5Abi, 'setVaultBalance', [BigInt(c.courseId), 0n, 0n], `V5 zero books course ${c.courseId}`)
    }
  }

  async function drainSource(): Promise<void> {
    const balance = async (token: Address): Promise<bigint> =>
      await pub.readContract({ address: token, abi: Erc20Abi as any, functionName: 'balanceOf', args: [state.addresses.from as Address] }) as bigint

    // Reconcile a withdrawal that the previous run may have sent just before dying:
    // if the balance is already zero, it went through.
    for (const [name, token, drainedKey, decimals] of [
      ['drainUsdt', state.addresses.usdt as Address, 'drainedUsdt', usdtDecimals],
      ['drainSlearn', state.addresses.slearn as Address, 'drainedSlearn', slearnDecimals],
    ] as const) {
      const pending = store.getPending<string>(name)
      if (!pending) continue
      if ((await balance(token)) === 0n) {
        state[drainedKey] = (BigInt(state[drainedKey]) + BigInt(pending)).toString()
        console.log(`  ${name}: the previous run withdrew ${fmt(BigInt(pending), decimals)} before stopping; accounted`)
      } else {
        console.log(`  ${name}: the previous run did not withdraw; retrying`)
      }
      store.clearPending(name)
    }

    const heldUsdt = await balance(state.addresses.usdt as Address)
    if (heldUsdt > 0n) {
      store.setPending('drainUsdt', heldUsdt.toString())
      await sendTx(state.addresses.from as Address, V5Abi, 'emergencyWithdrawUSDT', [heldUsdt], 'V5 withdraw USDT')
      state.drainedUsdt = (BigInt(state.drainedUsdt) + heldUsdt).toString()
      store.clearPending('drainUsdt')
    }
    const heldSlearn = await balance(state.addresses.slearn as Address)
    if (heldSlearn > 0n) {
      store.setPending('drainSlearn', heldSlearn.toString())
      await sendTx(state.addresses.from as Address, V5Abi, 'emergencyWithdrawSLEARN', [heldSlearn], 'V5 withdraw SLEARN')
      state.drainedSlearn = (BigInt(state.drainedSlearn) + heldSlearn).toString()
      store.clearPending('drainSlearn')
    }
  }

  async function sendToTarget(): Promise<void> {
    const targetUsdt = await pub.readContract({ address: (state.addresses.usdt as Address), abi: Erc20Abi as any, functionName: 'balanceOf', args: [(state.addresses.to as Address)] }) as bigint
    const targetSlearn = await pub.readContract({ address: (state.addresses.slearn as Address), abi: Erc20Abi as any, functionName: 'balanceOf', args: [(state.addresses.to as Address)] }) as bigint
    const drainedUsdt = BigInt(state.drainedUsdt)
    const drainedSlearn = BigInt(state.drainedSlearn)
    if (targetUsdt > drainedUsdt || targetSlearn > drainedSlearn) {
      throw new Error(
        `V6 holds more than this migration drained (USDT ${fmt(targetUsdt, usdtDecimals)} > ${fmt(drainedUsdt, usdtDecimals)}, ` +
        `SLEARN ${fmt(targetSlearn, slearnDecimals)} > ${fmt(drainedSlearn, slearnDecimals)}): ` +
        'the state file does not describe this target, stop and reconcile by hand',
      )
    }
    const missingUsdt = drainedUsdt - targetUsdt
    const missingSlearn = drainedSlearn - targetSlearn
    if (missingUsdt > 0n) await sendTx((state.addresses.usdt as Address), Erc20Abi, 'transfer', [(state.addresses.to as Address), missingUsdt], 'USDT -> V6')
    if (missingSlearn > 0n) await sendTx((state.addresses.slearn as Address), Erc20Abi, 'transfer', [(state.addresses.to as Address), missingSlearn], 'SLEARN -> V6')
  }

  async function loadPairs(): Promise<Array<{ usuarioId: number; courseId: number; guideId: number }>> {
    const progressFile = file.replace(/\.json$/, '-guidepaid.json')
    const migrated: string[] = fs.existsSync(progressFile) ? JSON.parse(fs.readFileSync(progressFile, 'utf8')) : []
    const migratedSet = new Set(migrated)
    const planCourseIds = new Set(snapshot.map(c => c.courseId))
    const txs = await db.selectFrom('transaction').select(['usuario_id', 'metadata']).where('type', '=', 'scholarship').execute()
    const pairs: Array<{ usuarioId: number; courseId: number; guideId: number }> = []
    const seen = new Set<string>()
    for (const tx of txs) {
      try {
        const meta = typeof tx.metadata === 'string' ? JSON.parse(tx.metadata) : (tx.metadata as any || {})
        const guideId = Number(meta?.guideId)
        const courseId = Number(meta?.courseId)
        if (!guideId || !courseId || !planCourseIds.has(courseId)) continue
        const key = `${tx.usuario_id}:${courseId}:${guideId}`
        if (seen.has(key) || migratedSet.has(key)) continue
        seen.add(key)
        pairs.push({ usuarioId: tx.usuario_id, courseId, guideId })
      } catch {}
    }
    return pairs
  }

  async function createVaults(pairs: Array<{ courseId: number }>): Promise<void> {
    const needed = new Set<number>(
      snapshot.filter(c => c.balanceUsdt > 0n || c.balanceSlearn > 0n).map(c => c.courseId),
    )
    for (const p of pairs) needed.add(p.courseId)
    for (const c of snapshot) {
      if (!needed.has(c.courseId)) continue
      const exists = await readTargetVault(pub, (state.addresses.to as Address), c.courseId).catch(() => null)
      if (exists) continue
      await sendTx((state.addresses.to as Address), V6Abi, 'createVault', [BigInt(c.courseId), c.perGuideUsdt, c.perGuideSlearn], `V6 createVault ${c.courseId}`)
    }
  }

  async function restoreBalances(): Promise<void> {
    for (const c of snapshot) {
      if (c.balanceUsdt === 0n && c.balanceSlearn === 0n) continue
      const now = await readTargetVault(pub, (state.addresses.to as Address), c.courseId)
      if (!now) throw new Error(`course ${c.courseId} has a balance but no vault in V6`)
      if (now.balanceUsdt === c.balanceUsdt && now.balanceSlearn === c.balanceSlearn) {
        console.log(`  course ${c.courseId}: balance already restored`)
        continue
      }
      await sendTx((state.addresses.to as Address), V6Abi, 'setVaultBalance', [BigInt(c.courseId), c.balanceUsdt, c.balanceSlearn], `V6 setVaultBalance ${c.courseId}`)
    }
  }

  async function repointSlearn(): Promise<void> {
    const role = await pub.readContract({ address: (state.addresses.to as Address), abi: V6Abi as any, functionName: 'slearnContractRole', args: [(state.addresses.slearn as Address)] })
    if (role !== true) {
      await sendTx((state.addresses.to as Address), V6Abi, 'setSlearnContractRole', [(state.addresses.slearn as Address), true], 'V6 authorize SLEARN')
    }
    const vault = (await pub.readContract({ address: (state.addresses.slearn as Address), abi: SLEARN_ABI as any, functionName: 'learnTGVault' })) as string
    if (vault.toLowerCase() !== (state.addresses.to as Address).toLowerCase()) {
      await sendTx((state.addresses.slearn as Address), SLEARN_ABI, 'setLearnTGVault', [(state.addresses.to as Address)], 'SLEARN.learnTGVault -> V6')
    }
    const vaultSlearn = (await pub.readContract({ address: (state.addresses.slearn as Address), abi: SLEARN_ABI as any, functionName: 'learnTGVaultSLEARN' })) as string
    if (vaultSlearn.toLowerCase() !== (state.addresses.to as Address).toLowerCase()) {
      await sendTx((state.addresses.slearn as Address), SLEARN_ABI, 'setLearnTGVaultSLEARN', [(state.addresses.to as Address)], 'SLEARN.learnTGVaultSLEARN -> V6')
    }
    const authorized = await pub.readContract({ address: (state.addresses.slearn as Address), abi: SLEARN_ABI as any, functionName: 'authorizedTransfers', args: [(state.addresses.to as Address)] })
    if (authorized !== true) {
      await sendTx((state.addresses.slearn as Address), SLEARN_ABI, 'addAuthorizedTransfer', [(state.addresses.to as Address)], 'SLEARN authorize V6 transfers')
    }
  }

  async function copyGuidePaid(pairs: Array<{ usuarioId: number; courseId: number; guideId: number }>): Promise<void> {
    const progressFile = file.replace(/\.json$/, '-guidepaid.json')
    const migrated: string[] = fs.existsSync(progressFile) ? JSON.parse(fs.readFileSync(progressFile, 'utf8')) : []
    console.log(`  guidePaid: ${pairs.length} pairs pending`)
    for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
      for (const p of pairs.slice(i, i + BATCH_SIZE)) {
        const key = `${p.usuarioId}:${p.courseId}:${p.guideId}`
        const bw = await db.selectFrom('billetera_usuario').select('billetera').where('usuario_id', '=', p.usuarioId).executeTakeFirst()
        if (!bw) continue
        const source: any = await pub.readContract({
          address: (state.addresses.from as Address), abi: V5Abi, functionName: 'getStudentGuideStatus',
          args: [BigInt(p.courseId), BigInt(p.guideId), bw.billetera as Address],
        })
        if (source[0] === 0n && source[1] === 0n) {
          migrated.push(key)
          fs.writeFileSync(progressFile, JSON.stringify(migrated))
          continue
        }
        const target: any = await pub.readContract({
          address: (state.addresses.to as Address), abi: V6Abi, functionName: 'getStudentGuideStatus',
          args: [BigInt(p.courseId), BigInt(p.guideId), bw.billetera as Address],
        })
        if (source[0] > target[0] || source[1] > target[1]) {
          await sendTx((state.addresses.to as Address), V6Abi, 'setGuidePaid',
            [BigInt(p.courseId), BigInt(p.guideId), bw.billetera as Address, source[0], source[1]],
            `V6 setGuidePaid ${p.courseId}/${p.guideId}`)
        }
        migrated.push(key)
        fs.writeFileSync(progressFile, JSON.stringify(migrated))
      }
    }
  }

  async function verify(): Promise<void> {
    const stateOnChain: any = await pub.readContract({ address: (state.addresses.to as Address), abi: V6Abi as any, functionName: 'accountingState' })
    const [heldUsdt, heldSlearn, recordedUsdt, recordedSlearn, broken] = stateOnChain as [bigint, bigint, bigint, bigint, boolean]
    const problems: string[] = []
    if (broken) problems.push('accountingBroken is set in V6')
    if (recordedUsdt !== sumUsdt) problems.push(`recorded USDT ${fmt(recordedUsdt, usdtDecimals)} != snapshot ${fmt(sumUsdt, usdtDecimals)}`)
    if (recordedSlearn !== sumSlearn) problems.push(`recorded SLEARN ${fmt(recordedSlearn, slearnDecimals)} != snapshot ${fmt(sumSlearn, slearnDecimals)}`)
    if (heldUsdt !== BigInt(state.drainedUsdt)) problems.push(`held USDT ${fmt(heldUsdt, usdtDecimals)} != drained ${fmt(BigInt(state.drainedUsdt), usdtDecimals)}`)
    if (heldSlearn !== BigInt(state.drainedSlearn)) problems.push(`held SLEARN ${fmt(heldSlearn, slearnDecimals)} != drained ${fmt(BigInt(state.drainedSlearn), slearnDecimals)}`)
    for (const c of snapshot) {
      const now = await readTargetVault(pub, (state.addresses.to as Address), c.courseId).catch(() => null)
      if (!now) { problems.push(`course ${c.courseId} missing in V6`); continue }
      if (now.balanceUsdt !== c.balanceUsdt || now.balanceSlearn !== c.balanceSlearn) {
        problems.push(`course ${c.courseId} balance differs from the snapshot`)
      }
    }
    if (problems.length > 0) store.fail(problems)
    else store.markVerified()
    if (problems.length > 0) {
      throw new Error(`migration finished with accounting problems (SLEARN stays paused): ${problems.join('; ')}`)
    }
    console.log('  [ok] accountingState matches the snapshot')
  }

  await pauseSlearn()
  await zeroSourceBooks()
  await drainSource()
  await sendToTarget()
  const pairs = await loadPairs()
  await createVaults(pairs)
  await restoreBalances()
  await repointSlearn()
  await copyGuidePaid(pairs)
  await verify()

  if (state.pausedByUs) {
    await sendTx(state.addresses.slearn as Address, SLEARN_ABI, 'unpause', [], 'unpause SLEARN')
    state.pausedByUs = false
    store.save()
  }

  console.log('')
  console.log('V5 -> V6 migration complete. Next steps:')
  console.log(`  1. cd apps/web && make vault-check ARGS="--network ${network}"`)
  console.log('  2. point NEXT_PUBLIC_DEPLOYED_AT_V6 (or the deployments file) at V6 and restart Next')
  console.log(`  3. keep ${file} with the transaction hashes`)
}

export async function down(_db: Kysely<any>): Promise<void> {
  // Tokens and balances have moved: a rollback is a manual migration, not a code path.
}
