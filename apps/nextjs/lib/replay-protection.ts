import type { Kysely } from 'kysely'
import { NextResponse } from 'next/server'

export async function checkReplayAttack(
  db: Kysely<any>,
  hashes: (string | undefined)[],
): Promise<NextResponse | null> {
  const validHashes = hashes.filter(Boolean) as string[]
  for (const h of validHashes) {
    const existingTx = await db
      .selectFrom('transaction')
      .where('hash', '=', h)
      .select('id')
      .executeTakeFirst()
    if (existingTx) {
      return NextResponse.json({ error: 'Transaction already processed' }, { status: 400 })
    }
  }
  return null
}

export async function getBlockWithRetry(publicClient: any, blockNumber: bigint, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      return await publicClient.getBlock({ blockNumber })
    } catch (e) {
      if (i === retries - 1) throw e
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
}