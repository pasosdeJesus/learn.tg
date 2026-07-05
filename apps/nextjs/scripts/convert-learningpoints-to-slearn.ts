/**
 * One-time script: convert all existing Learning Points to SLEARN at 1:1 ratio.
 *
 * Run: npx tsx scripts/convert-learningpoints-to-slearn.ts
 *
 * Idempotent — checks userevent to skip already-converted users.
 */
import dotenv from 'dotenv'
dotenv.config({ path: '../.env' })
import { newKyselyPostgresql } from '../.config/kysely.config'
import type { Address } from 'viem'
import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo, celoSepolia } from 'viem/chains'
import SLEARNAbi from '../abis/SLEARN.json' with { type: 'json' }
import { getSlearnAddress } from '../lib/deployments'

const CONVERSION_EVENT_TYPE = 'learningpoints_to_slearn'

async function main() {
  const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://forno.celo-sepolia.celo-testnet.org'
  const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}` | undefined
  if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY not set in apps/.env')
  const SLEARN_ADDRESS = await getSlearnAddress()
  if (!SLEARN_ADDRESS) throw new Error('SLEARN deployment not found. Run bin/deploySLEARN first.')
  const NETWORK = process.env.NEXT_PUBLIC_NETWORK || 'celoSepolia'

  const chain = NETWORK === 'celo' ? celo : celoSepolia

  const publicClient = createPublicClient({
    chain,
    transport: http(RPC_URL),
  })

  const account = privateKeyToAccount(PRIVATE_KEY)
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(RPC_URL),
  })

  const slearnContract = getContract({
    address: SLEARN_ADDRESS as Address,
    abi: SLEARNAbi as any,
    client: { public: publicClient, wallet: walletClient },
  })

  const db = newKyselyPostgresql()

  // Query users with learningscore > 0 and a connected wallet
  const users = await db
    .selectFrom('usuario')
    .innerJoin('billetera_usuario', 'billetera_usuario.usuario_id', 'usuario.id')
    .where('usuario.learningscore_deprecated', '>', 0)
    .select([
      'usuario.id as user_id',
      'usuario.learningscore_deprecated',
      'billetera_usuario.billetera',
    ])
    .execute()

  console.log(`Found ${users.length} users with learningscore > 0 and connected wallet`)

  let converted = 0
  let skipped = 0
  let errors = 0

  for (const u of users) {
    const learningscore = Number(u.learningscore_deprecated) || 0
    if (learningscore <= 0) continue

    console.log(`\nUser ${u.user_id}: ${u.billetera} — learningscore=${learningscore}`)

    // Check if already converted (use permanent transaction table, not userevent)
    const alreadyConverted = await db
      .selectFrom('transaction')
      .where('usuario_id', '=', u.user_id)
      .where('type', '=', 'conversion')
      .where('crypto', '=', 'slearn')
      .executeTakeFirst()

    if (alreadyConverted) {
      console.log('  Already converted, skipping')
      skipped++
      continue
    }

    // SLEARN has 2 decimals — convert learningscore to base units
    const lpBaseUnits = BigInt(Math.round(learningscore * 100))

    // Check on-chain balance to detect partial/manual conversions
    const onChainBalance: bigint =
      ((await slearnContract.read.balanceOf([u.billetera])) as bigint) || 0n
    console.log(`  On-chain SLEARN balance: ${onChainBalance}`)

    if (onChainBalance >= lpBaseUnits) {
      console.log('  On-chain balance >= learningscore, recording conversion (no mint needed)')
      await db
        .insertInto('transaction')
        .values({
          usuario_id: u.user_id,
  date: new Date(),
          type: 'conversion',
          crypto: 'slearn',
          amount: Number(onChainBalance) / 100,
          balance_impact: Number(onChainBalance) / 100,
          wallet: u.billetera,
          metadata: { learningscore, reason: 'already_had_sufficient_balance' },
        })
        .execute()
      skipped++
      continue
    }

    const toMint = lpBaseUnits - onChainBalance
    console.log(`  Minting ${toMint} SLEARN base units (=${Number(toMint)/100} SLEARN) to ${u.billetera}...`)

    try {
      const tx = await slearnContract.write.mint([u.billetera, toMint])
      console.log(`  tx: ${tx}`)
      // Wait for confirmation before next mint to avoid nonce issues
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx, timeout: 60_000 })
      console.log(`  confirmed in block ${receipt.blockNumber}`)

      // Record conversion in transaction table (permanent, used by leaderboard)
      await db
        .insertInto('transaction')
        .values({
          usuario_id: u.user_id,
  date: new Date(),
          type: 'conversion',
          crypto: 'slearn',
          amount: Number(toMint) / 100,
          balance_impact: Number(toMint) / 100,
          hash: tx,
          wallet: u.billetera,
          metadata: { learningscore },
        })
        .execute()

      converted++
      console.log(`  ✅ Converted`)
    } catch (e: any) {
      console.error(`  ❌ Error minting: ${e.message || e}`)
      errors++
    }
  }

  console.log(`\n=== RESULT ===`)
  console.log(`Total users: ${users.length}`)
  console.log(`Converted: ${converted}`)
  console.log(`Skipped: ${skipped}`)
  console.log(`Errors: ${errors}`)

  await db.destroy()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
