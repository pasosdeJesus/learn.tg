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

// Mock data - to be replaced with actual database queries
const mockData = [
  { gameType: 'Crossword', completionRate: 85, avgTime: 12.5, users: 520, color: '#3b82f6' },
  { gameType: 'Word Search', completionRate: 78, avgTime: 8.2, users: 380, color: '#10b981' },
  { gameType: 'Matching', completionRate: 82, avgTime: 6.5, users: 420, color: '#f59e0b' },
  { gameType: 'Hangman', completionRate: 75, avgTime: 10.3, users: 310, color: '#ef4444' },
  { gameType: 'Fill-in-Blank', completionRate: 88, avgTime: 5.8, users: 480, color: '#8b5cf6' },
  { gameType: 'Tree Growth', completionRate: 90, avgTime: 15.2, users: 290, color: '#ec4899' },
]

export default function GameTypeEngagementChart() {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={mockData}
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
            {mockData.map((entry, index) => (
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