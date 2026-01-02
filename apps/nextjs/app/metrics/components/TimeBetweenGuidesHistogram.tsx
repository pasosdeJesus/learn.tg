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

// Mock data - fallback when no data provided
const mockData: TimeBetweenGuidesData[] = [
  { timeRange: '0-6h', users: 120, percentage: 25 },
  { timeRange: '6-12h', users: 85, percentage: 18 },
  { timeRange: '12-18h', users: 65, percentage: 14 },
  { timeRange: '18-24h', users: 95, percentage: 20 },
  { timeRange: '24-30h', users: 45, percentage: 9 },
  { timeRange: '30-36h', users: 30, percentage: 6 },
  { timeRange: '36-48h', users: 25, percentage: 5 },
  { timeRange: '48h+', users: 20, percentage: 4 },
]

interface TimeBetweenGuidesHistogramProps {
  data?: TimeBetweenGuidesData[]
}

export default function TimeBetweenGuidesHistogram({ data = mockData }: TimeBetweenGuidesHistogramProps) {
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