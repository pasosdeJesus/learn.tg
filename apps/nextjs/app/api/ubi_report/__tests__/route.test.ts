
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { GET } from '../route'
import { newKyselyPostgresql } from '@/.config/kysely.config'
import { sql } from 'kysely'

describe('API /api/ubi_report', () => {
  const db = newKyselyPostgresql()

  beforeAll(async () => {
    await db.deleteFrom('ubitransactions').execute()
    await db.insertInto('ubitransactions').values([
      { wallet: '0x123', hash: '0xa', amount: '100', date: new Date() },
      { wallet: '0x123', hash: '0xb', amount: '50', date: new Date() },
      { wallet: '0x456', hash: '0xc', amount: '200', date: new Date() },
      { wallet: '0x789', hash: '0xd', amount: '100', date: new Date() },
      { wallet: '0x789', hash: '0xe', amount: '-100', date: new Date() },
    ]).execute()
  })

  afterAll(async () => {
    await db.deleteFrom('ubitransactions').execute()
    await db.destroy()
  })

  it('should return an aggregated report of UBI transactions', async () => {
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)

    const sortedData = data.sort((a, b) => a.wallet_address.localeCompare(b.wallet_address))

    expect(sortedData).toEqual([
      { wallet_address: '0x123', total_ubi_given: '150' },
      { wallet_address: '0x456', total_ubi_given: '200' },
    ])
  })

  it('should return an empty array if no transactions exist', async () => {
    await db.deleteFrom('ubitransactions').execute()

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual([])
  })
})
