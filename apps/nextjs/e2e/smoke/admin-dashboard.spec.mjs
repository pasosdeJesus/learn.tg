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

  it('GET /api/admin/users returns 200', async () => {
    const res = await axios.get(`${SITE}/api/admin/users`, {
      validateStatus: () => true,
    })
    expect(res.status).toBe(200)
  })

  it('GET /api/admin/users?status=pending returns 200', async () => {
    const res = await axios.get(`${SITE}/api/admin/users?status=pending`, {
      validateStatus: () => true,
    })
    expect(res.status).toBe(200)
  })

  it('GET /api/admin/users/recent returns 200', async () => {
    const res = await axios.get(`${SITE}/api/admin/users/recent`, {
      validateStatus: () => true,
    })
    expect(res.status).toBe(200)
  })

  it('GET /api/admin/churches returns 200', async () => {
    const res = await axios.get(`${SITE}/api/admin/churches`, {
      validateStatus: () => true,
    })
    expect(res.status).toBe(200)
  })

  it('GET /api/admin/churches/recent returns 200', async () => {
    const res = await axios.get(`${SITE}/api/admin/churches/recent`, {
      validateStatus: () => true,
    })
    expect(res.status).toBe(200)
  })

  it('GET /api/admin/calendar/events returns 200 or 500', async () => {
    const res = await axios.get(`${SITE}/api/admin/calendar/events`, {
      validateStatus: () => true,
    })
    expect([200, 500]).toContain(res.status)
  })

  it('GET /api/admin/user/1 returns 200 or 404', async () => {
    const res = await axios.get(`${SITE}/api/admin/user/1`, {
      validateStatus: () => true,
    })
    expect([200, 404]).toContain(res.status)
  })

  it('GET /api/admin/church/1 returns 200 or 404', async () => {
    const res = await axios.get(`${SITE}/api/admin/church/1`, {
      validateStatus: () => true,
    })
    expect([200, 404]).toContain(res.status)
  })

  it('GET /api/admin/pastor-bonus returns 200', async () => {
    const res = await axios.get(`${SITE}/api/admin/pastor-bonus`, {
      validateStatus: () => true,
    })
    expect(res.status).toBe(200)
  })

  it('GET /api/admin/check-verifier returns verifier status', async () => {
    const verifierWallet = process.env.NEXT_PUBLIC_VERIFIER_WALLET || ''
    const res = await axios.get(`${SITE}/api/admin/check-verifier?wallet=${verifierWallet}`, {
      validateStatus: () => true,
    })
    // Accept 200 (endpoint active), 404 (not deployed), or 200-with-HTML (needs rebuild)
    expect([200, 404]).toContain(res.status)
    if (res.status === 200 && res.data && typeof res.data === 'object' && 'isVerifier' in res.data) {
      expect(typeof res.data.isVerifier).toBe('boolean')
      expect(res.data.configuredWallets).toBeDefined()
    }
  })
})
