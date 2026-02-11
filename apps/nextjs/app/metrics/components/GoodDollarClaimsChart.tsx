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
import type { GoodDollarClaimData } from '@/lib/metrics/queries'


interface GoodDollarClaimsChartProps {
  data: GoodDollarClaimData[]
}

export default function GoodDollarClaimsChart({ data }: GoodDollarClaimsChartProps) {
  // Handle empty data
  if (data.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-gray-500">
        <div className="text-lg mb-2">📊</div>
        <p className="text-center">No GoodDollar claim data available yet.</p>
        <p className="text-center text-sm">Data will appear here as users claim their G$ rewards.</p>
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
            label={{ value: 'Count', angle: -90, position: 'insideLeft', offset: -10 }}
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              const names: Record<string, string> = {
                claims: 'Total Claims',
                users: 'Unique Users',
              }
              return [value, names[name] || name]
            }}
            labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="claims"
            name="Total Claims"
            stackId="1"
            stroke="#8884d8"
            fill="#8884d8"
            fillOpacity={0.6}
          />
          <Area
            type="monotone"
            dataKey="users"
            name="Unique Users"
            stackId="2"
            stroke="#82ca9d"
            fill="#82ca9d"
            fillOpacity={0.6}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="text-xs text-gray-500 mt-2 text-center">
        GoodDollar daily claim metrics based on 'g$c_claim' user events.
      </div>
    </div>
  )
}
