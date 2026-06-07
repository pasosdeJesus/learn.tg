'use client'

import { useMemo } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'

export interface CourseStatisticsProps {
  lang: string
  full: boolean
  address: string | undefined
  totalGuides?: number | null
  scholarshipPerGuide: number | null
  scholarshipPerGuideSlearn?: number | null
  vaultBalance: number | null
  vaultBalanceSlearn?: number | null
  profileScore: number | null
  canSubmit: boolean | null
  completedGuides?: number | null
  paidGuides?: number | null
  paidGuidesUSDT?: number | null
  paidGuidesSLEARN?: number | null
  percentagePaid: number | null
  percentageCompleted?: number | null
  scholarshipPaid?: number | null
  scholarshipPaidSlearn?: number | null
}

export function CourseStatistics({
  lang,
  full,
  address,
  totalGuides,
  scholarshipPerGuide,
  scholarshipPerGuideSlearn,
  vaultBalance,
  vaultBalanceSlearn,
  profileScore,
  canSubmit,
  completedGuides,
  paidGuides,
  paidGuidesUSDT,
  paidGuidesSLEARN,
  percentageCompleted,
  percentagePaid,
  scholarshipPaid,
  scholarshipPaidSlearn
}: CourseStatisticsProps) {
  const t = useMemo(() => createComponentT(lang, {
    en: {
      scholarshipOf: 'Scholarship of ',
      perGuide: ' per guide.',
      scholarshipOfSlearn: ' + {{0}} SLEARN',
      scholarshipUpTo: `Scholarship of up to {{0}} USDT{{1}} after you complete your profile.`,
      cooldown: 'Although you are in cooldown period.',
      eligible: 'You are eligible.',
      totalGuides: 'Total number of guides in the course: ',
      approvedGuides: 'Approved guides: ',
      paidGuides: 'Approved guides with scholarship paid: ',
      totalScholarship: 'Total scholarship paid in this course: ',
      vaultBalance: 'Course vault: {{0}} USDT',
      vaultBalanceWithSlearn: 'Course vault: {{0}} USDT + {{1}} SLEARN',
      perGuideSlearn: '{{0}} SLEARN per guide.',
    },
    es: {
      scholarshipOf: 'Beca de ',
      perGuide: ' por guía.',
      scholarshipOfSlearn: ' + {{0}} SLEARN',
      scholarshipUpTo: 'Beca de hasta {{0}} USDT{{1}} después de que completes tu perfil.',
      cooldown: 'Aunque estás en etapa de enfriamiento',
      eligible: 'Eres elegible.',
      totalGuides: 'Total de guias en el curso: ',
      approvedGuides: 'Guías aprobadas: ',
      paidGuides: 'Guías aprobadas con beca pagada: ',
      totalScholarship: 'Beca total pagada en este curso: ',
      vaultBalance: 'Bóveda del curso: {{0}} USDT',
      vaultBalanceWithSlearn: 'Bóveda del curso: {{0}} USDT + {{1}} SLEARN',
      perGuideSlearn: '{{0}} SLEARN por guía.',
    },
  }), [lang])

  return (
    <div className="flex justify-between items-center p-4 mt-auto">
      <div>
        {scholarshipPerGuide !== null && +scholarshipPerGuide > 0 && (
          (profileScore !== null && address && +profileScore > 0) ? (
            <div className="p-2">
              <span>
                {t('scholarshipOf')}
                {(
                  (scholarshipPerGuide * profileScore) /
                  100
                ).toFixed(2)}{' '}
                USDT
                {scholarshipPerGuideSlearn != null && scholarshipPerGuideSlearn > 0 && (
                  t('scholarshipOfSlearn',
                    ((scholarshipPerGuideSlearn * profileScore) / 100).toFixed(2)
                  )
                )}
                {t('perGuide')}
              </span>
            </div>
          ) : (
            <div className="p-2">
              <span>
                {t('scholarshipUpTo', String(scholarshipPerGuide),
                  scholarshipPerGuideSlearn != null && scholarshipPerGuideSlearn > 0
                    ? ` + ${scholarshipPerGuideSlearn} SLEARN`
                    : ''
                )}
              </span>
            </div>
          )
        )}
        {scholarshipPerGuide !== null && percentagePaid !== null &&
          +scholarshipPerGuide > 0 && address &&
          +percentagePaid < 100 && !canSubmit && (
            <div className="p-2">
              <span className="text-red-500">
                {t('cooldown')}
              </span>
            </div>
          )
        }
        {scholarshipPerGuide != null && percentagePaid !== null &&
          scholarshipPerGuide > 0 && canSubmit &&
          +percentagePaid < 100 && (
            <div className="p-2 text-green-600">
              <span className="text-green-600">
                {t('eligible')}
              </span>
            </div>
        )}
        {vaultBalance !== null && +vaultBalance > 0 && (
          <div className="pt-2">
            {vaultBalanceSlearn != null && +vaultBalanceSlearn > 0 ? (
              <span>{t('vaultBalanceWithSlearn', vaultBalance.toFixed(2), vaultBalanceSlearn.toFixed(2))}</span>
            ) : (
              <span>{t('vaultBalance', vaultBalance.toFixed(2))}</span>
            )}
          </div>
        )}
        {full && typeof completedGuides === 'number' && typeof totalGuides === 'number' && totalGuides > 0 && (
          <div className="pt-2 space-y-2 w-full max-w-xs">
            <ProgressBar
              label="✅"
              value={completedGuides}
              total={totalGuides}
              color="bg-green-500"
              lang={lang}
            />
            <ProgressBar
              label="💵"
              value={paidGuidesUSDT ?? 0}
              total={totalGuides}
              color="bg-yellow-500"
              lang={lang}
            />
            <ProgressBar
              label="⚡"
              value={paidGuidesSLEARN ?? 0}
              total={totalGuides}
              color="bg-purple-500"
              lang={lang}
            />
          </div>
        )}
        {full && typeof scholarshipPaid === 'number' && (
          <div>
            {t('totalScholarship')}
            {scholarshipPaid.toFixed(2)} USDT
            {scholarshipPaidSlearn != null && scholarshipPaidSlearn > 0 && (
              <> + {scholarshipPaidSlearn.toFixed(2)} SLEARN</>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ProgressBar({ label, value, total, color }: { label: string; value: number; total: number; color: string; lang?: string }) {
  const pct = Math.min(100, Math.round((value / total) * 100))
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-5 text-center">{label}</span>
      <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-16 text-right text-xs tabular-nums">{value}/{total} ({pct}%)</span>
    </div>
  )
}
