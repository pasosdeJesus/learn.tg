'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { UserGrowthData } from '@/lib/metrics/queries'

// Mock data - fallback when no data provided
const mockData: UserGrowthData[] = [
  { date: '2025-10-01', newUsers: 15, totalUsers: 15, activeUsers: 12 },
  { date: '2025-10-08', newUsers: 22, totalUsers: 37, activeUsers: 28 },
  { date: '2025-10-15', newUsers: 18, totalUsers: 55, activeUsers: 35 },
  { date: '2025-10-22', newUsers: 25, totalUsers: 80, activeUsers: 45 },
  { date: '2025-10-29', newUsers: 30, totalUsers: 110, activeUsers: 52 },
  { date: '2025-11-05', newUsers: 35, totalUsers: 145, activeUsers: 65 },
  { date: '2025-11-12', newUsers: 40, totalUsers: 185, activeUsers: 78 },
  { date: '2025-11-19', newUsers: 45, totalUsers: 230, activeUsers: 92 },
  { date: '2025-11-26', newUsers: 50, totalUsers: 280, activeUsers: 105 },
  { date: '2025-12-03', newUsers: 55, totalUsers: 335, activeUsers: 125 },
  { date: '2025-12-10', newUsers: 60, totalUsers: 395, activeUsers: 145 },
  { date: '2025-12-17', newUsers: 65, totalUsers: 460, activeUsers: 165 },
  { date: '2025-12-24', newUsers: 70, totalUsers: 530, activeUsers: 185 },
  { date: '2025-12-31', newUsers: 75, totalUsers: 605, activeUsers: 210 },
  { date: '2026-01-01', newUsers: 80, totalUsers: 685, activeUsers: 235 },
]

interface UserGrowthTimelineProps {
  data?: UserGrowthData[]
}

export default function UserGrowthTimeline({ data = mockData }: UserGrowthTimelineProps) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            label={{ value: 'Date', position: 'insideBottom', offset: -10 }}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            label={{ value: 'Users', angle: -90, position: 'insideLeft', offset: -10 }}
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              const names: Record<string, string> = {
                newUsers: 'New Users',
                totalUsers: 'Total Users',
                activeUsers: 'Active Users',
              }
              return [value, names[name] || name]
            }}
            labelFormatter={(label) => `Week of ${new Date(label).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="totalUsers"
            name="Total Users"
            stackId="1"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.6}
          />
          <Area
            type="monotone"
            dataKey="activeUsers"
            name="Active Users"
            stackId="2"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.6}
          />
          <Area
            type="monotone"
            dataKey="newUsers"
            name="New Users"
            stackId="3"
            stroke="#f59e0b"
            fill="#f59e0b"
            fillOpacity={0.6}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="text-xs text-gray-500 mt-2 text-center">
        User growth metrics based on usuario.created_at and billetera_usuario activity
      </div>
    </div>
  )
}