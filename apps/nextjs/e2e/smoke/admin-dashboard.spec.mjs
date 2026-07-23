// E2E Smoke: Admin dashboard access control and endpoints

import axios from 'axios'
import { describe, it, expect } from 'vitest'

const SITE = process.env.SITE_URL || 'https://learn.tg:9001'

describe('Admin Dashboard E2E', () => {
  it('GET /en/admin returns 200 (page loads for anyone, access check client-side)', async () => {
    const res = await axios.get(`${SITE}/en/admin`, {
      validateStatus: () => true,
    })
    expect(res.status).toBe(200)
  })

  it('GET /api/admin/users returns user list', async () => {
    const res = await axios.get(`${SITE}/api/admin/users`, {
      validateStatus: () => true,
    })
    expect(res.status).toBe(200)
    expect(res.data.users).toBeDefined()
  })

  it('GET /api/admin/users?status=pending returns pending', async () => {
    const res = await axios.get(`${SITE}/api/admin/users?status=pending`, {
      validateStatus: () => true,
    })
    expect(res.status).toBe(200)
  })

  it('GET /api/admin/users/recent returns recent', async () => {
    const res = await axios.get(`${SITE}/api/admin/users/recent`, {
      validateStatus: () => true,
    })
    expect(res.status).toBe(200)
  })

  it('GET /api/admin/churches returns church list', async () => {
    const res = await axios.get(`${SITE}/api/admin/churches`, {
      validateStatus: () => true,
    })
    expect(res.status).toBe(200)
    expect(res.data.churches).toBeDefined()
  })

  it('GET /api/admin/churches/recent returns recent', async () => {
    const res = await axios.get(`${SITE}/api/admin/churches/recent`, {
      validateStatus: () => true,
    })
    expect(res.status).toBe(200)
  })

  it('GET /api/admin/calendar/events returns events', async () => {
    const res = await axios.get(`${SITE}/api/admin/calendar/events`, {
      validateStatus: () => true,
    })
    // May be 200 or 500 if CalDAV not configured
    expect([200, 500]).toContain(res.status)
  })

  it('GET /api/admin/user/1 returns user or 404', async () => {
    const res = await axios.get(`${SITE}/api/admin/user/1`, {
      validateStatus: () => true,
    })
    expect([200, 404]).toContain(res.status)
  })

  it('GET /api/admin/church/1 returns church or 404', async () => {
    const res = await axios.get(`${SITE}/api/admin/church/1`, {
      validateStatus: () => true,
    })
    expect([200, 404]).toContain(res.status)
  })

  it('GET /api/admin/pastor-bonus returns pastors', async () => {
    const res = await axios.get(`${SITE}/api/admin/pastor-bonus`, {
      validateStatus: () => true,
    })
    expect(res.status).toBe(200)
  })
})
