'use client'
import * as React from 'react'

type CombinedCircularProgressProps = {
  percentageCompleted: number
  percentagePaid: number
  size?: number
  strokeWidth?: number
  lang?: string
}

const CombinedCircularProgress = ({
  percentageCompleted,
  percentagePaid,
  size = 70,
  strokeWidth = 7,
  lang = 'en',
}: CombinedCircularProgressProps) => {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  // Clamp values between 0 and 100
  const clampedCompleted = Math.min(100, Math.max(0, percentageCompleted))
  const clampedPaid = Math.min(100, Math.max(0, percentagePaid))

  const offsetCompleted = circumference - (clampedCompleted / 100) * circumference
  const offsetPaid = circumference - (clampedPaid / 100) * circumference

  const isCourseCompleted = clampedCompleted >= 100

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      title={lang === 'es' ? `${Math.round(clampedPaid)}% pagado de lo completado` : `${Math.round(clampedPaid)}% paid of completed`}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="text-gray-200"
          fill="transparent"
          stroke="currentColor"
        />
        {/* Completed Progress (Bottom Layer) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="text-primary/30 transition-all duration-500" // Lighter color for completed
          fill="transparent"
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offsetCompleted}
          strokeLinecap="round"
        />
        {/* Paid Progress (Top Layer) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className={`transition-all duration-500 ${
            isCourseCompleted ? 'text-green-500' : 'text-primary'
          }`}
          fill="transparent"
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offsetPaid}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        {isCourseCompleted ? (
          <svg
            className="w-8 h-8 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            data-testid="checkmark-icon"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
              d="M5 13l4 4L19 7"
            />
          </svg>
        ) : (
          <>
            <span className="text-lg font-bold text-gray-800">{`${Math.round(
              clampedCompleted,
            )}%`}</span>
            <span className="text-xs text-gray-500">
              {lang === 'es' ? 'Avance' : 'Progress'}
            </span>
          </>)}
      </div>
    </div>
  )
}

export { CombinedCircularProgress as CompletedProgress }

