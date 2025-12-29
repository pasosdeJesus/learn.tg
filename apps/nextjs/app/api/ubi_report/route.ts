
import { NextResponse } from 'next/server'
import { newKyselyPostgresql } from '@/.config/kysely.config'
import { sql } from 'kysely'

export async function GET() {
  const db = newKyselyPostgresql()
  try {
    const report = await db
      .selectFrom('ubitransactions')
      .select([
        'wallet as wallet_address',
        sql<string>`sum(amount)`.as('total_ubi_given'),
      ])
      .groupBy('wallet')
      .having(sql`sum(amount)`, '>', 0)
      .execute()

    return NextResponse.json(report)
  } catch (error) {
    console.error('Error fetching UBI report:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
