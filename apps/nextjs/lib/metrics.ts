/**
 * Event tracking system for learn.tg
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

/**
 * Base event type definition
 */
export interface BaseEvent {
  /** Event type identifier */
  event_type: string
  /** Event-specific data */
  event_data?: Record<string, any>
  /** Optional user ID - will be inferred from auth token if not provided */
  usuario_id?: number
  /** Optional timestamp - defaults to now */
  timestamp?: Date
}

/**
 * Known event types for type-safe tracking
 */
export type UserEvent =
  | { event_type: 'guide_view', event_data: { guideId: number, courseId: number, timestamp: string } }
  | { event_type: 'game_start', event_data: { gameType: string, guideId: number } }
  | { event_type: 'game_complete', event_data: { gameType: string, score: number, timeMs: number } }
  | { event_type: 'cooldown_start', event_data: { courseId: number, guideId: number } }
  | { event_type: 'wallet_connect', event_data: { walletAddress: string } }
  | { event_type: 'guide_complete', event_data: { guideId: number, courseId: number, correct: boolean } }
  | { event_type: 'course_start', event_data: { courseId: number } }
  | { event_type: 'course_progress', event_data: { courseId: number, percentage: number } }

/**
 * Authentication parameters for event tracking
 */
export interface AuthParams {
  walletAddress: string
  token: string
}

/**
 * Get authentication parameters from localStorage
 * Returns null if not available
 */
function getAuthFromStorage(): AuthParams | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const walletAddress = localStorage.getItem('walletAddress')
    const token = localStorage.getItem('authToken')

    if (walletAddress && token) {
      return { walletAddress, token }
    }
  } catch (error) {
    // localStorage might be blocked or not available
    if (process.env.NODE_ENV === 'development') {
      console.warn('[metrics] Failed to read auth from storage:', error)
    }
  }

  return null
}

/**
 * Track an event from client-side code
 * Sends event to internal API endpoint for processing
 */
export async function trackEvent(event: UserEvent, auth?: AuthParams): Promise<void> {
  try {
    // In development, log to console
    if (process.env.NODE_ENV === 'development') {
      console.log('[metrics] Tracking event:', event)
    }

    // Prepare request body with authentication
    const body: any = {
      event_type: event.event_type,
      event_data: event.event_data,
    }

    // Add authentication if available
    const authParams = auth || getAuthFromStorage()
    if (authParams) {
      body.walletAddress = authParams.walletAddress
      body.token = authParams.token
    }

    // Send to internal API endpoint
    const response = await fetch('/api/track-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      console.warn('[metrics] Failed to track event:', response.status, response.statusText)
    }
  } catch (error) {
    // Fail silently in production, log in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[metrics] Error tracking event:', error)
    }
  }
}

// recordEvent has been moved to '@/lib/metrics-server' for server-side only usage
// Import it directly in server components/API routes

/**
 * Helper functions for specific event types
 */
export const metrics = {
  /** Track guide view */
  guideView: (guideId: number, courseId: number) =>
    trackEvent({
      event_type: 'guide_view',
      event_data: { guideId, courseId, timestamp: new Date().toISOString() }
    }),

  /** Track game start */
  gameStart: (gameType: string, guideId: number) =>
    trackEvent({
      event_type: 'game_start',
      event_data: { gameType, guideId }
    }),

  /** Track game completion */
  gameComplete: (gameType: string, score: number, timeMs: number) =>
    trackEvent({
      event_type: 'game_complete',
      event_data: { gameType, score, timeMs }
    }),

  /** Track cooldown start */
  cooldownStart: (courseId: number, guideId: number) =>
    trackEvent({
      event_type: 'cooldown_start',
      event_data: { courseId, guideId }
    }),

  /** Track wallet connection */
  walletConnect: (walletAddress: string) =>
    trackEvent({
      event_type: 'wallet_connect',
      event_data: { walletAddress }
    }),

  /** Track guide completion */
  guideComplete: (guideId: number, courseId: number, correct: boolean) =>
    trackEvent({
      event_type: 'guide_complete',
      event_data: { guideId, courseId, correct }
    }),

  /** Track course start */
  courseStart: (courseId: number) =>
    trackEvent({
      event_type: 'course_start',
      event_data: { courseId }
    }),

  /** Track course progress */
  courseProgress: (courseId: number, percentage: number) =>
    trackEvent({
      event_type: 'course_progress',
      event_data: { courseId, percentage }
    }),
}

/**
 * Convenience hook for React components
 */
export function useMetrics() {
  return metrics
}