'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { CompletionRateData } from '@/lib/metrics/queries'

interface CompletionRateChartProps {
  data: CompletionRateData[]
}

export default function CompletionRateChart({ data }: CompletionRateChartProps) {
  // Handle empty data
  if (data.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-gray-500">
        <div className="text-lg mb-2">📊</div>
        <p className="text-center">Not enough data to show metrics.</p>
        <p className="text-center text-sm">Data will appear when users interact with guides.</p>
      </div>
    )
  }

  // Transform data for chart
  const chartData = data.map(item => ({
    date: item.date,
    completionRate: item.completionRate,
    totalGuides: item.totalGuides,
    completedGuides: item.completedGuides,
  }))

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            label={{ value: 'Completion %', angle: -90, position: 'insideLeft', offset: -10 }}
          />
          <Tooltip
            formatter={(value: number) => [`${value}%`, 'Completion Rate']}
            labelFormatter={(label) => `Date: ${new Date(label).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="completionRate"
            name="Completion Rate"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="text-xs text-gray-500 mt-2 text-center">
        Based on guide_usuario.points &gt; 0 across all courses
      </div>
    </div>
  )
}