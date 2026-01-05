'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { TimeBetweenGuidesData } from '@/lib/metrics/queries'


interface TimeBetweenGuidesHistogramProps {
  data: TimeBetweenGuidesData[]
}

export default function TimeBetweenGuidesHistogram({ data }: TimeBetweenGuidesHistogramProps) {
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

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="timeRange"
            tick={{ fontSize: 12 }}
            label={{ value: 'Time Between Guides', position: 'insideBottom', offset: -10 }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 12 }}
            label={{ value: 'Users', angle: -90, position: 'insideLeft', offset: -10 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12 }}
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            label={{ value: 'Percentage', angle: 90, position: 'insideRight', offset: -10 }}
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              if (name === 'users') return [value, 'Users']
              if (name === 'percentage') return [`${value}%`, 'Percentage']
              return [value, name]
            }}
            labelFormatter={(label) => `Time Range: ${label}`}
          />
          <Legend />
          <Bar
            yAxisId="left"
            dataKey="users"
            name="Users"
            fill="#3b82f6"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            yAxisId="right"
            dataKey="percentage"
            name="Percentage"
            fill="#10b981"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
      <div className="text-xs text-gray-500 mt-2 text-center">
        Distribution of time users take between completing consecutive guides (based on guide_usuario.created_at)
      </div>
    </div>
  )
}