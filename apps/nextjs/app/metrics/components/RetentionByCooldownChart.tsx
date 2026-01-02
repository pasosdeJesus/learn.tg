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

// Mock data - to be replaced with actual database queries
const mockData = [
  {
    cooldownType: 'After 24h',
    retentionRate: 62,
    users: 450,
    color: '#3b82f6'
  },
  {
    cooldownType: 'After 48h',
    retentionRate: 45,
    users: 320,
    color: '#10b981'
  },
  {
    cooldownType: 'After 72h',
    retentionRate: 35,
    users: 210,
    color: '#f59e0b'
  },
  {
    cooldownType: 'No Cooldown\n(Control)',
    retentionRate: 28,
    users: 180,
    color: '#ef4444'
  },
  {
    cooldownType: 'Flexible\n(12-36h)',
    retentionRate: 55,
    users: 390,
    color: '#8b5cf6'
  },
]

export default function RetentionByCooldownChart() {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={mockData}
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
            name="Users (Sample)"
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