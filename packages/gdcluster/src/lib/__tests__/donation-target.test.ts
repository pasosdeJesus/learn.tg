import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getDistributionBreakdown,
  getTargetCopy,
  getTargetRecipient,
  getTargetEndpoint,
  getDistributionFromResponse,
  getCampaignConfig,
  getCampaignDonationToken,
  campaignDonorSplit,
  splitRawAmount,
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

describe('campaignDonorSplit (REQ/223 §3.3)', () => {
  it('defaults to 100% campaign with cashback ON', () => {
    const split = campaignDonorSplit(100, {}, 22)
    expect(split.campaignUSD).toBe(100)
    expect(split.pdjUSD).toBe(0)
    expect(split.pdjSharePct).toBe(0)
    expect(split.receiveCashback).toBe(true)
    expect(split.cashbackSlearn).toBe(220) // 100 × 10% × 22
  })

  it('moves the chosen percentage to pdJ', () => {
    const split = campaignDonorSplit(100, { pdjSharePct: 10 }, 22)
    expect(split.campaignUSD).toBe(90)
    expect(split.pdjUSD).toBe(10)
    expect(split.cashbackSlearn).toBe(220)
  })

  it('does not mint cashback when the donor opts out', () => {
    const split = campaignDonorSplit(100, { receiveCashback: false }, 22)
    expect(split.receiveCashback).toBe(false)
    expect(split.cashbackSlearn).toBe(0)
    expect(split.campaignUSD).toBe(100)
  })

  it('clamps pdjSharePct to 0–100', () => {
    expect(campaignDonorSplit(100, { pdjSharePct: 150 }).pdjSharePct).toBe(100)
    expect(campaignDonorSplit(100, { pdjSharePct: -5 }).pdjSharePct).toBe(0)
  })
})

describe('splitRawAmount', () => {
  it('splits raw token amounts without dust', () => {
    const { campaignRaw, pdjRaw } = splitRawAmount(1_000_000n, 10)
    expect(campaignRaw).toBe(900_000n)
    expect(pdjRaw).toBe(100_000n)
  })

  it('keeps everything in the campaign at 0%', () => {
    const { campaignRaw, pdjRaw } = splitRawAmount(123_456_789n, 0)
    expect(campaignRaw).toBe(123_456_789n)
    expect(pdjRaw).toBe(0n)
  })
})

describe('campaign donations (REQ/223)', () => {
  const campaign: PaymentTarget = { type: 'campaign-donation', slug: 'lensenia' }

  it('resolves the campaign config from the registry', () => {
    const cfg = getCampaignConfig('lensenia')
    expect(cfg).toBeDefined()
    expect(cfg!.wallet).toBe('0x9c7218a253d1565fc5f2149ba51f0f55f0f27f07')
    expect(cfg!.goalUSD).toBe(8500)
    expect(cfg!.chains.map((c) => c.chain)).toEqual(['celo', 'avax', 'base'])
  })

  it('prefers NEXT_PUBLIC_USDT_ADDRESS for the donation token (dev server may differ from the registry example)', () => {
    const cfg = getCampaignConfig('lensenia')!
    const prevAddr = process.env.NEXT_PUBLIC_USDT_ADDRESS
    const prevDec = process.env.NEXT_PUBLIC_USDT_DECIMALS
    try {
      process.env.NEXT_PUBLIC_USDT_ADDRESS = '0x0d130F97fB5349656F95ad3Ab46BC0b34a8556a6'
      delete process.env.NEXT_PUBLIC_USDT_DECIMALS
      const mainnet = getCampaignDonationToken(cfg, 'usdt', true)!
      const testnet = getCampaignDonationToken(cfg, 'usdt', false)!
      expect(mainnet.address).toBe('0x0d130F97fB5349656F95ad3Ab46BC0b34a8556a6')
      expect(testnet.address).toBe('0x0d130F97fB5349656F95ad3Ab46BC0b34a8556a6')
      expect(testnet.decimals).toBe(6)
    } finally {
      if (prevAddr === undefined) delete process.env.NEXT_PUBLIC_USDT_ADDRESS
      else process.env.NEXT_PUBLIC_USDT_ADDRESS = prevAddr
      if (prevDec === undefined) delete process.env.NEXT_PUBLIC_USDT_DECIMALS
      else process.env.NEXT_PUBLIC_USDT_DECIMALS = prevDec
    }
  })

  it('routes campaign donations to the campaign verify endpoint', () => {
    expect(getTargetEndpoint(campaign)).toBe('/api/donations/lensenia/verify')
  })

  it('describes the default split in English and Spanish', () => {
    const en = getTargetCopy('en', campaign)
    expect(en.title).toContain('Lensenia Water Well')
    expect(en.splitInfo).toContain('100% goes to the Lensenia Water Well campaign')
    const es = getTargetCopy('es', campaign)
    expect(es.splitInfo).toContain('100% va a la campaña Pozo de Agua Lensenia')
  })

  it('describes the split with a pdJ share chosen by the donor', () => {
    const en = getTargetCopy('en', campaign, { pdjSharePct: 10 })
    expect(en.splitInfo).toContain('90% goes to the Lensenia Water Well campaign')
    expect(en.splitInfo).toContain('The remaining 10% goes to pdJ')
  })

  it('turns off the reward estimate when cashback is declined', () => {
    expect(getTargetCopy('en', campaign).rewardPct).toBe(10)
    expect(getTargetCopy('en', campaign, { receiveCashback: false }).rewardPct).toBe(0)
  })

  it('builds a 100/0 campaign breakdown that sums to 100', () => {
    const rows = getDistributionBreakdown('en', campaign, 10, 0)
    expect(rows.find((r) => r.label.includes('Campaign'))?.pct).toBe(100)
    expect(rows.reduce((acc, r) => acc + r.pct, 0)).toBe(100)
  })

  it('builds a split breakdown with a pdJ share', () => {
    const rows = getDistributionBreakdown('en', campaign, 100, 0, { pdjSharePct: 10, receiveCashback: false })
    const pct = (d: string) => rows.find((r) => r.label.includes(d))?.pct
    expect(pct('Campaign')).toBe(90)
    expect(pct('pdJ')).toBe(10)
    expect(rows.reduce((acc, r) => acc + r.pct, 0)).toBe(100)
  })
})

describe('CELO nativo como token de donación (REQ/223)', () => {
  it('is enabled in mainnet and testnet donationTokens with native config', () => {
    const cfg = getCampaignConfig('lensenia')!
    expect(cfg.donationTokens).toContain('celo')
    expect(cfg.testnet?.donationTokens).toContain('celo')
    const mainnet = getCampaignDonationToken(cfg, 'celo', true)!
    const testnet = getCampaignDonationToken(cfg, 'celo', false)!
    expect(mainnet.native).toBe(true)
    expect(mainnet.decimals).toBe(18)
    expect(mainnet.coingeckoId).toBe('celo')
    expect(testnet.native).toBe(true)
    expect(testnet.decimals).toBe(18)
  })
})
