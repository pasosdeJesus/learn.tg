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
 */
export async function getCompletionRate(): Promise<CompletionRateData[]> {
  try {
    const db = getDb()

    // First try to get data grouped by date (requires created_at)
    const result = await sql<{
      date: string
      completion_rate: string
      total_guides: number
      completed_guides: number
    }>`
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

    if (result.rows.length > 0) {
      return result.rows.map(row => ({
        date: row.date,
        completionRate: parseFloat(row.completion_rate),
        totalGuides: row.total_guides,
        completedGuides: row.completed_guides,
      }))
    }

    // If no dated data, try to get overall completion rate (ignoring dates)
    const overallResult = await sql<{
      completion_rate: string
      total_guides: number
      completed_guides: number
    }>`
      SELECT
        COUNT(*) FILTER (WHERE points > 0) * 100.0 / COUNT(*) as completion_rate,
        COUNT(*) as total_guides,
        COUNT(*) FILTER (WHERE points > 0) as completed_guides
      FROM guide_usuario
      WHERE points IS NOT NULL
    `.execute(db)

    if (overallResult.rows.length > 0) {
      const row = overallResult.rows[0]
      // Return a single data point with today's date for visualization
      return [{
        date: new Date().toISOString().split('T')[0], // Today's date
        completionRate: parseFloat(row.completion_rate || '0'),
        totalGuides: row.total_guides,
        completedGuides: row.completed_guides,
      }]
    }

    // No data at all
    console.warn('[metrics] No completion rate data found in database')
    return []
  } catch (error) {
    console.error('[metrics] Error fetching completion rate:', error)
    // Return empty array instead of mock data
    return []
  }
}


/**
 * Get retention rates by cooldown period
 */
export async function getRetentionByCooldown(): Promise<RetentionData[]> {
  try {
    const db = getDb()
    const result = await sql<{
      cooldown_type: string
      retention_rate: number
      users: number
    }>`
      WITH guide_sequences AS (
        SELECT
          usuario_id,
          created_at,
          LEAD(created_at) OVER (PARTITION BY usuario_id ORDER BY created_at) as next_created_at
        FROM guide_usuario
        WHERE points > 0
          AND created_at IS NOT NULL
      ),
      time_differences AS (
        SELECT
          usuario_id,
          EXTRACT(EPOCH FROM (next_created_at - created_at)) / 3600 as hours_to_next
        FROM guide_sequences
        WHERE next_created_at IS NOT NULL
      ),
      user_retention AS (
        SELECT
          usuario_id,
          BOOL_OR(hours_to_next <= 24) as retained_24h,
          BOOL_OR(hours_to_next > 24 AND hours_to_next <= 48) as retained_48h,
          BOOL_OR(hours_to_next > 48 AND hours_to_next <= 72) as retained_72h,
          BOOL_OR(hours_to_next > 12 AND hours_to_next <= 36) as retained_flexible
        FROM time_differences
        GROUP BY usuario_id
      ),
      totals AS (
        SELECT
          COUNT(DISTINCT usuario_id) as total_users
        FROM guide_usuario
        WHERE points > 0
          AND created_at IS NOT NULL
      )
      SELECT
        'After 24h' as cooldown_type,
        COUNT(*) FILTER (WHERE retained_24h) * 100.0 / NULLIF(MAX(totals.total_users), 0) as retention_rate,
        COUNT(*) FILTER (WHERE retained_24h) as users
      FROM user_retention
      CROSS JOIN totals
      GROUP BY 1  -- Aunque solo hay una fila
      UNION ALL
      SELECT
        'After 48h',
        COUNT(*) FILTER (WHERE retained_48h) * 100.0 / NULLIF(MAX(totals.total_users), 0),
        COUNT(*) FILTER (WHERE retained_48h)
      FROM user_retention
      CROSS JOIN totals
      GROUP BY 1
      UNION ALL
      SELECT
        'After 72h',
        COUNT(*) FILTER (WHERE retained_72h) * 100.0 / NULLIF(MAX(totals.total_users), 0),
        COUNT(*) FILTER (WHERE retained_72h)
      FROM user_retention
      CROSS JOIN totals
      GROUP BY 1
      UNION ALL
      SELECT
        'Flexible\n(12-36h)',
        COUNT(*) FILTER (WHERE retained_flexible) * 100.0 / NULLIF(MAX(totals.total_users), 0),
        COUNT(*) FILTER (WHERE retained_flexible)
      FROM user_retention
      CROSS JOIN totals
      GROUP BY 1
      ORDER BY 1
    `.execute(db)

    if (result.rows.length === 0) {
      console.warn('[metrics] No retention data found')
      return []
    }

    return result.rows.map(row => ({
      cooldownType: row.cooldown_type,
      retentionRate: row.retention_rate !== null ? parseFloat(Number(row.retention_rate).toFixed(1)) : 0,
      users: row.users,
    }))
  } catch (error) {
    console.error('[metrics] Error fetching retention by cooldown:', error)
    return []
  }
}


/**
 * Get time distribution between guides
 */
export async function getTimeBetweenGuides(): Promise<TimeBetweenGuidesData[]> {
  try {
    const db = getDb()
    const result = await sql<{
      time_range: string
      users: number
      percentage: number
    }>`
      WITH guide_sequences AS (
        SELECT
          usuario_id,
          created_at,
          LAG(created_at) OVER (PARTITION BY usuario_id ORDER BY created_at) as prev_created_at
        FROM guide_usuario
        WHERE points > 0
          AND created_at IS NOT NULL
      ),
      time_differences AS (
        SELECT
          usuario_id,
          EXTRACT(EPOCH FROM (created_at - prev_created_at)) / 3600 as hours_between
        FROM guide_sequences
        WHERE prev_created_at IS NOT NULL
      ),
      binned AS (
        SELECT
          CASE
            WHEN hours_between < 6 THEN '0-6h'
            WHEN hours_between < 12 THEN '6-12h'
            WHEN hours_between < 18 THEN '12-18h'
            WHEN hours_between < 24 THEN '18-24h'
            WHEN hours_between < 30 THEN '24-30h'
            WHEN hours_between < 36 THEN '30-36h'
            WHEN hours_between < 48 THEN '36-48h'
            ELSE '48h+'
          END as time_range,
          COUNT(DISTINCT usuario_id) as users
        FROM time_differences
        GROUP BY time_range
      ),
      total AS (
        SELECT SUM(users) as total_users FROM binned
      )
      SELECT
        time_range,
        users,
        ROUND(users * 100.0 / NULLIF(total.total_users, 0), 1) as percentage
      FROM binned, total
      ORDER BY
        CASE time_range
          WHEN '0-6h' THEN 1
          WHEN '6-12h' THEN 2
          WHEN '12-18h' THEN 3
          WHEN '18-24h' THEN 4
          WHEN '24-30h' THEN 5
          WHEN '30-36h' THEN 6
          WHEN '36-48h' THEN 7
          ELSE 8
        END
    `.execute(db)

    if (result.rows.length === 0) {
      console.warn('[metrics] No time between guides data found')
      return []
    }

    return result.rows.map(row => ({
      timeRange: row.time_range,
      users: row.users,
      percentage: row.percentage,
    }))
  } catch (error) {
    console.error('[metrics] Error fetching time between guides:', error)
    return []
  }
}


/**
 * Get user growth timeline
 */
export async function getUserGrowth(): Promise<UserGrowthData[]> {
  try {
    const db = getDb()
    const result = await sql<{
      date: string
      new_users: number
      total_users: number
      active_users: number
    }>`
      SELECT
        DATE(COALESCE(u.created_at, u.fechacreacion)) as date,
        COUNT(*) as new_users,
        SUM(COUNT(*)) OVER (ORDER BY DATE(COALESCE(u.created_at, u.fechacreacion))) as total_users,
        COUNT(DISTINCT bu.usuario_id) as active_users
      FROM usuario u
      LEFT JOIN billetera_usuario bu ON u.id = bu.usuario_id
      WHERE COALESCE(u.created_at, u.fechacreacion) IS NOT NULL
      GROUP BY DATE(COALESCE(u.created_at, u.fechacreacion))
      ORDER BY date
    `.execute(db)

    if (result.rows.length === 0) {
      console.warn('[metrics] No user growth data found')
      return []
    }

    return result.rows.map(row => ({
      date: row.date,
      newUsers: row.new_users,
      totalUsers: row.total_users,
      activeUsers: row.active_users,
    }))
  } catch (error) {
    console.error('[metrics] Error fetching user growth:', error)
    return []
  }
}


/**
 * Get game type engagement metrics
 */
export async function getGameEngagement(): Promise<GameEngagementData[]> {
  try {
    const db = getDb()
    const result = await sql<{
      game_type: string
      completion_rate: number
      avg_time: number
      users: number
    }>`
      SELECT
        COALESCE(event_data->>'gameType', event_type) as game_type,
        SUM(CASE WHEN (event_data->>'score')::numeric = 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0) as completion_rate,
        AVG((event_data->>'timeMs')::numeric) / 60000.0 as avg_time,
        COUNT(DISTINCT usuario_id) as users
      FROM userevent
      WHERE event_type = 'game_complete'
        AND usuario_id IS NOT NULL
      GROUP BY COALESCE(event_data->>'gameType', event_type)
      ORDER BY users DESC
    `.execute(db)

    if (result.rows.length === 0) {
      console.warn('[metrics] No game engagement data found')
      return []
    }

    const realData = result.rows.map(row => ({
      gameType: row.game_type,
      completionRate: row.completion_rate !== null ? parseFloat(Number(row.completion_rate).toFixed(1)) : 0,
      avgTime: row.avg_time !== null ? parseFloat(Number(row.avg_time).toFixed(1)) : 0,
      users: row.users,
    }))

    return realData
  } catch (error) {
    console.error('[metrics] Error fetching game engagement:', error)
    return []
  }
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