import type { Address } from 'viem'

export interface CourseDonation { type: 'course-donation'; courseId: number }
export interface ClusterDonation { type: 'cluster-donation'; clusterWallet: string; clusterName: string }
export interface CountryDonation { type: 'country-donation'; countryCode: string; countryName: string }

export type PaymentTarget = CourseDonation | ClusterDonation | CountryDonation

export function getDistributionBreakdown(lang: string, target: PaymentTarget, usdtAmount: number, slearnAmount: number) {
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
  }
  return base
}
export function getTargetCopy(lang: string, target: PaymentTarget) {
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
  }
}

/**
 * On-chain recipient — always the backend wallet.
 * The backend interprets the donation endpoint and calls the appropriate
 * contract (LearnTGVaults for courses, ClusterFunds for clusters/countries).
 */
export function getTargetRecipient(_target: PaymentTarget): Address | undefined {
  return (process.env.NEXT_PUBLIC_ADDRESS || '') as Address
}

/** Backend verification endpoint */
export function getTargetEndpoint(target: PaymentTarget): string {
  switch (target.type) {
    case 'course-donation': return '/api/add-donation'
    case 'cluster-donation': return '/api/gdcluster/donations/verify'
    case 'country-donation': return '/api/gdcluster/donations/verify'
  }
}
