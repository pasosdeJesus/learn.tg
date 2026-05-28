// lib/credentials.ts
// Centralized SBT minting wrapper for learn.tg — delegates on-chain mint to
// @pasosdejesus/m/blockchain (with Celo L2 nonce retry logic).
// Adds credential_emission tracking, cache backfill, and receipt confirmation.

import {
  createPublicClient,
  http,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo, celoSepolia } from 'viem/chains'
import { newKyselyPostgresql } from '@/.config/kysely.config'
import {
  getTokenIdByCourseId,
  hasCredentialOnChain,
  getCeloCredentialsAddress,
  mintCourseWithRetry,
} from '@pasosdejesus/m/blockchain'
import path from 'path'
import { IS_PRODUCTION } from '@/lib/config'

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
  usuarioId: number,
  courseId: number,
  walletAddress: string,
): Promise<{ txHash: string; tokenId: number; isPremium: boolean } | null> {
  const db = newKyselyPostgresql()
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
