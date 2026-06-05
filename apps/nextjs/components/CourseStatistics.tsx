'use client'

import { useMemo } from 'react'
import { CompletedProgress } from '@/components/ui/completed-progress'
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
  percentagePaid: number | null
  percentageCompleted?: number | null
  scholarshipPaid?: number | null
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
  percentageCompleted,
  percentagePaid,
  scholarshipPaid
}: CourseStatisticsProps) {
  const t = useMemo(() => createComponentT(lang, {
    en: {
      scholarshipOf: 'Scholarship of ',
      perGuide: ' per guide.',
      scholarshipUpTo: `Scholarship of up to {{0}} USDT after you complete your profile.`,
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
      scholarshipUpTo: 'Beca de hasta {{0}} USDT después de que completes tu perfil.',
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
                {t('perGuide')}
              </span>
            </div>
          ) : (
            <div className="p-2">
              <span>
                {t('scholarshipUpTo', String(scholarshipPerGuide))}
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
            {vaultBalanceSlearn !== null && +vaultBalanceSlearn > 0 ? (
              <span>{t('vaultBalanceWithSlearn', vaultBalance.toFixed(2), vaultBalanceSlearn.toFixed(2))}</span>
            ) : (
              <span>{t('vaultBalance', vaultBalance.toFixed(2))}</span>
            )}
          </div>
        )}
        {full && (
          <div className="pt-2">
            {t('totalGuides')}
            {totalGuides}
          </div>
        )}
        {full && typeof completedGuides === 'number' && typeof percentageCompleted === 'number' && (
          <div>
            {t('approvedGuides')}
            {completedGuides}  ({percentageCompleted}%)
          </div>
        )}
        {full && typeof paidGuides === 'number' && typeof percentagePaid === 'number' && (
          <div>
            {t('paidGuides')}
            {paidGuides} ({percentagePaid}%)
          </div>
        )}
        {full && typeof scholarshipPaid === 'number' && (
          <div>
            {t('totalScholarship')}
            {scholarshipPaid.toFixed(2)} USDT
          </div>
        )}
        {full && scholarshipPerGuideSlearn !== null && scholarshipPerGuideSlearn > 0 && (
          <div>
            {t('perGuideSlearn', String(scholarshipPerGuideSlearn))}
          </div>
        )}
      </div>
      <CompletedProgress
        percentageCompleted={percentageCompleted || 0}
        percentagePaid={percentagePaid || 0}
        lang={lang}
      />
    </div>
  )
}
