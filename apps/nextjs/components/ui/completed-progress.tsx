'use client'
import * as React from 'react'

type CombinedCircularProgressProps = {
  percentageCompleted: number
  percentagePaid?: number
  size?: number
  strokeWidth?: number
  lang?: string
}

const CombinedCircularProgress = ({
  percentageCompleted,
  percentagePaid = 0,
  size = 70,
  strokeWidth = 7,
  lang = 'en',
}: CombinedCircularProgressProps) => {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  const clampedCompleted = Math.min(100, Math.max(0, percentageCompleted))
  const clampedPaid = Math.min(clampedCompleted, Math.max(0, percentagePaid))

  const completedSegment = (clampedCompleted / 100) * circumference
  const paidSegment = (clampedPaid / 100) * circumference

  const isCourseCompleted = clampedCompleted >= 100

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background Circle (Gray) */}
        <circle
          data-testid="background-circle"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="text-gray-300"
          fill="transparent"
          stroke="currentColor"
        />

        {/* Completed Progress (Yellow) */}
        <circle
          data-testid="completed-circle"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="text-yellow-400"
          fill="transparent"
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - completedSegment}
          strokeLinecap="butt" // Use 'butt' to avoid rounded edges overlapping
        />

        {/* Paid Progress (Green) - Rendered on top of the yellow */}
        {paidSegment > 0 && (
          <circle
            data-testid="paid-circle"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            className="text-green-500"
            fill="transparent"
            stroke="currentColor"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - paidSegment}
            strokeLinecap="butt" // Use 'butt' to ensure clean lines
          />
        )}
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
          </>
        )}
      </div>
    </div>
  )
}

export { CombinedCircularProgress as CompletedProgress }
