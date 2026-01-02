'use server'

import { NextRequest, NextResponse } from 'next/server'
import { newKyselyPostgresql } from '@/.config/kysely.config'
import type { Insertable } from 'kysely'
import type { Userevent } from '@/db/db.d.ts'

/**
 * Track event API endpoint
 *
 * Accepts events from client-side and records them in the userevent table
 * Requires authentication via wallet token for user-associated events
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

export async function GET(req: NextRequest) {
  return NextResponse.json({ error: 'Expecting POST request' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  try {
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

    const db = newKyselyPostgresql()
    let usuario_id: number | null = null

    // If authentication provided, validate and get usuario_id
    if (walletAddress && token) {
      const billeteraUsuario = await db
        .selectFrom('billetera_usuario')
        .where('billetera', '=', walletAddress)
        .selectAll()
        .executeTakeFirst()

      if (!billeteraUsuario) {
        return NextResponse.json(
          { error: 'User not found for wallet' },
          { status: 404 }
        )
      }

      if (billeteraUsuario.token !== token) {
        return NextResponse.json(
          { error: 'Token mismatch' },
          { status: 401 }
        )
      }

      usuario_id = billeteraUsuario.usuario_id
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