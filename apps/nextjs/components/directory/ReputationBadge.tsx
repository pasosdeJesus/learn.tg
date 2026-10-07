'use client'

import type { ReputationKey } from '@/lib/church-directory'

// R-#164: the reputation is shown as a human label, not a number (a score of 10 or
// 30 says little). The situation, not a threshold, picks the label: a verified
// church with a verified lead pastor is "Good"; without a registered pastor it is
// "Good (pastor not registered)"; a negative case is "Not recommended".

const LABELS = {
  en: {
    good: 'Good',
    good_no_pastor: 'Good (pastor not registered)',
    not_recommended: 'Not recommended',
  },
  es: {
    good: 'Buena',
    good_no_pastor: 'Buena (pastor no registrado)',
    not_recommended: 'No recomendada',
  },
} as const

const COLORS: Record<ReputationKey, string> = {
  good: 'text-green-700',
  good_no_pastor: 'text-green-700',
  not_recommended: 'text-amber-700',
}

export function ReputationBadge({ reputationKey, lang }: { reputationKey: ReputationKey; lang: string }) {
  const labels = LABELS[lang === 'es' ? 'es' : 'en']
  return <span className={`text-xs ${COLORS[reputationKey]}`}>{labels[reputationKey]}</span>
}
