'use client'
import * as React from 'react'

type CircularProgressProps = {
  progress: number
  size?: number
  strokeWidth?: number
  lang?: string
}

const CircularProgress = ({
  progress,
  size = 70,
  strokeWidth = 7,
  lang = 'en',
}: CircularProgressProps) => {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clampedProgress = Math.min(progress, 100)
  const offset = circumference - (clampedProgress / 100) * circumference
  const isCompleted = progress >= 100

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="text-gray-200"
          fill="transparent"
          stroke="currentColor"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className={`transition-all duration-500 ${
            isCompleted ? 'text-green-500' : 'text-primary'
          }`}
          fill="transparent"
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        {isCompleted ? (
          <svg
            className="w-8 h-8 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
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
              progress,
            )}%`}</span>
            <span className="text-xs text-gray-500">
              {lang === 'es' ? 'Completado' : 'Completed'}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

export { CircularProgress as CompletedProgress }

