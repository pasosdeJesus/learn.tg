'use server'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db/database'
import { sql } from 'kysely'

/**
 * Health check endpoint for metrics system
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

export async function GET(req: NextRequest) {
  const checks = {
    database: await checkDbConnection(),
    eventsTable: await checkEventsTable(),
    recentActivity: await checkRecentActivity(),
    dataFreshness: await checkDataFreshness()
  }

  const allHealthy = Object.values(checks).every(v => v.healthy)
  return NextResponse.json({
    status: allHealthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString()
  })
}

// Helper functions
async function checkDbConnection() {
  try {
    const db = getDb()
    await db.selectFrom('userevent').select(sql`1`.as('one')).limit(1).execute()
    return { healthy: true, message: 'Database connection OK' }
  } catch (error) {
    return { healthy: false, message: `Database error: ${error.message}` }
  }
}

async function checkEventsTable() {
  try {
    const db = getDb()
    const count = await db.selectFrom('userevent').select(sql`COUNT(*)`.as('count')).executeTakeFirst()
    return {
      healthy: true,
      message: `Events table OK (${count?.count || 0} events)`
    }
  } catch (error) {
    return { healthy: false, message: `Events table error: ${error.message}` }
  }
}

async function checkRecentActivity() {
  try {
    const db = getDb()
    const recent = await db
      .selectFrom('userevent')
      .select('created_at')
      .orderBy('created_at', 'desc')
      .limit(1)
      .executeTakeFirst()

    const hoursAgo = recent ?
      (Date.now() - new Date(recent.created_at).getTime()) / (1000 * 60 * 60) :
      null

    return {
      healthy: hoursAgo !== null && hoursAgo < 24,
      message: recent ?
        `Last event ${hoursAgo.toFixed(1)} hours ago` :
        'No recent events'
    }
  } catch (error) {
    return { healthy: false, message: `Recent activity check error: ${error.message}` }
  }
}

async function checkDataFreshness() {
  try {
    const db = getDb()
    const lastUpdate = await db
      .selectFrom('guide_usuario')
      .select(sql`MAX(updated_at)`.as('last_updated'))
      .executeTakeFirst()

    const hoursAgo = lastUpdate?.last_updated ?
      (Date.now() - new Date(lastUpdate.last_updated).getTime()) / (1000 * 60 * 60) :
      null

    return {
      healthy: hoursAgo !== null && hoursAgo < 24,
      message: lastUpdate ?
        `Data updated ${hoursAgo.toFixed(1)} hours ago` :
        'No data freshness info'
    }
  } catch (error) {
    return { healthy: false, message: `Data freshness check error: ${error.message}` }
  }
}

// Optional: Add POST method for manual health checks
export async function POST(req: NextRequest) {
  return NextResponse.json(
    { error: 'Method not allowed. Use GET for health checks.' },
    { status: 405 }
  )
}