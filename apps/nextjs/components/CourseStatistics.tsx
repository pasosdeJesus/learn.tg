'use client'

import { CompletedProgress } from '@/components/ui/completed-progress'

export interface CourseStatisticsProps {
  lang: string
  full: boolean
  address: string | undefined
  totalGuides?: number | null
  scholarshipPerGuide: number | null
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
  profileScore,
  canSubmit,
  completedGuides,
  paidGuides,
  percentageCompleted,
  percentagePaid,
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
      { full && (
        <div className="pt-2">
          {lang === 'es' ? 'Total de guias en el curso: ' : 
            'Total number of guides in the course: '}
          {totalGuides}
        </div>
      )}
      { full && completedGuides && percentageCompleted && (
        <div>
          {lang === 'es' ? 'Guías aprobadas: ' : 
            'Approved guides: '}
          {completedGuides}  ({percentageCompleted}%)
        </div>
      )}
      { full && paidGuides && percentagePaid && (
        <div>
          {lang === 'es' ? 'Guías aprobadas con beca pagada: ' : 
            'Approved guides with scholarship paid: '}
          {paidGuides} ({percentagePaid}%)
        </div>
      )}
      { full && scholarshipPaid && (
        <div>
          {lang === 'es' ? 'Beca total pagada en este curso: ' :
            'Total scholarship paid in this course: '
          }
          {scholarshipPaid} USDT
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
