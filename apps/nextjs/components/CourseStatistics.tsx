'use client'

import { CompletedProgress } from '@/components/ui/completed-progress'

export interface CourseStatisticsProps {
  lang: string
  full: boolean
  address: string | undefined
  profileScore: number | null
  scholarshipPerGuide: number | null
  percentagePaid: number | null
  canSubmit: boolean | null
  percentageCompleted?: number | null
  totalGuides?: number | null
  completedGuides?: number
  paidGuides?: number
  scholarshipPaid?: number | null
}

export function CourseStatistics({
  lang,
  full,
  address,
  profileScore,
  scholarshipPerGuide,
  percentagePaid,
  canSubmit,
  percentageCompleted,
  totalGuides,
  completedGuides,
  paidGuides,
  scholarshipPaid
}: CourseStatisticsProps) {
  return (
    <div className="flex justify-between items-center p-4 mt-auto">
      <div>{
        (scholarshipPerGuide && scholarshipPerGuide > 0 && address && 
         profileScore && profileScore > 0) ? (
          <div className="p-2">
            <span>
              {lang === 'es'
                ? 'Beca de '
                : 'Scholarship of '}$
              {(
                (scholarshipPerGuide * 100) /
                profileScore
              ).toFixed(2)}{' '}
              USDT
              {lang === 'es' ? ' por guía.' : ' per guide.'}
            </span>
          </div>
        ) : (
          <div className="p-2">
            <span>
              {lang === 'es'
                ? 'Beca de hasta 1 USDT después de que completes tu perfil.'
                : 'Scholarship of up to 1 USDT after you complete your profile.'}
            </span>
          </div>
        )
      }
      { scholarshipPerGuide && scholarshipPerGuide > 0 && address && 
        percentagePaid && percentagePaid < 100 && !canSubmit && (
          <div className="p-2">
            <span className="text-red-500">
              {lang === 'es'
                ? 'Aunque estás en etapa de enfriamiento'
                : 'Although you are in cooldown period.'}
            </span>
          </div>
        )
      }
      { scholarshipPerGuide && scholarshipPerGuide > 0 && canSubmit && 
        percentagePaid && percentagePaid < 100 && (
          <div className="p-2 text-green-600">
            <span className="text-green-600">
              {lang === 'es'
                ? 'Eres elegible.'
                : 'You are eligible.'}
            </span>
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
