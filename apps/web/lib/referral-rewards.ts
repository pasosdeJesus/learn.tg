// lib/referral-rewards.ts
// Lógica pura de recompensas de referidos (https://github.com/pasosdeJesus/learn.tg/issues/163, separado de testimonios → https://github.com/pasosdeJesus/learn.tg/issues/219).
//
// Reglas (https://github.com/pasosdeJesus/learn.tg/issues/163 §1):
// - Form 1: 10% del precio del curso premium, pagado 50% USDT + 50% SLEARN.
// - Form 2: 10% del scholarship (USDT y SLEARN) en curso missional; el
//   estudiante conserva el 100%.
// - Form 3: 1 USDT cuando el referido es pastor y compra el curso GD.
// - Funding: todas las recompensas se pagan DESDE la referral wallet; si no
//   hay fondos, se omite (canPayFromWallet).

export type ReferralForm = 1 | 2 | 3

export interface RewardAmounts {
  usdt: number
  slearn: number
}

const FORM1_PCT = 0.1 // 10% del precio, dividido 50/50 USDT/SLEARN
const FORM2_PCT = 0.1 // 10% del scholarship (por moneda)
const FORM3_USDT = 1 // 1 USDT pastor bonus

const round2 = (n: number): number => Math.round(n * 100) / 100

export function referralReward(
  form: ReferralForm,
  opts: {
    coursePriceUsdt?: number
    scholarshipUsdt?: number
    scholarshipSlearn?: number
    isPastorReferral?: boolean
  },
): RewardAmounts {
  switch (form) {
    case 1: {
      const pct = (opts.coursePriceUsdt ?? 0) * FORM1_PCT
      return { usdt: round2(pct / 2), slearn: round2(pct / 2) }
    }
    case 2:
      return {
        usdt: round2((opts.scholarshipUsdt ?? 0) * FORM2_PCT),
        slearn: round2((opts.scholarshipSlearn ?? 0) * FORM2_PCT),
      }
    case 3:
      return opts.isPastorReferral ? { usdt: FORM3_USDT, slearn: 0 } : { usdt: 0, slearn: 0 }
  }
}

/**
 * Regla de funding (https://github.com/pasosdeJesus/learn.tg/issues/163): la recompensa se paga desde la referral wallet;
 * si la wallet no tiene fondos suficientes, la recompensa se omite.
 */
export function canPayFromWallet(
  reward: RewardAmounts,
  wallet: { usdt: number; slearn: number },
): boolean {
  return wallet.usdt >= reward.usdt && wallet.slearn >= reward.slearn
}
