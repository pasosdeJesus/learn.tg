#!/usr/bin/env node
/**
 * reconcile-scholarships.ts
 *
 * Reconcilia las becas de crucigrama con la cadena **sin escanear bloques**: recorre las
 * direcciones que ya están en la base (`billetera_usuario` × `guide_usuario`) y, por cada
 * (curso, guía, billetera) con la guía completada, lee `getStudentGuideStatus` del vault V5.
 * Si la cadena dice que un token se pagó y no hay su fila en `transaction`
 * (pagos anteriores al registro por token de https://github.com/pasosdeJesus/learn.tg/issues/279,
 * o migrados de vaults anteriores), la escribe **con el hash de la transacción que la pagó**
 * (la prueba on-chain), recuperado del índice del explorador por dirección.
 *
 * El hash se busca con alcance de **dirección**, no de bloques: se listan las
 * transferencias entrantes de USDT/SLEARN de la billetera (paginadas por el explorador),
 * se lee cada transacción y, si su método es `payScholarship`, se toman
 * `(courseId, guideId, student)` de los parámetros decodificados. Así también aparecen
 * los vaults históricos (V3/V4) sin listarlos a mano. Si un hash no aparece, se reporta
 * (no se inventa).
 *
 * Se corre con **`node` simple** (Node ≥ 22.18 quita los tipos solo), no con `tsx`: tsx
 * resuelve la condición `types` de `viem` y termina cargando `_types/*.js` (que no
 * existen) → `ERR_MODULE_NOT_FOUND`. Por eso no hay imports relativos sin extensión: si
 * se agregan, hay que escribir `'./x.ts'` (el tsconfig ya permite
 * `allowImportingTsExtensions`).
 *
 * Uso:
 *   cd apps/nextjs
 *   node scripts/reconcile-scholarships.ts                 # informe (no escribe)
 *   node scripts/reconcile-scholarships.ts --fix           # escribe lo que falte
 *   node scripts/reconcile-scholarships.ts --fix --wallet 0x… --course 2 --limit 200
 *
 * Variables: `BLOCKSCOUT_API_URL` sobreescribe el explorador (por defecto Celo mainnet o
 * Celo Sepolia según `NEXT_PUBLIC_NETWORK`).
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'
import { createPublicClient, http, type Address } from 'viem'
import {
  resolveNetwork,
  SLEARN_ADDRESSES,
  USDT_ADDRESSES,
} from '@pasosdejesus/mpdj/blockchain/ecosystem-addresses'
import {
  missingScholarshipTokens,
  recordedScholarshipTokens,
  recordMissingScholarshipRows,
  type ScholarshipToken,
} from '@learn-tg/rewards/lib/scholarship-records'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const APP_DIR = path.join(HERE, '..')

// `.env` de la app (apps/.env), como `scripts/verify-v5-migration.ts`.
dotenv.config({ path: path.join(APP_DIR, '..', '.env') })

// Sólo lo que el script lee del vault; evita depender del ABI completo.
const STATUS_ABI = [
  {
    name: 'getStudentGuideStatus',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'address' }],
    outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'bool' }],
  },
  {
    name: 'usdtToken',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'slearnToken',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

interface Candidate {
  usuario_id: number
  billetera: string
  course_id: number
  guide_id: number
}

type HashByToken = Partial<Record<ScholarshipToken, string>>

const DEFAULT_BLOCKSCOUT: Record<string, string> = {
  celo: 'https://celo.blockscout.com',
  celoSepolia: 'https://celo-sepolia.blockscout.com',
}

function flag(args: string[], name: string): string | null {
  const index = args.indexOf(name)
  return index >= 0 && index + 1 < args.length ? args[index + 1] : null
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Origen de una URL (sin credenciales ni ruta: los RPC suelen llevar la API key ahí). */
function safeOrigin(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return '(URL inválida)'
  }
}

/** GET JSON con reintento simple ante 429/5xx (los exploradores públicos limitan). */
async function fetchJson(url: string, attempts = 3): Promise<any> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const response = await fetch(url, { headers: { accept: 'application/json' } })
    if (response.ok) return response.json()
    if (attempt === attempts || (response.status < 500 && response.status !== 429)) {
      throw new Error(`HTTP ${response.status} ${url}`)
    }
    await sleep(500 * attempt)
  }
  return null
}

/**
 * Índice (curso, guía, billetera) → hash por token, leyendo el historial de la
 * billetera en el explorador. Se apoya en las transferencias entrantes de USDT/SLEARN
 * (pocas): cada una viene de un vault y su transacción lleva `payScholarship(...)`.
 */
async function walletHashIndex(
  blockscout: string,
  wallet: string,
  tokenAddresses: string[],
): Promise<Map<string, HashByToken>> {
  const index = new Map<string, HashByToken>()
  const walletLower = wallet.toLowerCase()
  const seenTx = new Set<string>()

  for (const token of tokenAddresses) {
    let url: string | null =
      `${blockscout}/api/v2/addresses/${wallet}/token-transfers?type=ERC-20&token=${token}`
    for (let page = 0; page < 10 && url; page++) {
      const body = await fetchJson(url)
      for (const item of body?.items ?? []) {
        const to = String(item?.to?.hash ?? '').toLowerCase()
        if (to !== walletLower) continue
        if (item?.transaction_hash) seenTx.add(item.transaction_hash)
      }
      const next = body?.next_page_params
      url = next
        ? `${blockscout}/api/v2/addresses/${wallet}/token-transfers?type=ERC-20&token=${token}&index=${next.index}&block_number=${next.block_number}`
        : null
    }
  }

  for (const hash of seenTx) {
    const tx = await fetchJson(`${blockscout}/api/v2/transactions/${hash}`)
    const method: string = tx?.decoded_input?.method_call ?? tx?.method ?? ''
    if (!method.startsWith('payScholarship')) continue
    const params: Array<{ name: string; value: unknown }> = tx?.decoded_input?.parameters ?? []
    const courseId = Number(params.find((p) => p.name === 'courseId')?.value)
    const guideId = Number(params.find((p) => p.name === 'guideId')?.value)
    const student = String(params.find((p) => p.name === 'student')?.value ?? '').toLowerCase()
    if (!Number.isFinite(courseId) || !Number.isFinite(guideId) || student !== walletLower) continue

    const transfers = (await fetchJson(`${blockscout}/api/v2/transactions/${hash}/token-transfers`))?.items ?? []
    const key = `${courseId}:${guideId}:${walletLower}`
    const entry = index.get(key) ?? {}
    for (const transfer of transfers) {
      const to = String(transfer?.to?.hash ?? '').toLowerCase()
      if (to !== walletLower) continue
      const symbol = String(transfer?.token?.symbol ?? '').toUpperCase()
      if (symbol === 'USDT') entry.usdt = hash
      else if (symbol === 'SLEARN') entry.slearn = hash
    }
    if (Object.keys(entry).length > 0) index.set(key, entry)
  }
  return index
}

/** Kysely sobre PG* del `.env` (igual que `../.config/kysely-db.ts`). */
function newKyselyPostgresql(): Kysely<any> {
  const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'
  return new Kysely({
    dialect: new PostgresDialect({
      pool: new pg.Pool({
        host: process.env.PGHOST,
        database: isTest ? (process.env.PGDATABASE_TEST || process.env.PGDATABASE) : process.env.PGDATABASE,
        user: isTest ? (process.env.PGUSER_TEST || process.env.PGUSER) : process.env.PGUSER,
        password: isTest ? (process.env.PGPASSWORD_TEST || process.env.PGPASSWORD) : process.env.PGPASSWORD,
        port: 5432,
      }),
    }),
  })
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    console.log(`
Uso: node scripts/reconcile-scholarships.ts [OPCIONES]

  --fix             Escribe en la base las filas de beca que falten (por defecto sólo informa)
  --wallet 0x…      Limita a una billetera
  --course N        Limita a un curso (proyectofinanciero_id)
  --limit N         Limita el número de (curso, guía, billetera) revisados
  --concurrency N   Lecturas en paralelo al RPC (por defecto 4)
  --no-hashes       No consulta el explorador (escribe con hash nulo; más rápido)
  --help            Esta ayuda

La cadena es la autoridad para el monto (getStudentGuideStatus) y el explorador para el
hash (la prueba on-chain), siempre por dirección. No escanea bloques.
`)
    process.exit(0)
  }

  const fix = args.includes('--fix')
  const noHashes = args.includes('--no-hashes')
  const onlyWallet = flag(args, '--wallet')
  const onlyCourse = flag(args, '--course')
  const limit = flag(args, '--limit') ? parseInt(flag(args, '--limit')!, 10) : 0
  const concurrency = Math.max(1, parseInt(flag(args, '--concurrency') ?? '4', 10))

  const rpc = process.env.NEXT_PUBLIC_RPC_URL
  if (!rpc) {
    console.error('[FAIL] NEXT_PUBLIC_RPC_URL no está definido (apps/.env)')
    process.exit(1)
  }
  const network = process.env.NEXT_PUBLIC_NETWORK === 'celo' ? 'celo' : 'celoSepolia'
  const blockscout = process.env.BLOCKSCOUT_API_URL || DEFAULT_BLOCKSCOUT[network]
  const usdtDecimals = +(process.env.NEXT_PUBLIC_USDT_DECIMALS || 6)

  // El vault se lee del despliegue (como `scripts/verify-v5-migration.ts`) y no del motor
  // `rewards`, para que el script dependa sólo de lo que la app resuelve.
  const deploymentFile = path.join(APP_DIR, '..', 'hardhat', 'deployments', 'LearnTGVaults', 'V5', `${network}.json`)
  if (!fs.existsSync(deploymentFile)) {
    console.error(`[FAIL] no hay despliegue V5 para ${network}: ${deploymentFile}`)
    process.exit(1)
  }
  const vault = JSON.parse(fs.readFileSync(deploymentFile, 'utf8')).address as Address

  const publicClient = createPublicClient({ transport: http(rpc) })
  // Direcciones de token: la autoridad es el propio vault (`usdtToken()`/`slearnToken()`).
  // El mapa de `mpdj` sale de `NEXT_PUBLIC_USDT_ADDRESS`/`NEXT_PUBLIC_SLEARN_ADDRESS` y en
  // un despliegue sin esas variables queda `undefined`; se usa sólo para contrastar.
  const mpdjNetwork = resolveNetwork()
  const usdtAddress = USDT_ADDRESSES[mpdjNetwork]
  const slearnAddress = SLEARN_ADDRESSES[mpdjNetwork]
  const [vaultUsdt, vaultSlearn] = await Promise.all([
    publicClient.readContract({ address: vault, abi: STATUS_ABI, functionName: 'usdtToken' }),
    publicClient.readContract({ address: vault, abi: STATUS_ABI, functionName: 'slearnToken' }),
  ])
  const tokenAddresses = [String(vaultUsdt), String(vaultSlearn)]

  const db = newKyselyPostgresql()

  let query = db
    .selectFrom('guide_usuario as gu')
    .innerJoin('billetera_usuario as bu', 'bu.usuario_id', 'gu.usuario_id')
    .innerJoin('cor1440_gen_actividadpf as ap', 'ap.id', 'gu.actividadpf_id')
    .select([
      'gu.usuario_id as usuario_id',
      'bu.billetera as billetera',
      'ap.proyectofinanciero_id as course_id',
      'gu.actividadpf_id as guide_id',
    ])
    .where('gu.points', '=', 1)
    .distinct()

  if (onlyWallet) query = query.where('bu.billetera', '=', onlyWallet.toLowerCase())
  if (onlyCourse) query = query.where('ap.proyectofinanciero_id', '=', +onlyCourse)

  let candidates = (await query.execute()) as Candidate[]
  candidates = candidates.filter((c) => c.course_id != null && c.guide_id != null)
  if (limit > 0) candidates = candidates.slice(0, limit)

  // Diagnóstico del entorno: sirve para cazar desajustes de red/token (el panel de la
  // billetera usa NEXT_PUBLIC_*; el script y el vault usan lo que la cadena dice). Las
  // variables pueden faltar en un despliegue; eso no detiene el script: manda el vault.
  const mismatch = (a: string | undefined, b: string | undefined) => {
    if (!a || !b) return '(sin definir en el entorno)'
    return a.toLowerCase() === b.toLowerCase() ? 'ok' : '<-- NO COINCIDE'
  }
  console.log('Entorno:')
  console.log(`  NEXT_PUBLIC_NETWORK        ${process.env.NEXT_PUBLIC_NETWORK ?? '(sin definir)'} → red ${network}`)
  console.log(`  PGDATABASE                 ${process.env.PGDATABASE ?? '(sin definir)'}`)
  console.log(`  NEXT_PUBLIC_RPC_URL        ${safeOrigin(rpc)}`)
  console.log(`  explorador                 ${noHashes ? '(omitido por --no-hashes)' : blockscout}`)
  console.log(`  USDT   mpdj  USDT_ADDRESSES[red]   ${usdtAddress ?? '(sin definir)'}`)
  console.log(`  USDT   vault.usdtToken()           ${vaultUsdt}   ${mismatch(usdtAddress, String(vaultUsdt))}`)
  console.log(`  SLEARN mpdj  SLEARN_ADDRESSES[red] ${slearnAddress ?? '(sin definir)'}`)
  console.log(`  SLEARN vault.slearnToken()         ${vaultSlearn}   ${mismatch(slearnAddress, String(vaultSlearn))}`)
  console.log('  (las direcciones que se usan para el explorador son las del vault)')
  console.log('')

  console.log(`Vault V5 ${vault} | red ${network} | explorador ${noHashes ? '(omitido)' : blockscout}`)
  console.log(`Candidatos (curso, guía, billetera) con guía completada: ${candidates.length}`)
  console.log(fix ? 'Modo: --fix (escribe lo que falte)\n' : 'Modo: informe (no escribe); usa --fix para escribir\n')

  // Índice de hashes por billetera: se construye una vez por billetera que lo necesite.
  const hashIndexes = new Map<string, Map<string, HashByToken>>()
  async function hashesFor(wallet: string): Promise<Map<string, HashByToken>> {
    const key = wallet.toLowerCase()
    if (!hashIndexes.has(key)) {
      try {
        hashIndexes.set(key, await walletHashIndex(blockscout, wallet, tokenAddresses))
      } catch (e: unknown) {
        console.error(`  [WARN] no se pudo consultar el explorador para ${wallet}: ${e instanceof Error ? e.message : String(e)}`)
        hashIndexes.set(key, new Map())
      }
    }
    return hashIndexes.get(key)!
  }

  let checked = 0
  let paidOnChain = 0
  let missing = 0
  let inserted = 0
  let withoutHash = 0
  let dbOnly = 0
  let errors = 0
  let processed = 0
  let lastProgress = 0

  for (const batch of chunk(candidates, concurrency)) {
    await Promise.all(
      batch.map(async (c) => {
        try {
          const status = (await publicClient.readContract({
            address: vault,
            abi: STATUS_ABI,
            functionName: 'getStudentGuideStatus',
            args: [BigInt(c.course_id), BigInt(c.guide_id), c.billetera as Address],
          })) as readonly [bigint, bigint, boolean]
          checked++
          const onChain = { usdt: status[0], slearn: status[1] }
          const recorded = await recordedScholarshipTokens(db, c.usuario_id, c.guide_id)

          // Sentido inverso (sólo informe, nunca borra): la base dice pagado y la cadena no.
          const dbOnlyTokens = (['usdt', 'slearn'] as ScholarshipToken[]).filter(
            (token) => recorded[token] && onChain[token] === 0n,
          )
          if (dbOnlyTokens.length > 0) {
            dbOnly++
            console.log(`  [WARN] user=${c.usuario_id} curso=${c.course_id} guía=${c.guide_id} ${c.billetera}: la base tiene fila de ${dbOnlyTokens.join(', ')} y la cadena no lo registra`)
          }

          if (onChain.usdt === 0n && onChain.slearn === 0n) return
          paidOnChain++

          const tokens = missingScholarshipTokens(onChain, recorded)
          if (tokens.length === 0) return
          missing++

          const index = noHashes ? new Map<string, HashByToken>() : await hashesFor(c.billetera)
          const entry = index.get(`${c.course_id}:${c.guide_id}:${c.billetera.toLowerCase()}`) ?? {}
          const missingHash = tokens.filter((token) => !entry[token])
          if (missingHash.length > 0) withoutHash++

          const label = `user=${c.usuario_id} curso=${c.course_id} guía=${c.guide_id} ${c.billetera}: falta ${tokens.join(', ')}`
          if (!fix) {
            console.log(`  [TODO] ${label}${missingHash.length ? ` (sin hash: ${missingHash.join(', ')})` : ''}`)
            return
          }
          const rows = await recordMissingScholarshipRows(db, {
            usuarioId: c.usuario_id,
            wallet: c.billetera,
            courseId: c.course_id,
            guideId: c.guide_id,
            onChain,
            recorded,
            hashes: entry,
            usdtDecimals,
          })
          inserted += rows.length
          const detail = rows
            .map((r) => `${r.crypto}=${r.amount}${entry[r.crypto] ? ` @${entry[r.crypto]!.slice(0, 10)}…` : ' (sin hash)'}`)
            .join(', ')
          console.log(`  [FIX ] ${label} → ${detail}`)
        } catch (e: unknown) {
          errors++
          console.error(`  [WARN] user=${c.usuario_id} curso=${c.course_id} guía=${c.guide_id}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }),
    )
    processed += batch.length
    if (processed - lastProgress >= 100 || processed === candidates.length) {
      console.log(`  … ${processed}/${candidates.length}`)
      lastProgress = processed
    }
  }

  await db.destroy()
  console.log(
    `\nRevisados ${checked} | con pago en la cadena ${paidOnChain} | con fila faltante ${missing} | sin hash encontrado ${withoutHash} | base sin respaldo en la cadena ${dbOnly} | insertadas ${inserted} | errores ${errors}`,
  )
  if (!fix && missing > 0) console.log('Vuelve a correr con --fix para escribir las filas faltantes.')
  process.exit(errors > 0 && inserted === 0 ? 1 : 0)
}

await main()
