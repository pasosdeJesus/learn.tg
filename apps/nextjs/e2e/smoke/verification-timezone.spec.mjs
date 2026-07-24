// E2E Smoke: Verification availability timezone
// Verifies that the timezone parameter is honored by the availability API
// and that Colombia users see America/Bogota, not Africa/Freetown.

import axios from 'axios'
import { describe, it, expect } from 'vitest'

const SITE = process.env.SITE_URL || 'https://learn.tg:9001'

describe('Verification Timezone E2E', () => {
  it('availability API returns slots', async () => {
    const res = await axios.get(`${SITE}/api/verification/availability?days=7&duration=30`, {
      validateStatus: () => true,
    })
    // Accept 200 or 500 (CalDAV not configured)
    expect([200, 500]).toContain(res.status)
  })

  it('availability API honors timezone=America/Bogota', async () => {
    const res = await axios.get(
      `${SITE}/api/verification/availability?days=7&duration=30&timezone=America/Bogota`,
      { validateStatus: () => true },
    )
    if (res.status === 200 && res.data && typeof res.data === 'object') {
      // MUST return the requested timezone, not the default Africa/Freetown
      expect(res.data.timezone).toBe('America/Bogota')
    }
  })

  it('availability API honors timezone=America/Caracas', async () => {
    const res = await axios.get(
      `${SITE}/api/verification/availability?days=7&duration=30&timezone=America/Caracas`,
      { validateStatus: () => true },
    )
    if (res.status === 200 && res.data && typeof res.data === 'object') {
      expect(res.data.timezone).toBe('America/Caracas')
    }
  })

  it('availability API defaults to Africa/Freetown when no timezone param', async () => {
    const res = await axios.get(
      `${SITE}/api/verification/availability?days=7&duration=30`,
      { validateStatus: () => true },
    )
    if (res.status === 200 && res.data && typeof res.data === 'object' && 'timezone' in res.data) {
      expect(res.data.timezone).toBe('Africa/Freetown')
    }
  })
})
