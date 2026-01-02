'use server'

import { NextRequest, NextResponse } from 'next/server'
import { getAllMetrics } from '@/lib/metrics/queries'

/**
 * Metrics API endpoint
 *
 * Provides aggregated metrics data for the dashboard
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

export async function GET(req: NextRequest) {
  try {
    // Optional: Add authentication/authorization here
    // const session = await getServerSession(authOptions)
    // if (!session) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    // Check for cache headers
    const ifModifiedSince = req.headers.get('If-Modified-Since')
    // For now, we'll always return fresh data

    const metrics = await getAllMetrics()

    const response = NextResponse.json(metrics, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        'Last-Modified': new Date().toUTCString(),
      },
    })

    return response
  } catch (error) {
    console.error('Error fetching metrics:', error)

    const errorMessage = process.env.NODE_ENV === 'development'
      ? String(error)
      : 'Internal server error'

    return NextResponse.json({
      success: false,
      error: errorMessage,
      errorCode: 'INTERNAL_SERVER_ERROR'
    }, {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff'
      }
    })
  }
}

// Optional: Add POST method for tracking events or updating metrics
export async function POST(req: NextRequest) {
  return NextResponse.json(
    { error: 'Method not allowed. Use GET to retrieve metrics.' },
    { status: 405 }
  )
}