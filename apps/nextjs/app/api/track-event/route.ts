'use server'

import { NextRequest, NextResponse } from 'next/server'
import { newKyselyPostgresql } from '@/.config/kysely.config'
import { sql, type Insertable } from 'kysely'
import type { Userevent } from '@/db/db.d.ts'

/**
 * Track event API endpoint
 *
 * Accepts events from client-side and records them in the userevent table
 * Requires authentication via wallet token for user-associated events
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

// Rate limiting configuration - prevents abuse while allowing normal user flows
const rateLimit = new Map<string, { count: number, resetTime: number }>()
const MAX_REQUESTS_PER_MINUTE = 60 // 1 request/second average - sufficient for normal guide → crossword → event flow
const WINDOW_MS = 60 * 1000 // 1 minute window

/**
 * Simple in-memory rate limiting
 * Uses walletAddress when available, falls back to IP for anonymous events
 * Returns true if request is allowed, false if rate limited
 */
function checkRateLimit(identifier: string): boolean {
  const now = Date.now()
  const window = rateLimit.get(identifier)

  // New identifier or window expired
  if (!window || window.resetTime <= now) {
    rateLimit.set(identifier, { count: 1, resetTime: now + WINDOW_MS })
    return true
  }

  // Check if over limit
  if (window.count >= MAX_REQUESTS_PER_MINUTE) {
    return false
  }

  // Increment count for existing window
  window.count++
  return true
}

/**
 * Clean up old rate limit entries periodically
 * Simple approach: clean ~1% of requests to avoid memory leak
 */
function cleanupOldRateLimits() {
  if (Math.random() < 0.01) { // ~1% of requests trigger cleanup
    const now = Date.now()
    for (const [key, value] of rateLimit.entries()) {
      if (value.resetTime <= now) {
        rateLimit.delete(key)
      }
    }
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ error: 'Expecting POST request' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  try {
    // Clean up old rate limit entries periodically
    cleanupOldRateLimits()

    const requestJson = await req.json()

    // Required fields
    const event_type = requestJson['event_type']
    const event_data = requestJson['event_data'] || {}

    // Authentication fields (optional for anonymous events)
    const walletAddress = requestJson['walletAddress']
    const token = requestJson['token']

    // Validation
    if (!event_type || typeof event_type !== 'string') {
      return NextResponse.json(
        { error: 'Invalid event_type' },
        { status: 400 }
      )
    }

    if (event_type.length > 30) {
      return NextResponse.json(
        { error: 'event_type too long (max 30 characters)' },
        { status: 400 }
      )
    }

    // Validate event_data is an object if provided
    if (event_data && (typeof event_data !== 'object' || Array.isArray(event_data))) {
      return NextResponse.json(
        { error: 'event_data must be an object' },
        { status: 400 }
      )
    }

    // Log all incoming events for debugging
    console.log('[metrics/track-event] Request received:', {
      event_type,
      hasWalletAddress: !!walletAddress,
      hasToken: !!token,
      walletAddress: walletAddress ? walletAddress.slice(0, 10) + '...' : 'none',
      tokenLength: token ? token.length : 0,
      timestamp: new Date().toISOString()
    })

    // Apply rate limiting - use walletAddress when available, fallback to IP for anonymous events
    // This prevents abuse while allowing normal user flows (guide → crossword → event)
    const identifier = walletAddress || 'unknown'
    if (!checkRateLimit(identifier)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    const db = newKyselyPostgresql()
    let usuario_id: number | null = null

    // If authentication provided, validate and get usuario_id
    if (walletAddress && token) {
      // Debug logging for authentication parameters
      console.log('[metrics/track-event] Auth attempt:', {
        walletAddress,
        tokenLength: token.length,
        tokenStart: token.slice(0, 10) + '...',
        timestamp: new Date().toISOString()
      })

      const billeteraUsuario = await db
        .selectFrom('billetera_usuario')
        .where(sql`LOWER(billetera)`, '=', walletAddress.toLowerCase())
        .selectAll()
        .executeTakeFirst()

      // Debug logging for query result
      console.log('[metrics/track-event] Query result:', {
        foundUser: !!billeteraUsuario,
        usuario_id: billeteraUsuario?.usuario_id,
        storedTokenStart: billeteraUsuario?.token ? billeteraUsuario.token.slice(0, 10) + '...' : 'none',
        storedWallet: billeteraUsuario?.billetera
      })

      if (!billeteraUsuario) {
        console.log('[metrics/track-event] User not found for wallet:', walletAddress)
        return NextResponse.json(
          { error: 'User not found for wallet' },
          { status: 404 }
        )
      }

      if (!billeteraUsuario.token || billeteraUsuario.token !== token) {
        console.log('[metrics/track-event] Token mismatch:', {
          storedTokenStart: billeteraUsuario.token?.slice(0, 10) + '...',
          receivedTokenStart: token.slice(0, 10) + '...',
          fullMatch: billeteraUsuario.token === token,
          tokenIsNull: !billeteraUsuario.token
        })
        return NextResponse.json(
          { error: 'Token mismatch' },
          { status: 401 }
        )
      }

      console.log('[metrics/track-event] Authentication successful:', {
        usuario_id: billeteraUsuario.usuario_id,
        walletAddress,
        event_type
      })

      usuario_id = billeteraUsuario.usuario_id
    } else {
      console.log('[metrics/track-event] No authentication provided:', {
        walletAddress: !!walletAddress,
        token: !!token,
        event_type,
        hasWalletAddress: !!walletAddress,
        hasToken: !!token
      })
    }

    // Prepare event for insertion
    const event: any = {
      event_type,
      event_data: Object.keys(event_data).length > 0 ? JSON.stringify(event_data) : null,
      created_at: new Date(),
    }

    // Only include usuario_id if available
    if (usuario_id !== null) {
      event.usuario_id = usuario_id
    }

    // Insert event
    const inserted = await db
      .insertInto('userevent')
      .values(event)
      .returningAll()
      .executeTakeFirst()

    // Always log event insertion for debugging
    console.log('[metrics/track-event] Event inserted:', {
      id: inserted?.id,
      event_type,
      usuario_id,
      has_usuario_id: usuario_id !== null
    })

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[metrics] Event recorded:', {
        id: inserted?.id,
        event_type,
        usuario_id,
        event_data,
      })
    }

    return NextResponse.json({
      success: true,
      eventId: inserted?.id,
      message: 'Event tracked successfully'
    }, { status: 200 })

  } catch (error) {
    console.error('Error in track-event endpoint:', error)

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