import type { Address } from 'viem'

export interface CourseDonation { type: 'course-donation'; courseId: number }
export interface ClusterDonation { type: 'cluster-donation'; clusterWallet: string; clusterName: string }
export interface CountryDonation { type: 'country-donation'; countryCode: string; countryName: string }

export type PaymentTarget = CourseDonation | ClusterDonation | CountryDonation

/** Human-readable copy for each target type */
export function getTargetCopy(lang: string, target: PaymentTarget) {
  const t = (en: string, es: string) => lang === 'es' ? es : en
  switch (target.type) {
    case 'course-donation':
      return {
        title: `${t('Donate to course', 'Donar al curso')} #${target.courseId}`,
        splitInfo: t(
          '70% goes to course scholarships, 10% back as SLEARN reward, 20% sustains operations and missions.',
          '70% va a becas del curso, 10% vuelve como SLEARN de recompensa, 20% sostiene operaciones y misiones.'
        ),
        rewardPct: 10,
        rewardLabel: t('Estimated SLEARN reward', 'Recompensa SLEARN estimada'),
      }
    case 'cluster-donation':
      return {
        title: `${t('Donate to cluster', 'Donar al clúster')}: ${target.clusterName}`,
        splitInfo: t(
          '85% goes to the cluster fund, 15% to pdJ operations.',
          '85% va al fondo del clúster, 15% a operaciones de pdJ.'
        ),
        rewardPct: 0,
        rewardLabel: '',
      }
    case 'country-donation':
      return {
        title: `${t('Donate to country', 'Donar al país')}: ${target.countryName}`,
        splitInfo: t(
          '85% goes to the country fund (distributed among clusters), 15% to pdJ operations.',
          '85% va al fondo del país (distribuido entre clústeres), 15% a operaciones de pdJ.'
        ),
        rewardPct: 0,
        rewardLabel: '',
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
