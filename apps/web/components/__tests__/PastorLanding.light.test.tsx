import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import axios from 'axios'
import { PastorLanding } from '../PastorLanding'

// R-#283: the neutral pastor landing. It must NOT announce the Global Disciples
// course, the "non-Zionist" condition, nor the old "Country and cluster
// ranking" card.

vi.mock('axios')

vi.mock('@/lib/hooks/useAuthAddress', () => ({
  useAuthAddress: () => ({
    address: '0xabc0000000000000000000000000000000000000',
    isAuthenticated: true,
    isWalletAvailable: true,
    isWalletCheckComplete: true,
  }),
}))

const mockedAxiosGet = axios.get as unknown as ReturnType<typeof vi.fn>

const VERIFIED_PASTOR = {
  id: 1,
  church_relationship: 'pastor',
  verified_church_relationship: 'pastor',
  registration: 'grace-church',
}

describe('PastorLanding (light)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedAxiosGet.mockImplementation((url: string) => {
      if (url === '/api/churches/fund') {
        return Promise.resolve({ data: { slearnBalance: '220' } })
      }
      if (url.startsWith('/api/profile')) {
        return Promise.resolve({ data: VERIFIED_PASTOR })
      }
      if (url.startsWith('/api/user-transactions')) {
        return Promise.resolve({ data: { transactions: [] } })
      }
      return Promise.resolve({ data: {} })
    })
  })

  it('renders in English without GD, zionist or ranking mentions', async () => {
    render(<PastorLanding lang="en" />)
    expect(screen.getByText('Welcome, pastor')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/220 SLEARN/)).toBeInTheDocument())

    const body = document.body.textContent || ''
    expect(body).not.toMatch(/Global Disciples/i)
    expect(body).not.toMatch(/zionist/i)
    expect(body).not.toMatch(/Country and cluster ranking/i)
  })

  it('renders in Spanish', () => {
    render(<PastorLanding lang="es" />)
    expect(screen.getByText('Bienvenido, pastor')).toBeInTheDocument()
  })

  it('lists the requirements a verified pastor meets', async () => {
    render(<PastorLanding lang="en" />)
    await waitFor(() => expect(screen.getByText('Be a pastor')).toBeInTheDocument())
    expect(
      screen.getByText('Have a verifier confirm your role and your church registration'),
    ).toBeInTheDocument()
  })
})
