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
  Cell,
} from 'recharts'
import type { GameEngagementData } from '@/lib/metrics/queries'


const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

interface GameTypeEngagementChartProps {
  data: GameEngagementData[]
}

export default function GameTypeEngagementChart({ data }: GameTypeEngagementChartProps) {
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

  // Add colors to data for consistent coloring
  const chartData = data.map((item, index) => ({
    ...item,
    color: colors[index % colors.length]
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
            dataKey="gameType"
            tick={{ fontSize: 12 }}
            label={{ value: 'Game Type', position: 'insideBottom', offset: -10 }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 12 }}
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            label={{ value: 'Completion %', angle: -90, position: 'insideLeft', offset: -10 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12 }}
            label={{ value: 'Avg Time (min)', angle: 90, position: 'insideRight', offset: -10 }}
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              if (name === 'completionRate') return [`${value}%`, 'Completion Rate']
              if (name === 'avgTime') return [`${value} min`, 'Average Time']
              if (name === 'users') return [value, 'Users']
              return [value, name]
            }}
            labelFormatter={(label) => `Game: ${label}`}
          />
          <Legend />
          <Bar
            yAxisId="left"
            dataKey="completionRate"
            name="Completion Rate"
            radius={[4, 4, 0, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
          <Bar
            yAxisId="right"
            dataKey="avgTime"
            name="Average Time (min)"
            radius={[4, 4, 0, 0]}
            fill="#9ca3af"
          />
        </BarChart>
      </ResponsiveContainer>
      <div className="text-xs text-gray-500 mt-2 text-center">
        Engagement metrics by game type (currently only crossword available, others planned)
      </div>
    </div>
  )
}