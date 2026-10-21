// R-#164 §4.1 — church `activity_score`.
//
// Reuses the six R-#278 components (weights below) aggregated **per church** in
// `churchactivitycache` (raw sums). The normalization is done here, at read time,
// over the whole directory population — never over the visitor's filtered view —
// so a church's score does not change with the country/denomination filter.

export interface ActivityComponents {
  guide_score_sum: number | string | null
  referral_count_sum: number | string | null
  donations_usdt_sum: number | string | null
  sbt_count_sum: number | string | null
  slearn_balance_sum: number | string | null
  profilescore_sum: number | string | null
}

// Weights from R-#278 §4 (must stay in sync with lib/leaderboard-queries.ts).
const WEIGHTS = {
  guide: 0.35,
  referral: 0.15,
  donations: 0.15,
  sbt: 0.15,
  slearn: 0.10,
  profile: 0.10,
} as const

const toNum = (v: number | string | null | undefined) => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

const compress = (x: number) => Math.log(1 + Math.max(x, 0))

/**
 * Normalizes one component to 0..1 with min-max over `ln(1 + max(x, 0))`.
 * A flat component (max == min) contributes 0, not NaN (like R-#278).
 */
function normalize(values: number[], raw: number): number {
  const compressed = values.map(compress)
  const min = Math.min(...compressed)
  const max = Math.max(...compressed)
  if (max - min === 0) return 0
  return (compress(raw) - min) / (max - min)
}

/**
 * Computes each church's `activity_score` (0-100) over the given population.
 * The population must be the **whole** directory population, not a filtered page.
 */
export function computeActivityScores<T extends ActivityComponents>(
  churches: T[],
): Map<number, number> {
  const scores = new Map<number, number>()
  if (churches.length === 0) return scores

  const fields = ['guide_score_sum', 'referral_count_sum', 'donations_usdt_sum', 'sbt_count_sum', 'slearn_balance_sum', 'profilescore_sum'] as const
  const columns: Record<string, number[]> = {}
  for (const f of fields) columns[f] = churches.map((c) => toNum(c[f]))

  for (const c of churches) {
    const id = (c as unknown as { church_id: number }).church_id
    const n = (f: (typeof fields)[number]) => normalize(columns[f], toNum(c[f]))
    const score =
      100 * (
        WEIGHTS.guide * n('guide_score_sum') +
        WEIGHTS.referral * n('referral_count_sum') +
        WEIGHTS.donations * n('donations_usdt_sum') +
        WEIGHTS.sbt * n('sbt_count_sum') +
        WEIGHTS.slearn * n('slearn_balance_sum') +
        WEIGHTS.profile * n('profilescore_sum')
      )
    scores.set(id, Math.round(score * 100) / 100)
  }
  return scores
}
