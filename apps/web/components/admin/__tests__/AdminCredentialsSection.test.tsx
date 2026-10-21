// @vitest-environment jsdom
import * as React from 'react'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  adminFetch: vi.fn(),
}))

vi.mock('@/lib/admin-fetch', () => ({
  adminFetch: (...args: unknown[]) => mocks.adminFetch(...args),
  adminAuthParams: () => '',
}))

import { AdminCredentialsSection } from '../AdminCredentialsSection'

const FIRST = '0x1111111111111111111111111111111111111111'
const SECOND = '0x2222222222222222222222222222222222222222'
const WALLETS = [
  { id: 1, billetera: FIRST },
  { id: 2, billetera: SECOND },
]

describe('AdminCredentialsSection (R-#265 §3.7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.adminFetch.mockResolvedValue({ success: true, txHash: '0xabc' })
  })
  afterEach(() => cleanup())

  it('revokes the credential of the wallet that holds it', async () => {
    render(
      <AdminCredentialsSection
        lang="en"
        userId={7}
        wallets={WALLETS}
        credentials={[
          { token_id: 12, course_id: 2, course_name: 'Course', billetera: FIRST, revoked_at: null },
        ]}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByTestId('admin-credential-revoke-12'))
    })

    expect(mocks.adminFetch).toHaveBeenCalledWith(
      '/api/admin/credentials/revoke',
      expect.objectContaining({ method: 'POST' }),
    )
    const body = JSON.parse(
      String((mocks.adminFetch.mock.calls[0][1] as RequestInit).body),
    )
    expect(body).toEqual({ userId: 7, tokenId: 12, wallet: FIRST })
    expect(screen.getByTestId('admin-credentials-message')).toHaveTextContent(/revoked/i)
    expect(screen.queryByTestId('admin-credential-revoke-12')).not.toBeInTheDocument()
  })

  it('re-mints a revoked credential to another wallet of the account', async () => {
    render(
      <AdminCredentialsSection
        lang="en"
        userId={7}
        wallets={WALLETS}
        credentials={[
          {
            token_id: 12,
            course_id: 2,
            course_name: 'Course',
            billetera: FIRST,
            revoked_at: '2026-10-16T00:00:00Z',
          },
        ]}
      />,
    )

    await act(async () => {
      fireEvent.change(screen.getByTestId('admin-credential-target-12'), {
        target: { value: SECOND },
      })
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('admin-credential-remint-12'))
    })

    expect(mocks.adminFetch).toHaveBeenCalledWith(
      '/api/admin/credentials/re-mint',
      expect.objectContaining({ method: 'POST' }),
    )
    const body = JSON.parse(
      String((mocks.adminFetch.mock.calls[0][1] as RequestInit).body),
    )
    expect(body).toEqual({ userId: 7, courseId: 2, wallet: SECOND })
    expect(screen.getByTestId('admin-credentials-message')).toHaveTextContent(/re-minted/i)
    expect(screen.queryByTestId('admin-credential-target-12')).not.toBeInTheDocument()
  })

  it('shows the error when the revoke fails', async () => {
    mocks.adminFetch.mockRejectedValue(new Error('Access denied'))
    render(
      <AdminCredentialsSection
        lang="es"
        userId={7}
        wallets={WALLETS}
        credentials={[{ token_id: 3, course_id: 1, billetera: FIRST, revoked_at: null }]}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByTestId('admin-credential-revoke-3'))
    })

    expect(screen.getByTestId('admin-credentials-message')).toHaveTextContent(/Access denied/i)
  })
})
