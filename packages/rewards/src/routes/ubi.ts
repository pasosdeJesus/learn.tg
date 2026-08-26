import { NextResponse } from 'next/server'
import { sql } from 'kysely'
import type { RewardsDeps } from '../index'

const EXCLUDED_WALLETS = [
  '0x204d050d301716d45eaa6807855cbf679c4f1dcf',
  '0x2cdc442Ec321ad8e5c136a461ad0c81b3e4f57f4',
  '0x2e2c4ac19c93d0984840cdd8e7f77500e2ef978e',
  '0x66ff77975e413c7ed2e1396657688fa64992f9f1',
  '0x939aa9effad34e11bb8fa3025f1b500e87970cae',
].map((w) => w.toLowerCase())

/** GET /api/ubi-report — total UBI por wallet (excluye wallets internas). */
export async function ubiReport(deps: RewardsDeps): Promise<Response> {
  const db = deps.db()
  try {
    const report = await db
      .selectFrom('transaction')
      .select([
        'wallet as wallet_address',
        sql<string>`sum(cantidad)`.as('total_ubi_given'),
      ])
      .where('type', '=', 'ubi-claim')
      .where('crypto', '=', 'celo')
      .where(sql`lower(wallet)`, 'not in', EXCLUDED_WALLETS)
      .groupBy('wallet')
      .having(sql`sum(cantidad)`, '>', 0)
      .execute()

    const total = report
      .reduce((sum, row) => sum + (+row.total_ubi_given), 0)
      .toString()

    return NextResponse.json({ report, total })
  } catch (error) {
    console.error('Error fetching UBI report:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

/** GET /api/ubi-report-wallet?wallet=… — transacciones UBI de una wallet. */
export async function ubiReportWallet(deps: RewardsDeps, request: Request): Promise<Response> {
  const db = deps.db()
  const { searchParams } = new URL(request.url)
  const wallet = searchParams.get('wallet')

  if (!wallet || !wallet.startsWith('0x') || wallet.length !== 42) {
    return new NextResponse('Invalid wallet address', { status: 400 })
  }

  try {
    const transactions = await db
      .selectFrom('transaction')
      .select([
        'hash as tx',
        'amount as amountCelo',
        'date as date_of_transaction',
      ])
      .where('wallet', '=', wallet)
      .where('type', '=', 'ubi-claim')
      .where('crypto', '=', 'celo')
      .orderBy('date', 'desc')
      .execute()

    return NextResponse.json(transactions)
  } catch (error) {
    console.error(`Error fetching UBI transactions for wallet ${wallet}:`, error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
