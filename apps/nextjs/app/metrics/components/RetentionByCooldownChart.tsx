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
import type { RetentionData } from '@/lib/metrics/queries'


interface RetentionByCooldownChartProps {
  data: RetentionData[]
}

export default function RetentionByCooldownChart({ data }: RetentionByCooldownChartProps) {
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

  // Transform data for chart (add color based on index)
  const chartData = data.map((item, index) => ({
    ...item,
    color: index === 0 ? '#3b82f6' :
           index === 1 ? '#10b981' :
           index === 2 ? '#f59e0b' :
           index === 3 ? '#ef4444' :
           '#8b5cf6'
  }))

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="cooldownType"
            tick={{ fontSize: 11 }}
            interval={0}
            height={50}
            textAnchor="end"
            angle={-45}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            label={{ value: 'Retention %', angle: -90, position: 'insideLeft', offset: -10 }}
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              if (name === 'retentionRate') return [`${value}%`, 'Retention Rate']
              if (name === 'users') return [value, 'Users']
              return [value, name]
            }}
            labelFormatter={(label) => `Cooldown: ${label}`}
          />
          <Legend />
          <Bar
            dataKey="retentionRate"
            name="Retention Rate"
            fill="#3b82f6"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="users"
            name="Users"
            fill="#10b981"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
      <div className="text-xs text-gray-500 mt-2 text-center">
        Retention rates based on users completing guide N and N+1 after cooldown period
      </div>
    </div>
  )
}