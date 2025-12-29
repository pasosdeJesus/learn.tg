
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { GET } from '../route'
import { newKyselyPostgresql } from '@/.config/kysely.config'

describe('API /api/ubi_report_wallet', () => {
  const db = newKyselyPostgresql()

  beforeAll(async () => {
    await db.deleteFrom('ubitransactions').execute()
    const date1 = new Date()
    const date2 = new Date(date1.getTime() + 1000)
    await db.insertInto('ubitransactions').values([
      { wallet: '0xAbC123AbC123AbC123AbC123AbC123AbC123AbC1', hash: '0xa', amount: '100', date: date1 },
      { wallet: '0xAbC123AbC123AbC123AbC123AbC123AbC123AbC1', hash: '0xb', amount: '50', date: date2 },
      { wallet: '0xDeF456DeF456DeF456DeF456DeF456DeF456DeF2', hash: '0xc', amount: '200', date: date1 },
    ]).execute()
  })

  afterAll(async () => {
    await db.deleteFrom('ubitransactions').execute()
    await db.destroy()
  })

  it('should return transactions for a specific wallet, ordered by date desc', async () => {
    const url = new URL('http://localhost/api/ubi_report_wallet?wallet=0xAbC123AbC123AbC123AbC123AbC123AbC123AbC1')
    const request = new Request(url.toString())

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.length).toBe(2)
    expect(data[0].tx).toBe('0xb') // Most recent
    expect(data[1].tx).toBe('0xa')
    expect(data[0].amountCelo).toBe('50')
  })

  it('should return 400 for an invalid wallet address', async () => {
    const url = new URL('http://localhost/api/ubi_report_wallet?wallet=invalid-wallet')
    const request = new Request(url.toString())

    const response = await GET(request)
    const text = await response.text()

    expect(response.status).toBe(400)
    expect(text).toBe('Invalid wallet address')
  })

  it('should return an empty array for a wallet with no transactions', async () => {
    const url = new URL('http://localhost/api/ubi_report_wallet?wallet=0x1111111111111111111111111111111111111111')
    const request = new Request(url.toString())

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual([])
  })
})
