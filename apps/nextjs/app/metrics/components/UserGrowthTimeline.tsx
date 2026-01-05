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


interface UserGrowthTimelineProps {
  data: UserGrowthData[]
}

export default function UserGrowthTimeline({ data }: UserGrowthTimelineProps) {
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