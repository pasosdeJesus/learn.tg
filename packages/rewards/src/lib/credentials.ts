// lib/credentials.ts
// Centralized SBT minting wrapper for learn.tg — delegates on-chain mint to
// @pasosdejesus/m/blockchain (with Celo L2 nonce retry logic).
// Adds credential_emission tracking, cache backfill, and receipt confirmation.

import {
  createPublicClient,
  createWalletClient,
  http,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo, celoSepolia } from 'viem/chains'
import { sql, type Kysely } from 'kysely'
import {
  getTokenIdByCourseId,
  hasCredentialOnChain,
  mintCourseWithRetry,
  revokeCredential,
} from '@pasosdejesus/mpdj/blockchain'
import { getCeloCredentialsAddress } from '@pasosdejesus/m/blockchain/deployments'
import path from 'path'
import { IS_PRODUCTION } from './config'

const CREDENTIALS_DEPLOYMENTS_DIR = path.join(
  process.cwd(), '..', 'hardhat', 'deployments', 'PasosDeJesusCredentials'
)

function getChain() {
  return IS_PRODUCTION ? celo : celoSepolia
}

function getChainId(): string {
  return IS_PRODUCTION ? 'celo' : 'celoSepolia'
}

function getRpcUrl(): string {
  return (process.env.NEXT_PUBLIC_RPC_URL || '').replace(/"/g, '')
}

function getContractAddress(): `0x${string}` {
  const addr = getCeloCredentialsAddress(CREDENTIALS_DEPLOYMENTS_DIR)
  if (!addr) throw new Error('Credentials contract not configured')
  return addr
}

/**
 * Mints a course completion SBT with Celo L2 nonce retry.
 *
 * Flow:
 * 1. Off-chain cache check (credential_emission by usuario_id + course_id)
 * 2. Resolve tokenId from courseId on-chain
 * 3. On-chain duplicate check (hasCredentialOnChain)
 * 4. Cache backfill if already on-chain but missing from our DB
 * 5. Mint via mintCredentialWithRetry (5 attempts with pending nonce)
 * 6. Wait for transaction receipt (120s timeout)
 * 7. Record emission in credential_emission
 *
 * Returns { txHash, tokenId, isPremium } on success, null if already minted.
 */
export async function mintCourseCredential(
  db: Kysely<any>,
  usuarioId: number,
  courseId: number,
  walletAddress: string,
): Promise<{ txHash: string; tokenId: number; isPremium: boolean } | null> {
  const contractAddress = getContractAddress()
  const chainId = getChainId()

  // 1. Off-chain cache check
  const alreadyEmitted = await db
    .selectFrom('credential_emission')
    .select('id')
    .where('usuario_id', '=', usuarioId)
    .where('course_id', '=', courseId)
    .executeTakeFirst()
  if (alreadyEmitted) return null

  // 2. Resolve tokenId from courseId
  const publicClient = createPublicClient({
    chain: getChain(),
    transport: http(getRpcUrl()),
  }) as any
  const tokenId = await getTokenIdByCourseId(
    publicClient,
    contractAddress,
    courseId,
  )
  if (tokenId === 0) {
    console.warn(`mintCourseCredential: courseId ${courseId} not registered on contract`)
    return null
  }

  // 3. On-chain duplicate check
  const alreadyHas = await hasCredentialOnChain(
    publicClient,
    contractAddress,
    walletAddress as `0x${string}`,
    Number(tokenId),
  )
  if (alreadyHas) {
    // 4. Cache backfill: record emission for existing on-chain SBT
    const meta = await db
      .selectFrom('credential_metadata')
      .select('is_premium')
      .where('token_id', '=', Number(tokenId))
      .executeTakeFirst()
    const isPremium = meta?.is_premium ?? false
    await db.insertInto('credential_emission')
      .values({
        usuario_id: usuarioId,
        course_id: courseId,
        token_id: Number(tokenId),
        chain_id: chainId,
        is_premium: isPremium,
        emitted_at: new Date(),
      } as any)
      .onConflict((oc: any) => oc.columns(['usuario_id', 'course_id', 'chain_id']).doNothing())
      .execute()
    return null
  }

  // 5. Mint with retry
  const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`)
  const hash = await mintCourseWithRetry({
    account,
    rpcUrl: getRpcUrl(),
    chain: getChain(),
    contractAddress,
    userAddress: walletAddress as `0x${string}`,
    courseId,
  })

  // 6. Wait for confirmation
  await publicClient.waitForTransactionReceipt({
    hash: hash as `0x${string}`,
    timeout: 120_000,
  })

  // 7. Record emission
  const meta = await db
    .selectFrom('credential_metadata')
    .select('is_premium')
    .where('token_id', '=', Number(tokenId))
    .executeTakeFirst()
  const isPremium = meta?.is_premium ?? false
  await db.insertInto('credential_emission')
    .values({
      usuario_id: usuarioId,
      course_id: courseId,
      token_id: Number(tokenId),
      chain_id: chainId,
      is_premium: isPremium,
      hash: hash,
      emitted_at: new Date(),
    } as any)
    .execute()

  return { txHash: hash, tokenId: Number(tokenId), isPremium }
}

/**
 * Revoca (quema) una credencial ya emitida y lo anota en `credential_emission`
 * (https://github.com/pasosdeJesus/learn.tg/issues/259 §3.5).
 *
 * El contrato exige `MINTER_ROLE` — la misma billetera del backend que acuña,
 * `process.env.PRIVATE_KEY`. La marca local (`revoked_at` + `revoke_hash`) es la
 * que quita la credencial de todas las superficies públicas: la cadena no se
 * puede consultar sin un indexador, y las consultas leen PostgreSQL.
 *
 * `usuarioId` + `tokenId` identifican la fila del dueño: la ruta solo puede
 * revocar credenciales propias.
 */
export async function revokeCourseCredential(
  db: Kysely<any>,
  usuarioId: number,
  tokenId: number,
  walletAddress: string,
): Promise<{ txHash: string }> {
  const contractAddress = getContractAddress()
  const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`)
  const chain = getChain()
  const publicClient = createPublicClient({ chain, transport: http(getRpcUrl()) }) as any
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(getRpcUrl()),
  }) as any

  // Un SBT de curso siempre es amount = 1 (ver `_validateMint` del contrato).
  const txHash = await revokeCredential(
    walletClient,
    contractAddress,
    walletAddress as `0x${string}`,
    Number(tokenId),
    1,
  )
  await publicClient.waitForTransactionReceipt({
    hash: txHash as `0x${string}`,
    timeout: 120_000,
  })

  const updated = await db
    .updateTable('credential_emission')
    .set({ revoked_at: new Date(), revoke_hash: txHash } as any)
    .where('usuario_id', '=', usuarioId)
    .where('token_id', '=', Number(tokenId))
    .where('revoked_at', 'is', null)
    .executeTakeFirst()

  if (Number(updated?.numUpdatedRows ?? 0) === 0) {
    throw new Error('Credential emission row not found for this user')
  }

  return { txHash }
}

export interface CompletedCourse {
  courseId: number
  titulo: string | null
  contenido_cristiano: boolean
}

/**
 * Cursos que el estudiante completó al 100% (todas las guías publicadas con
 * `points = 1`) y que todavía no tienen credencial emitida.
 *
 * Es la base del opt-in tardío: al encender el interruptor de contenido cristiano
 * en `/[lang]/settings` se ofrecen las credenciales de los cursos cristianos ya
 * completados, que no se acuñaron por privacidad.
 */
export async function completedCoursesWithoutCredential(
  db: Kysely<any>,
  usuarioId: number,
): Promise<CompletedCourse[]> {
  const result = await sql`
    SELECT c.id AS course_id,
           c.titulo,
           c.contenido_cristiano,
           COUNT(a.id) AS total_guides,
           COUNT(gu.id) AS completed_guides
    FROM cor1440_gen_proyectofinanciero c
    JOIN cor1440_gen_actividadpf a
      ON a.proyectofinanciero_id = c.id
     AND a."sufijoRuta" IS NOT NULL
     AND a."sufijoRuta" <> ''
    LEFT JOIN guide_usuario gu
      ON gu.actividadpf_id = a.id
     AND gu.usuario_id = ${usuarioId}
     AND gu.points = 1
    WHERE NOT EXISTS (
      SELECT 1 FROM credential_emission e
      WHERE e.usuario_id = ${usuarioId} AND e.course_id = c.id
    )
    GROUP BY c.id, c.titulo, c.contenido_cristiano
    HAVING COUNT(a.id) > 0 AND COUNT(a.id) = COUNT(gu.id)
    ORDER BY c.id
  `.execute(db)

  return result.rows.map((r: any) => ({
    courseId: Number(r.course_id),
    titulo: r.titulo ?? null,
    contenido_cristiano: r.contenido_cristiano === true,
  }))
}
