/**
 * Server-side event recording functions
 *
 * These functions should only be imported and used in server-side code.
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

export interface BaseEvent {
  event_type: string
  event_data?: Record<string, unknown>
  usuario_id?: number | null
  timestamp?: Date
}

/**
 * Record an event directly from server-side code
 * Inserts event into the database
 */
export async function recordEvent(event: BaseEvent): Promise<void> {
  // This function should only be called server-side
  if (typeof window !== 'undefined') {
    throw new Error('recordEvent should only be called server-side')
  }

  const { getDb } = await import('@/db/database')
  const db = getDb()

  const { event_type, event_data, usuario_id } = event
  const timestamp = event.timestamp || new Date()

  try {
    const values: any = {
      event_type,
      event_data: event_data ? JSON.stringify(event_data) : null,
      created_at: timestamp,
    }

    if (usuario_id !== undefined && usuario_id !== null) {
      values.usuario_id = usuario_id
    }

    await db
      .insertInto('userevent')
      .values(values)
      .execute()
  } catch (error) {
    console.error('[metrics] Failed to record event:', error)
    throw error
  }
}
