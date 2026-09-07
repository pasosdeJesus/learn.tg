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
  it('defaults to cashback ON: campaign 90% + 10% SLEARN cashback (from the donation)', () => {
    const split = campaignDonorSplit(100, {}, 22)
    expect(split.campaignUSD).toBe(90)
    expect(split.pdjUSD).toBe(0)
    expect(split.pdjSharePct).toBe(0)
    expect(split.receiveCashback).toBe(true)
    expect(split.cashbackSlearn).toBe(220) // 100 × 10% × 22
  })

  it('keeps the cashback inside the donation: campaign + pdJ + cashback = donated value', () => {
    // Caso reportado: US$10 con 5% a pdJ y cashback ON → campaña 8.50, pdJ 0.50,
    // cashback 22 SLEARN (≈ US$1) — el total no excede lo donado.
    const split = campaignDonorSplit(10, { pdjSharePct: 5 }, 22)
    expect(split.campaignUSD).toBe(8.5)
    expect(split.pdjUSD).toBe(0.5)
    expect(split.cashbackSlearn).toBe(22)
    expect(split.campaignUSD + split.pdjUSD).toBe(9)
  })

  it('moves the chosen percentage to pdJ (campaña 80% con pdJ 10% + cashback 10%)', () => {
    const split = campaignDonorSplit(100, { pdjSharePct: 10 }, 22)
    expect(split.campaignUSD).toBe(80)
    expect(split.pdjUSD).toBe(10)
    expect(split.cashbackSlearn).toBe(220)
  })

  it('does not mint cashback when the donor opts out (campaña recibe 100% con pdJ 0)', () => {
    const split = campaignDonorSplit(100, { receiveCashback: false }, 22)
    expect(split.receiveCashback).toBe(false)
    expect(split.cashbackSlearn).toBe(0)
    expect(split.campaignUSD).toBe(100)
  })

  it('clamps pdjSharePct to 0–10 (CAMPAIGN_PDJ_MAX_PCT)', () => {
    expect(campaignDonorSplit(100, { pdjSharePct: 150 }).pdjSharePct).toBe(10)
    expect(campaignDonorSplit(100, { pdjSharePct: 20 }).pdjSharePct).toBe(10)
    expect(campaignDonorSplit(100, { pdjSharePct: -5 }).pdjSharePct).toBe(0)
  })
})

describe('splitRawAmount', () => {
  it('splits raw token amounts without dust (cashback OFF)', () => {
    const { campaignRaw, pdjRaw, reserveRaw } = splitRawAmount(1_000_000n, 10, false)
    expect(campaignRaw).toBe(900_000n)
    expect(pdjRaw).toBe(100_000n)
    expect(reserveRaw).toBe(0n)
  })

  it('keeps everything in the campaign at 0%', () => {
    const { campaignRaw, pdjRaw, reserveRaw } = splitRawAmount(123_456_789n, 0, false)
    expect(campaignRaw).toBe(123_456_789n)
    expect(pdjRaw).toBe(0n)
    expect(reserveRaw).toBe(0n)
  })

  it('reserves 10% for the SLEARN cashback when ON: campaign + pdJ + reserve = amount', () => {
    const amount = 10_000_000n // 10 USDT
    const { campaignRaw, pdjRaw, reserveRaw } = splitRawAmount(amount, 5, true)
    expect(reserveRaw).toBe(1_000_000n) // 1 USDT
    expect(pdjRaw).toBe(500_000n) // 0.5 USDT
    expect(campaignRaw).toBe(8_500_000n) // 8.5 USDT
    expect(campaignRaw + pdjRaw + reserveRaw).toBe(amount)
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

  it('describes the default split in English and Spanish (cashback sale de la donación)', () => {
    const en = getTargetCopy('en', campaign)
    expect(en.title).toContain('Lensenia Water Well')
    expect(en.splitInfo).toContain('90% goes to the Lensenia Water Well campaign and 10% comes back to you as SLEARN cashback (from your donation)')
    const es = getTargetCopy('es', campaign)
    expect(es.splitInfo).toContain('90% va a la campaña Pozo de Agua Lensenia y 10% vuelve a ti como cashback en SLEARN (de tu donación)')
  })

  it('describes the split with a pdJ share chosen by the donor', () => {
    const en = getTargetCopy('en', campaign, { pdjSharePct: 10 })
    expect(en.splitInfo).toContain('80% goes to the Lensenia Water Well campaign, 10% to pdJ (your choice)')
    expect(en.splitInfo).toContain('10% comes back to you as SLEARN cashback')
    const enOff = getTargetCopy('en', campaign, { pdjSharePct: 10, receiveCashback: false })
    expect(enOff.splitInfo).toContain('90% goes to the Lensenia Water Well campaign, 10% to pdJ (your choice)')
  })

  it('turns off the reward estimate when cashback is declined', () => {
    expect(getTargetCopy('en', campaign).rewardPct).toBe(10)
    expect(getTargetCopy('en', campaign, { receiveCashback: false }).rewardPct).toBe(0)
  })

  it('builds a campaign breakdown with the cashback inside the 100% (90/10 default)', () => {
    const rows = getDistributionBreakdown('en', campaign, 10, 0)
    expect(rows.find((r) => r.label.includes('Campaign'))?.pct).toBe(90)
    expect(rows.find((r) => r.label.includes('SLEARN cashback'))?.pct).toBe(10)
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
