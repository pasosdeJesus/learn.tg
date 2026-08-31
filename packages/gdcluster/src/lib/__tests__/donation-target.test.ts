import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getDistributionBreakdown,
  getTargetCopy,
  getTargetRecipient,
  getTargetEndpoint,
  getDistributionFromResponse,
  type PaymentTarget,
} from '../donation-target'

describe('getDistributionBreakdown', () => {
  it('splits a course donation 35/35/10/5/5/5/5 (USDT side)', () => {
    const target: PaymentTarget = { type: 'course-donation', courseId: 1 }
    const rows = getDistributionBreakdown('en', target, 10, 0)
    const label = (d: string) => rows.find((r) => r.label.includes(d))
    expect(label('Course vault (USDT)')?.value).toBe('3.50')
    expect(label('Course vault (SLEARN)')?.value).toBe('77.00') // 10 × 0.35 × 22
    expect(label('cashback')?.value).toBe('~22.00') // 10 × 0.10 × 22
    expect(label('pdJ')?.value).toBe('0.50')
    expect(label('Missional')?.value).toBe('0.50')
    expect(label('UBI')?.value).toBe('0.50')
    expect(label('Churches')?.value).toBe('0.50')
    // Percentages sum to 100
    expect(rows.reduce((acc, r) => acc + r.pct, 0)).toBe(100)
  })

  it('converts SLEARN into the USDT total at the 22 rate', () => {
    const target: PaymentTarget = { type: 'course-donation', courseId: 2 }
    const rows = getDistributionBreakdown('en', target, 10, 22) // +22 SLEARN = +1 USDT
    const label = (d: string) => rows.find((r) => r.label.includes(d))
    expect(label('cashback')?.value).toBe('~24.20') // 11 USDT × 0.10 × 22
    expect(label('pdJ')?.value).toBe('0.50') // still 5% of the USDT amount
  })

  it('splits a cluster donation 80/10/10 including the SLEARN conversion', () => {
    const target: PaymentTarget = { type: 'cluster-donation', clusterWallet: '0x1', clusterName: 'SL Cluster' }
    const rows = getDistributionBreakdown('en', target, 10, 0)
    const label = (d: string) => rows.find((r) => r.label.includes(d))
    expect(label('Cluster fund')?.pct).toBe(80)
    expect(label('pdJ')?.pct).toBe(10)
    expect(label('cashback')?.pct).toBe(10)
    expect(label('Cluster fund')?.value).toBe('8.00')
    expect(label('pdJ')?.value).toBe('1.00')
    expect(rows.reduce((acc, r) => acc + r.pct, 0)).toBe(100)
  })

  it('splits a country donation 80/10/10', () => {
    const target: PaymentTarget = { type: 'country-donation', countryCode: 'SL', countryName: 'Sierra Leone' }
    const rows = getDistributionBreakdown('es', target, 10, 0)
    const label = (d: string) => rows.find((r) => r.label.includes(d))
    expect(label('Fondo del país')?.pct).toBe(80)
    expect(label('Operaciones')?.pct).toBe(10)
    expect(rows.reduce((acc, r) => acc + r.pct, 0)).toBe(100)
  })
})

describe('getTargetCopy', () => {
  it('describes the course split in English (70% vault, 10% reward)', () => {
    const copy = getTargetCopy('en', { type: 'course-donation', courseId: 5 })
    expect(copy.title).toBe('Donate to course #5')
    expect(copy.splitInfo).toContain('70% to course vault')
    expect(copy.rewardPct).toBe(10)
  })

  it('describes the course split in Spanish', () => {
    const copy = getTargetCopy('es', { type: 'course-donation', courseId: 5 })
    expect(copy.splitInfo).toContain('70% a bóveda del curso')
  })

  it('describes cluster and country splits', () => {
    const cluster = getTargetCopy('en', { type: 'cluster-donation', clusterWallet: '0x1', clusterName: 'SL' })
    expect(cluster.splitInfo).toContain('80% goes to the cluster fund')
    const country = getTargetCopy('en', { type: 'country-donation', countryCode: 'SL', countryName: 'Sierra Leone' })
    expect(country.splitInfo).toContain('80% goes to the country fund')
  })
})

describe('getTargetRecipient', () => {
  const original = process.env.NEXT_PUBLIC_ADDRESS

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_ADDRESS
    else process.env.NEXT_PUBLIC_ADDRESS = original
  })

  it('returns the backend wallet from the environment', () => {
    process.env.NEXT_PUBLIC_ADDRESS = '0xRECIPIENT123456789012345678901234567890'
    expect(getTargetRecipient({ type: 'course-donation', courseId: 1 })).toBe('0xRECIPIENT123456789012345678901234567890')
  })

  it('returns undefined when not configured', () => {
    delete process.env.NEXT_PUBLIC_ADDRESS
    expect(getTargetRecipient({ type: 'course-donation', courseId: 1 })).toBeUndefined()
  })
})

describe('getTargetEndpoint', () => {
  it('routes course donations to /api/add-donation', () => {
    expect(getTargetEndpoint({ type: 'course-donation', courseId: 1 })).toBe('/api/add-donation')
  })

  it('routes cluster and country donations to the gdcluster verify endpoint', () => {
    expect(getTargetEndpoint({ type: 'cluster-donation', clusterWallet: '0x1', clusterName: 'SL' }))
      .toBe('/api/gdcluster/donations/verify')
    expect(getTargetEndpoint({ type: 'country-donation', countryCode: 'SL', countryName: 'SL' }))
      .toBe('/api/gdcluster/donations/verify')
  })
})

describe('getDistributionFromResponse', () => {
  beforeEach(() => { vi.unstubAllEnvs() })

  it('passes through a distribution from the backend response', () => {
    const distribution = [{ destination: 'course_vault', amount: 7, crypto: 'USDT' }]
    expect(getDistributionFromResponse({ distribution }, 'en')).toEqual(distribution)
  })

  it('returns an empty array when the response has no distribution', () => {
    expect(getDistributionFromResponse({}, 'en')).toEqual([])
  })
})
