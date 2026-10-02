'use client'

import { useMemo } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'
import {
  courseProgress,
  type ProgressSignal,
  type ProgressSignalInput,
  type SignalProgress,
} from '@/lib/course-progress'

/**
 * Los tres círculos de estado de una tarjeta de curso en la lista (`/en`, `/es`):
 * guías resueltas, becas USDT reclamadas y becas SLEARN reclamadas.
 * El arco y su color se deciden en `lib/course-progress.ts`; aquí solo se dibuja.
 * Ver https://github.com/pasosdeJesus/learn.tg/issues/272.
 */
interface CourseProgressCirclesProps extends ProgressSignalInput {
  lang: string
  size?: number
  strokeWidth?: number
}

export function CourseProgressCircles({
  lang,
  size = 36,
  strokeWidth = 5,
  ...input
}: CourseProgressCirclesProps) {
  const t = useMemo(() => createComponentT(lang, {
    en: {
      check: '{{0}} of {{1}} guides completed',
      usdt: '{{0}} of {{1}} guides paid in USDT',
      slearn: '{{0}} of {{1}} guides paid in SLEARN',
    },
    es: {
      check: '{{0}} de {{1}} guías completadas',
      usdt: '{{0}} de {{1}} guías pagadas en USDT',
      slearn: '{{0}} de {{1}} guías pagadas en SLEARN',
    },
  }), [lang])

  const counts: Record<ProgressSignal, [number, number]> = {
    check: [input.completedGuides, input.totalGuides],
    usdt: [input.paidGuidesUSDT, input.totalGuides],
    slearn: [input.paidGuidesSLEARN, input.totalGuides],
  }

  const signals = courseProgress(input)

  return (
    <div className="flex items-center justify-center gap-3">
      {signals.map((signal) => (
        <Ring
          key={signal.key}
          signal={signal}
          size={size}
          strokeWidth={strokeWidth}
          label={t(signal.key, String(counts[signal.key][0]), String(counts[signal.key][1]))}
        />
      ))}
    </div>
  )
}

function Ring({
  signal,
  size,
  strokeWidth,
  label,
}: {
  signal: SignalProgress
  size: number
  strokeWidth: number
  label: string
}) {
  const radius = (size - strokeWidth) / 2

  // Anillo **sólido** en el color del estado (verde: todo hecho; amarillo: hay
  // algo para reclamar; gris: falta algo pero no hay nada que reclamar). Antes se
  // dibujaba un arco con el avance parcial, que era más difícil de interpretar
  // para el estudiante (petición del operador, 2026-10-01).
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-testid={`progress-circle-${signal.key}`}
      data-state={signal.state}
      data-color={signal.color}
      className="relative flex items-center justify-center rounded-full bg-white"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          data-testid={`progress-ring-${signal.key}`}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className={signal.colorClass}
          fill="transparent"
          stroke="currentColor"
        />
      </svg>
      <span className="absolute flex items-center justify-center">{icon(signal.key, size)}</span>
    </span>
  )
}

function icon(key: ProgressSignal, size: number) {
  const iconSize = Math.round(size * 0.5)

  if (key === 'slearn') {
    return (
      <img
        data-testid="progress-icon-slearn"
        src="/img/slearn-icon.svg"
        alt=""
        aria-hidden="true"
        style={{ width: iconSize, height: iconSize }}
      />
    )
  }

  if (key === 'usdt') {
    return (
      <span
        data-testid="progress-icon-usdt"
        className="font-bold leading-none text-gray-700"
        style={{ fontSize: iconSize }}
      >
        $
      </span>
    )
  }

  return (
    <svg
      data-testid="progress-icon-check"
      width={iconSize}
      height={iconSize}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-gray-700"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  )
}
