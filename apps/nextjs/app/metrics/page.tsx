/**
 * Metrics Dashboard Page
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { getAllMetrics } from '@/lib/metrics/queries'

// Dynamically import chart components to avoid SSR issues with Recharts
const CompletionRateChart = dynamic(
  () => import('./components/CompletionRateChart'),
  { loading: () => <div className="h-64 flex items-center justify-center">Loading completion data...</div> }
)
const RetentionByCooldownChart = dynamic(
  () => import('./components/RetentionByCooldownChart'),
  { loading: () => <div className="h-64 flex items-center justify-center">Loading retention data...</div> }
)
const TimeBetweenGuidesHistogram = dynamic(
  () => import('./components/TimeBetweenGuidesHistogram'),
  { loading: () => <div className="h-64 flex items-center justify-center">Loading time distribution data...</div> }
)
const UserGrowthTimeline = dynamic(
  () => import('./components/UserGrowthTimeline'),
  { loading: () => <div className="h-64 flex items-center justify-center">Loading user growth data...</div> }
)
const GameTypeEngagementChart = dynamic(
  () => import('./components/GameTypeEngagementChart'),
  { loading: () => <div className="h-64 flex items-center justify-center">Loading game engagement data...</div> }
)

export default async function MetricsDashboardPage() {
  // Fetch metrics data server-side
  const metrics = await getAllMetrics()
  const {
    completionRate,
    retention,
    timeBetweenGuides,
    userGrowth,
    gameEngagement,
    lastUpdated
  } = metrics

  return (
    <div className="container mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Learn.tg Metrics Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Analytics and insights to measure platform performance and user engagement
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Completion Rate Chart */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Completion Rate</h2>
          <p className="text-sm text-gray-500 mb-4">
            Percentage of guides completed successfully across all courses
          </p>
          <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading completion data...</div>}>
            <CompletionRateChart data={completionRate} />
          </Suspense>
        </section>

        {/* Retention by Cooldown Chart */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Retention by Cooldown</h2>
          <p className="text-sm text-gray-500 mb-4">
            User retention rates based on 24-hour cooldown periods
          </p>
          <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading retention data...</div>}>
            <RetentionByCooldownChart data={retention} />
          </Suspense>
        </section>

        {/* Time Between Guides Histogram */}
        <section className="bg-white rounded-lg shadow p-6 lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Time Between Guides</h2>
          <p className="text-sm text-gray-500 mb-4">
            Distribution of time users take between completing consecutive guides
          </p>
          <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading time distribution data...</div>}>
            <TimeBetweenGuidesHistogram data={timeBetweenGuides} />
          </Suspense>
        </section>

        {/* User Growth Timeline */}
        <section className="bg-white rounded-lg shadow p-6 lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">User Growth Timeline</h2>
          <p className="text-sm text-gray-500 mb-4">
            New user registrations and active users over time
          </p>
          <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading user growth data...</div>}>
            <UserGrowthTimeline data={userGrowth} />
          </Suspense>
        </section>

        {/* Game Type Engagement Chart */}
        <section className="bg-white rounded-lg shadow p-6 lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Game Type Engagement</h2>
          <p className="text-sm text-gray-500 mb-4">
            User engagement and completion rates by game type (crossword, etc.)
          </p>
          <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading game engagement data...</div>}>
            <GameTypeEngagementChart data={gameEngagement} />
          </Suspense>
        </section>
      </div>

      <footer className="mt-8 pt-6 border-t border-gray-200 text-sm text-gray-500">
        <p>
          <strong>Data Last Updated:</strong> {new Date(lastUpdated).toLocaleDateString()} {new Date(lastUpdated).toLocaleTimeString()}
        </p>
        <p className="mt-2">
          <em>
            &quot;Con sabiduría se edifica la casa, y con prudencia se afirma; y con ciencia se llenan las cámaras de todo bien preciado y agradable.&quot;
            (Proverbios 24:3-4)
          </em>
        </p>
      </footer>
    </div>
  )
}