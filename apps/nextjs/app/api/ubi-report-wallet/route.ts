
import { NextResponse } from 'next/server'
import { newKyselyPostgresql } from '@/.config/kysely.config'
import { z } from 'zod'

const schema = z.object({
  wallet: z.string().startsWith('0x').length(42),
})

export async function GET(request: Request) {
  const db = newKyselyPostgresql()
  const { searchParams } = new URL(request.url)
  const wallet = searchParams.get('wallet')

  const validation = schema.safeParse({ wallet })

  if (!validation.success) {
    return new NextResponse('Invalid wallet address', { status: 400 })
  }

  try {
    const transactions = await db
      .selectFrom('ubitransactions')
      .select([
        'hash as tx',
        'amount as amountCelo',
        'date as date_of_transaction',
      ])
      .where('wallet', '=', validation.data.wallet)
      .orderBy('date', 'desc')
      .execute()

    return NextResponse.json(transactions)
  } catch (error) {
    console.error(`Error fetching UBI transactions for wallet ${wallet}:`, error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
