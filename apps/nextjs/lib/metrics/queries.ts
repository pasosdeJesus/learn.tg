/**
 * Metrics database queries for learn.tg dashboard
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

import { getDb } from '@/db/database'
import { sql } from 'kysely'

export interface CompletionRateData {
  date: string
  completionRate: number
  totalGuides: number
  completedGuides: number
}

export interface RetentionData {
  cooldownType: string
  retentionRate: number
  users: number
}

export interface TimeBetweenGuidesData {
  timeRange: string
  users: number
  percentage: number
}

export interface UserGrowthData {
  date: string
  newUsers: number
  totalUsers: number
  activeUsers: number
}

export interface GameEngagementData {
  gameType: string
  completionRate: number
  avgTime: number
  users: number
}

/**
 * Get completion rate over time
 * TODO: Implement actual SQL query
 */
export async function getCompletionRate(): Promise<CompletionRateData[]> {
  // Mock data - replace with actual query
  return [
    { date: '2025-11-01', completionRate: 65, totalGuides: 200, completedGuides: 130 },
    { date: '2025-11-08', completionRate: 68, totalGuides: 220, completedGuides: 150 },
    { date: '2025-11-15', completionRate: 72, totalGuides: 240, completedGuides: 173 },
    { date: '2025-11-22', completionRate: 70, totalGuides: 260, completedGuides: 182 },
    { date: '2025-11-29', completionRate: 75, totalGuides: 280, completedGuides: 210 },
    { date: '2025-12-06', completionRate: 78, totalGuides: 300, completedGuides: 234 },
    { date: '2025-12-13', completionRate: 80, totalGuides: 320, completedGuides: 256 },
    { date: '2025-12-20', completionRate: 82, totalGuides: 340, completedGuides: 279 },
    { date: '2025-12-27', completionRate: 85, totalGuides: 360, completedGuides: 306 },
    { date: '2026-01-01', completionRate: 87, totalGuides: 380, completedGuides: 331 },
  ]

  /*
  // Actual SQL query (requires guide_usuario.created_at timestamps)
  const db = getDb()
  const result = await sql<CompletionRateData>`
    SELECT
      DATE(gu.created_at) as date,
      COUNT(*) FILTER (WHERE gu.points > 0) * 100.0 / COUNT(*) as completion_rate,
      COUNT(*) as total_guides,
      COUNT(*) FILTER (WHERE gu.points > 0) as completed_guides
    FROM guide_usuario gu
    WHERE gu.created_at IS NOT NULL
    GROUP BY DATE(gu.created_at)
    ORDER BY date
  `.execute(db)
  return result.rows.map(row => ({
    date: row.date,
    completionRate: parseFloat(row.completion_rate),
    totalGuides: row.total_guides,
    completedGuides: row.completed_guides,
  }))
  */
}

/**
 * Get retention rates by cooldown period
 * TODO: Implement actual SQL query
 */
export async function getRetentionByCooldown(): Promise<RetentionData[]> {
  // Mock data - replace with actual query
  return [
    { cooldownType: 'After 24h', retentionRate: 62, users: 450 },
    { cooldownType: 'After 48h', retentionRate: 45, users: 320 },
    { cooldownType: 'After 72h', retentionRate: 35, users: 210 },
    { cooldownType: 'No Cooldown\n(Control)', retentionRate: 28, users: 180 },
    { cooldownType: 'Flexible\n(12-36h)', retentionRate: 55, users: 390 },
  ]

  /*
  // Actual SQL query would analyze guide_usuario.created_at differences
  // between consecutive guides for each user
  */
}

/**
 * Get time distribution between guides
 * TODO: Implement actual SQL query
 */
export async function getTimeBetweenGuides(): Promise<TimeBetweenGuidesData[]> {
  // Mock data - replace with actual query
  return [
    { timeRange: '0-6h', users: 120, percentage: 25 },
    { timeRange: '6-12h', users: 85, percentage: 18 },
    { timeRange: '12-18h', users: 65, percentage: 14 },
    { timeRange: '18-24h', users: 95, percentage: 20 },
    { timeRange: '24-30h', users: 45, percentage: 9 },
    { timeRange: '30-36h', users: 30, percentage: 6 },
    { timeRange: '36-48h', users: 25, percentage: 5 },
    { timeRange: '48h+', users: 20, percentage: 4 },
  ]

  /*
  // Actual SQL query using guide_usuario.created_at timestamps
  // Would calculate time differences between consecutive guides per user
  */
}

/**
 * Get user growth timeline
 * TODO: Implement actual SQL query
 */
export async function getUserGrowth(): Promise<UserGrowthData[]> {
  // Mock data - replace with actual query
  return [
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

  /*
  // Actual SQL query using usuario.created_at and billetera_usuario.created_at
  const db = getDb()
  const result = await sql<UserGrowthData>`
    SELECT
      DATE(u.created_at) as date,
      COUNT(*) as new_users,
      SUM(COUNT(*)) OVER (ORDER BY DATE(u.created_at)) as total_users,
      COUNT(DISTINCT bu.usuario_id) as active_users
    FROM usuario u
    LEFT JOIN billetera_usuario bu ON u.id = bu.usuario_id
    WHERE u.created_at IS NOT NULL
    GROUP BY DATE(u.created_at)
    ORDER BY date
  `.execute(db)
  return result.rows
  */
}

/**
 * Get game type engagement metrics
 * TODO: Implement actual SQL query (currently only crossword exists)
 */
export async function getGameEngagement(): Promise<GameEngagementData[]> {
  // Mock data - replace with actual query
  return [
    { gameType: 'Crossword', completionRate: 85, avgTime: 12.5, users: 520 },
    { gameType: 'Word Search', completionRate: 78, avgTime: 8.2, users: 380 },
    { gameType: 'Matching', completionRate: 82, avgTime: 6.5, users: 420 },
    { gameType: 'Hangman', completionRate: 75, avgTime: 10.3, users: 310 },
    { gameType: 'Fill-in-Blank', completionRate: 88, avgTime: 5.8, users: 480 },
    { gameType: 'Tree Growth', completionRate: 90, avgTime: 15.2, users: 290 },
  ]

  /*
  // Actual SQL query would join userevent table with event_type = 'game_complete'
  // and parse event_data JSON for gameType
  */
}

/**
 * Get all metrics data in one call
 */
export async function getAllMetrics() {
  const [
    completionRate,
    retention,
    timeBetweenGuides,
    userGrowth,
    gameEngagement,
  ] = await Promise.all([
    getCompletionRate(),
    getRetentionByCooldown(),
    getTimeBetweenGuides(),
    getUserGrowth(),
    getGameEngagement(),
  ])

  return {
    completionRate,
    retention,
    timeBetweenGuides,
    userGrowth,
    gameEngagement,
    lastUpdated: new Date().toISOString(),
  }
}