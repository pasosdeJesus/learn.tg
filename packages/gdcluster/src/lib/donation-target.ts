import type { Address } from 'viem'

// REQ #223: destinos de donación y reparto. Los destinos cluster/country usan
// ClusterFundsV2 (80/10/10); los destinos `campaign` (p. ej. Lensenia) NO usan
// contrato: el backend reenvía automáticamente la parte de la campaña a la
// billetera destino y la parte pdJ a la tesorería (ver §4.1 de REQ/223.md).

export interface CourseDonation { type: 'course-donation'; courseId: number }
export interface ClusterDonation { type: 'cluster-donation'; clusterWallet: string; clusterName: string }
export interface CountryDonation { type: 'country-donation'; countryCode: string; countryName: string }
export interface CampaignDonation { type: 'campaign-donation'; slug: string }

export type PaymentTarget = CourseDonation | ClusterDonation | CountryDonation | CampaignDonation

/** Opciones por donación (REQ/223 §3.3) — solo destinos `campaign` */
export interface CampaignDonorOptions {
  /** SLEARN cashback (10% del valor) on/off. Default true.
   * Sale DE LA MISMA donación (como en cluster/country 80/10/10): se retiene
   * el 10% en USDT como reserva y se entrega vía `SLEARN.mintAndReserve`
   * (REQ/223). La campaña recibe (100 − pdjSharePct − 10)% cuando está ON. */
  receiveCashback?: boolean
  /** % de la donación que va a pdJ (0–10, tope CAMPAIGN_PDJ_MAX_PCT). */
  pdjSharePct?: number
}

/** Cashback SLEARN de campañas: % del valor de la donación que vuelve al
 * donante (respaldado con USDT de la misma donación vía mintAndReserve). */
export const CAMPAIGN_CASHBACK_PCT = 10

/** Tope del % que puede ir a pdJ en una donación a campaña (el resto se queda
 * en la campaña; la campaña nunca recibe menos de 80% con cashback ON). */
export const CAMPAIGN_PDJ_MAX_PCT = 10

export interface CampaignToken {
  key: string
  symbol: string
  address: string
  decimals: number
  /** precio estable (USDT/USDC ≈ 1 USD); si no, coingeckoId para cotizar */
  peggedUsd?: boolean
  coingeckoId?: string
  /** no es ERC-20 (nativo, p. ej. CELO) */
  native?: boolean
}

export interface CampaignChain {
  chain: 'celo' | 'avax' | 'base'
  chainId: number
  rpcDefault: string
  /** token nativo de la cadena (p. ej. CELO) presentado en el balance */
  nativeToken?: CampaignToken
  /** lista de tokens ERC-20 a presentar en el balance de la billetera */
  tokens: CampaignToken[]
}

export interface CampaignConfig {
  slug: string
  name: { en: string; es: string }
  wallet: Address
  goalUSD: number
  pasosdejesusUrl: string
  /** criptos aceptados en recepción (Celo mainnet) — ver REQ/223 §2 */
  donationTokens: string[]
  /** red de prueba (Celo Sepolia): tokens y criptos aceptadas para testear */
  testnet?: {
    donationTokens: string[]
    tokens: CampaignToken[]
  }
  chains: CampaignChain[]
  guide3: { en: string; es: string }
}

const PDJ_TREASURY_ENV = 'NEXT_PUBLIC_PDJ_TREASURY_ADDRESS'

/**
 * Registro de campañas. Las direcciones están verificadas (REQ/223 §8):
 * Celo/AVAX/Base en Blockscout/avascan/RPC (2026-09).
 */
export const CAMPAIGN_CONFIGS: CampaignConfig[] = [
  {
    slug: 'lensenia',
    name: { en: 'Lensenia Water Well', es: 'Pozo de Agua Lensenia' },
    wallet: '0x9c7218a253d1565fc5f2149ba51f0f55f0f27f07',
    goalUSD: 8500,
    pasosdejesusUrl: 'https://pasosdejesus.org/lensenia',
    donationTokens: ['usdt', 'usdc', 'xaut0', 'gdoll', 'celo'],
    // Celo Sepolia (pruebas): USDT Mock (apps/.env) + CELO nativo para probar
    // el flujo nativo en el dev site (REQ/223 — USDC/XAUt0/G$ solo mainnet
    // hasta tener direcciones de test verificadas)
    testnet: {
      donationTokens: ['usdt', 'celo'],
      tokens: [
        { key: 'usdt', symbol: 'USDT', address: '0x7d7a73c8c0D00Fdf8b54b1a6dB6eBDEcdBa78aE8', decimals: 6, peggedUsd: true },
      ],
    },
    guide3: {
      en: 'web3-and-ubi/guide3',
      es: 'web3-e-ibu/guia3',
    },
    chains: [
      {
        chain: 'celo', chainId: 42220, rpcDefault: 'https://forno.celo.org',
        nativeToken: { key: 'celo', symbol: 'CELO', address: '', decimals: 18, native: true, coingeckoId: 'celo' },
        tokens: [
          { key: 'usdt', symbol: 'USDT', address: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e', decimals: 6, peggedUsd: true },
          { key: 'usdc', symbol: 'USDC', address: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C', decimals: 6, peggedUsd: true },
          { key: 'gdoll', symbol: 'G$', address: '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A', decimals: 18, coingeckoId: 'gooddollar' },
          { key: 'xaut0', symbol: 'XAUt0', address: '0xaf37E8B6C9ED7f6318979f56Fc287d76c30847ff', decimals: 6, coingeckoId: 'tether-gold' },
        ],
      },
      {
        chain: 'avax', chainId: 43114, rpcDefault: 'https://api.avax.network/ext/bc/C/rpc',
        tokens: [
          { key: 'usdt', symbol: 'USDt', address: '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7', decimals: 6, peggedUsd: true },
          { key: 'usdc', symbol: 'USDC', address: '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e', decimals: 6, peggedUsd: true },
          { key: 'xaut0', symbol: 'XAUt0', address: '0x2775d5105276781B4b85bA6eA6a6653bEeD1dd32', decimals: 6, coingeckoId: 'tether-gold' },
        ],
      },
      {
        chain: 'base', chainId: 8453, rpcDefault: 'https://mainnet.base.org',
        tokens: [
          // REQ/223: en Base solo USDC por ahora (no hay XAUt0 nativo; USDT bridged fuera)
          { key: 'usdc', symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, peggedUsd: true },
        ],
      },
    ],
  },
]

export function getCampaignConfig(slug: string): CampaignConfig | undefined {
  return CAMPAIGN_CONFIGS.find((c) => c.slug === slug)
}

/** Token de recepción de una campaña para la red activa (mainnet vs Celo Sepolia) */
export function getCampaignDonationToken(cfg: CampaignConfig, key: string, mainnet: boolean): CampaignToken | undefined {
  let base: CampaignToken | undefined
  if (key === 'celo') {
    // CELO nativo (la misma moneda en ambas redes): no es ERC-20, se reenvía
    // por valor (sendTransaction). Configuración sintética estable.
    base = { key: 'celo', symbol: 'CELO', address: '', decimals: 18, native: true, coingeckoId: 'celo' }
  } else if (mainnet) {
    const celo = cfg.chains.find((c) => c.chain === 'celo')
    base = celo?.tokens.find((t) => t.key === key)
  } else {
    base = cfg.testnet?.tokens.find((t) => t.key === key)
  }
  if (!base) return undefined
  // USDT: la dirección del servidor (NEXT_PUBLIC_USDT_ADDRESS, la misma que usa
  // el DonateModal y los receipts) tiene prioridad sobre el registro — así el
  // testnet de desarrollo (dev MockUSDT) coincide aunque difiera del ejemplo.
  if (key === 'usdt' && process.env.NEXT_PUBLIC_USDT_ADDRESS) {
    const dec = Number(process.env.NEXT_PUBLIC_USDT_DECIMALS)
    return {
      ...base,
      address: process.env.NEXT_PUBLIC_USDT_ADDRESS,
      decimals: Number.isFinite(dec) ? dec : base.decimals,
    }
  }
  return base
}

/** Criptos aceptadas en recepción para la red activa */
export function getCampaignDonationTokenKeys(cfg: CampaignConfig, mainnet: boolean): string[] {
  return mainnet ? cfg.donationTokens : (cfg.testnet?.donationTokens ?? [])
}

export function getCampaignDonationWallet(slug: string): Address | undefined {
  return getCampaignConfig(slug)?.wallet
}

export function getPdJTreasuryAddress(): string | undefined {
  return process.env[PDJ_TREASURY_ENV]
}

/**
 * Reparto de una donación a campaña (REQ/223 §3.3): el 100% de la donación se
 * divide entre la campaña, pdJ y el cashback SLEARN (que SALE de la misma
 * donación, como en los flujos cluster/country — no se suma por encima):
 *   - cashback ON: campaña (100 − pdjSharePct − 10)%, pdJ pdjSharePct%,
 *     cashback 10% (SLEARN respaldado en USDT, mintAndReserve).
 *   - cashback OFF: campaña (100 − pdjSharePct)%, pdJ pdjSharePct%.
 * pdjSharePct se limita a CAMPAIGN_PDJ_MAX_PCT (10).
 * Devuelve valores en USD (y cashback en unidades SLEARN a `slearnRate`).
 */
export function campaignDonorSplit(
  usdValue: number,
  options: CampaignDonorOptions = {},
  slearnRate = 22,
): { campaignUSD: number; pdjUSD: number; pdjSharePct: number; receiveCashback: boolean; cashbackSlearn: number } {
  const pdjSharePct = Math.min(CAMPAIGN_PDJ_MAX_PCT, Math.max(0, Math.round(options.pdjSharePct ?? 0)))
  const receiveCashback = options.receiveCashback !== false
  const round4 = (v: number) => Math.round(v * 10000) / 10000
  const pdjUSD = round4(usdValue * pdjSharePct / 100)
  const cashbackUSD = receiveCashback ? round4(usdValue * CAMPAIGN_CASHBACK_PCT / 100) : 0
  const campaignUSD = round4(usdValue - pdjUSD - cashbackUSD)
  const cashbackSlearn = receiveCashback
    ? Math.round(usdValue * (CAMPAIGN_CASHBACK_PCT / 100) * slearnRate * 100) / 100
    : 0
  return { campaignUSD, pdjUSD, pdjSharePct, receiveCashback, cashbackSlearn }
}

/** Reparto en unidades crudas del token (evita polvo de centavos): parte de la
 * campaña (neta del cashback), parte pdJ y, si hay cashback, la reserva del
 * 10% que respalda el SLEARN (mintAndReserve). campaign+pdJ+reserve = amount. */
export function splitRawAmount(
  amount: bigint,
  pdjSharePct: number,
  receiveCashback = false,
): { campaignRaw: bigint; pdjRaw: bigint; reserveRaw: bigint } {
  const pct = Math.min(CAMPAIGN_PDJ_MAX_PCT, Math.max(0, Math.round(pdjSharePct)))
  const pdjRaw = (amount * BigInt(pct)) / 100n
  const reserveRaw = receiveCashback ? (amount * BigInt(CAMPAIGN_CASHBACK_PCT)) / 100n : 0n
  const campaignRaw = amount - pdjRaw - reserveRaw
  return { campaignRaw, pdjRaw, reserveRaw }
}

export function getDistributionBreakdown(
  lang: string,
  target: PaymentTarget,
  usdtAmount: number,
  slearnAmount: number,
  options: CampaignDonorOptions = {},
) {
  const t = (en: string, es: string) => lang === 'es' ? es : en
  const totalUSDT = usdtAmount + (slearnAmount / 22)
  const fmt = (v: number) => v.toFixed(2)
  const base: { label: string; pct: number; value: string; type: 'usdt' | 'slearn' | 'both' }[] = []

  switch (target.type) {
    case 'course-donation':
      base.push(
        { label: t('Course vault (USDT)', 'Bóveda del curso (USDT)'), pct: 35, value: fmt(usdtAmount * 0.35), type: 'usdt' },
        { label: t('Course vault (SLEARN)', 'Bóveda del curso (SLEARN)'), pct: 35, value: fmt(usdtAmount * 0.35 * 22 + slearnAmount * 0.35), type: 'slearn' },
        { label: t('SLEARN cashback (you)', 'Cashback SLEARN (tú)'), pct: 10, value: '~' + fmt(totalUSDT * 0.10 * 22), type: 'slearn' },
        { label: t('pdJ operations', 'Operaciones pdJ'), pct: 5, value: fmt(usdtAmount * 0.05), type: 'usdt' },
        { label: t('Missional', 'Misional'), pct: 5, value: fmt(usdtAmount * 0.05), type: 'usdt' },
        { label: t('UBI + Referrals', 'IUB + Referidos'), pct: 5, value: fmt(usdtAmount * 0.05), type: 'usdt' },
        { label: t('Churches', 'Iglesias'), pct: 5, value: fmt(usdtAmount * 0.05), type: 'usdt' },
      )
      break
    case 'country-donation':
      base.push(
        { label: t('Country fund', 'Fondo del país'), pct: 80, value: fmt(totalUSDT * 0.8), type: 'both' },
        { label: t('pdJ operations', 'Operaciones pdJ'), pct: 10, value: fmt(totalUSDT * 0.1), type: 'both' },
        { label: t('SLEARN cashback (you)', 'Cashback SLEARN (tú)'), pct: 10, value: '~' + fmt(totalUSDT * 0.10 * 22), type: 'slearn' },
      )
      break
    case 'cluster-donation':
      base.push(
        { label: t('Cluster fund', 'Fondo del clúster'), pct: 80, value: fmt(totalUSDT * 0.8), type: 'both' },
        { label: t('pdJ operations', 'Operaciones pdJ'), pct: 10, value: fmt(totalUSDT * 0.1), type: 'both' },
        { label: t('SLEARN cashback (you)', 'Cashback SLEARN (tú)'), pct: 10, value: '~' + fmt(totalUSDT * 0.10 * 22), type: 'slearn' },
      )
      break
    case 'campaign-donation': {
      const cfg = getCampaignConfig(target.slug)
      const name = cfg ? (lang === 'es' ? cfg.name.es : cfg.name.en) : target.slug
      const split = campaignDonorSplit(totalUSDT, options)
      base.push(
        { label: t(`Campaign: ${name}`, `Campaña: ${name}`), pct: split.receiveCashback ? 100 - split.pdjSharePct - CAMPAIGN_CASHBACK_PCT : 100 - split.pdjSharePct, value: fmt(split.campaignUSD), type: 'both' },
      )
      if (split.pdjSharePct > 0) {
        base.push({ label: t('pdJ (your choice)', 'pdJ (tu elección)'), pct: split.pdjSharePct, value: fmt(split.pdjUSD), type: 'both' })
      }
      if (split.cashbackSlearn > 0) {
        base.push({ label: t('SLEARN cashback (you)', 'Cashback SLEARN (tú)'), pct: CAMPAIGN_CASHBACK_PCT, value: '~' + fmt(split.cashbackSlearn), type: 'slearn' })
      }
      break
    }
  }
  return base
}

export function getTargetCopy(lang: string, target: PaymentTarget, options: CampaignDonorOptions = {}) {
  const t = (en: string, es: string) => lang === 'es' ? es : en
  switch (target.type) {
    case 'course-donation':
      return {
        title: `${t('Donate to course', 'Donar al curso')} #${target.courseId}`,
        splitInfo: t(
          '70% to course vault (35% USDT + 35% SLEARN), 10% back as SLEARN reward, 5% pdJ, 5% missional, 5% UBI+referrals, 5% churches.',
          '70% a bóveda del curso (35% USDT + 35% SLEARN), 10% vuelve como SLEARN de recompensa, 5% pdJ, 5% misional, 5% IUB+referidos, 5% iglesias.'
        ),
        rewardPct: 10,
        rewardLabel: t('Estimated SLEARN reward', 'Recompensa SLEARN estimada'),
      }
    case 'cluster-donation':
      return {
        title: `${t('Donate to cluster', 'Donar al clúster')}: ${target.clusterName}`,
        splitInfo: t(
          '80% goes to the cluster fund, 10% to pdJ operations, 10% back as SLEARN cashback.',
          '80% va al fondo del clúster, 10% a operaciones de pdJ, 10% vuelve como cashback en SLEARN.'
        ),
        rewardPct: 10,
        rewardLabel: t('Estimated SLEARN cashback', 'Cashback SLEARN estimado'),
      }
    case 'country-donation':
      return {
        title: `${t('Donate to country', 'Donar al país')}: ${target.countryName}`,
        splitInfo: t(
          '80% goes to the country fund (distributed among clusters), 10% to pdJ operations, 10% back as SLEARN cashback.',
          '80% va al fondo del país (distribuido entre clústeres), 10% a operaciones de pdJ, 10% vuelve como cashback en SLEARN.'
        ),
        rewardPct: 10,
        rewardLabel: t('Estimated SLEARN cashback', 'Cashback SLEARN estimado'),
      }
    case 'campaign-donation': {
      const cfg = getCampaignConfig(target.slug)
      const name = cfg ? (lang === 'es' ? cfg.name.es : cfg.name.en) : target.slug
      const receiveCashback = options.receiveCashback !== false
      const pdjSharePct = Math.min(CAMPAIGN_PDJ_MAX_PCT, Math.max(0, Math.round(options.pdjSharePct ?? 0)))
      // El cashback sale de la misma donación (REQ/223 §3.3): la campaña recibe
      // (100 − pdj − 10)% cuando está ON, igual que en cluster/country (80/10/10).
      const campaignNet = receiveCashback ? 100 - pdjSharePct - CAMPAIGN_CASHBACK_PCT : 100 - pdjSharePct
      const enTxt = pdjSharePct > 0
        ? `${campaignNet}% goes to the ${name} campaign, ${pdjSharePct}% to pdJ (your choice), and ${CAMPAIGN_CASHBACK_PCT}% comes back to you as SLEARN cashback (from your donation).`
        : receiveCashback
          ? `${campaignNet}% goes to the ${name} campaign and ${CAMPAIGN_CASHBACK_PCT}% comes back to you as SLEARN cashback (from your donation).`
          : `${campaignNet}% goes to the ${name} campaign.`
      const esTxt = pdjSharePct > 0
        ? `${campaignNet}% va a la campaña ${name}, ${pdjSharePct}% a pdJ (tu elección) y ${CAMPAIGN_CASHBACK_PCT}% vuelve a ti como cashback en SLEARN (de tu donación).`
        : receiveCashback
          ? `${campaignNet}% va a la campaña ${name} y ${CAMPAIGN_CASHBACK_PCT}% vuelve a ti como cashback en SLEARN (de tu donación).`
          : `${campaignNet}% va a la campaña ${name}.`
      return {
        title: `${t('Donate to campaign', 'Donar a la campaña')}: ${name}`,
        splitInfo: t(enTxt, esTxt),
        rewardPct: receiveCashback ? 10 : 0,
        rewardLabel: t('Estimated SLEARN cashback', 'Cashback SLEARN estimado'),
      }
    }
  }
}

/**
 * On-chain recipient — always the backend wallet.
 * The backend interprets the donation endpoint and calls the appropriate
 * contract (LearnTGVaults for courses, ClusterFunds for clusters/countries,
 * direct forward for campaigns).
 */
export function getTargetRecipient(_target: PaymentTarget): Address | undefined {
  const addr = process.env.NEXT_PUBLIC_ADDRESS
  return addr ? (addr as Address) : undefined
}

/** Backend verification endpoint */
export function getTargetEndpoint(target: PaymentTarget): string {
  switch (target.type) {
    case 'course-donation': return '/api/add-donation'
    case 'cluster-donation': return '/api/gdcluster/donations/verify'
    case 'country-donation': return '/api/gdcluster/donations/verify'
    case 'campaign-donation': return `/api/donations/${target.slug}/verify`
  }
}

/** Distribution breakdown from backend response (actual on-chain events) */
export interface DistributionItem {
  destination: string
  amount: string | number
  crypto: string
}

export function getDistributionFromResponse(data: any, lang: string): DistributionItem[] {
  if (data?.distribution) {
    return data.distribution
  }
  return []
}
