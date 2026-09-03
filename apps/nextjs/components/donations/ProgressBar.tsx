'use client'

// Barra de progreso hacia la meta de la campaña (REQ/223 §3.1)

interface ProgressBarProps {
  raisedUSD: number | null
  goalUSD: number
}

export default function ProgressBar({ raisedUSD, goalUSD }: ProgressBarProps) {
  const pct = raisedUSD != null && goalUSD > 0 ? Math.min(100, (raisedUSD / goalUSD) * 100) : 0
  return (
    <div className="w-full">
      <div className="h-4 w-full rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-gray-500">{pct.toFixed(0)}% ({raisedUSD != null ? `$${raisedUSD.toFixed(2)}` : '$0.00'} raised)</p>
    </div>
  )
}
