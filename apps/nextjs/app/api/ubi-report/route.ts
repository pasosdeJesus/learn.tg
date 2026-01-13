
import { NextResponse } from 'next/server'
import { newKyselyPostgresql } from '@/.config/kysely.config'
import { sql } from 'kysely'

const EXCLUDED_WALLETS = [
  '0x204d050d301716d45eaa6807855cbf679c4f1dcf',
  '0x2cdc442Ec321ad8e5c136a461ad0c81b3e4f57f4',
  '0x2e2c4ac19c93d0984840cdd8e7f77500e2ef978e',
  '0x66ff77975e413c7ed2e1396657688fa64992f9f1',
  '0x939aa9effad34e11bb8fa3025f1b500e87970cae',
].map((w) => w.toLowerCase())

export async function GET() {
  const db = newKyselyPostgresql()
  try {
    const report = await db
      .selectFrom('ubitransactions')
      .select([
        'wallet as wallet_address',
        sql<string>`sum(amount)`.as('total_ubi_given'),
      ])
      .where(sql`lower(wallet)`, 'not in', EXCLUDED_WALLETS)
      .groupBy('wallet')
      .having(sql`sum(amount)`, '>', 0)
      .execute()

    return NextResponse.json(report)
  } catch (error) {
    console.error('Error fetching UBI report:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
