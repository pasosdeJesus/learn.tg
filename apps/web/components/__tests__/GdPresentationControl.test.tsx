// @vitest-environment jsdom
import * as React from 'react'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  address: '0xaaa' as string | undefined,
  fetch: vi.fn(),
}))

vi.mock('@/lib/hooks/useAuthAddress', () => ({
  useAuthAddress: () => ({ address: mocks.address }),
}))

import { GdPresentationControl } from '../GdPresentationControl'

const STATUS_INITIATOR = { hasCluster: true, clusterId: 42, isInitiator: true }

const READY = {
  ready: true,
  isInitiator: true,
  request: null,
  missing: [],
}

const NOT_READY = {
  ready: false,
  isInitiator: true,
  request: null,
  missing: ['course_completed', 'profile_score'],
}

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response)
}

/** Responses are consumed in order, one per fetch call. */
function queueFetch(...responses: Promise<Response>[]) {
  const pending = [...responses]
  mocks.fetch.mockImplementation(() => pending.shift() ?? jsonResponse({}))
}

describe('GdPresentationControl (https://github.com/pasosdeJesus/learn.tg/issues/161)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.address = '0xaaa'
    global.fetch = mocks.fetch as unknown as typeof fetch
  })

  afterEach(() => cleanup())

  it('renders nothing without a session', async () => {
    mocks.address = undefined
    const { container } = render(<GdPresentationControl lang="en" />)
    await act(async () => {})
    expect(container).toBeEmptyDOMElement()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('renders nothing for a member who is not the initiator', async () => {
    queueFetch(jsonResponse({ hasCluster: true, clusterId: 42, isInitiator: false }))
    const { container } = render(<GdPresentationControl lang="en" />)
    await act(async () => {})
    expect(container).toBeEmptyDOMElement()
    // No pide la presentación si el que mira no es el iniciador.
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  it('explains the missing conditions and links to the cluster page', async () => {
    queueFetch(jsonResponse(STATUS_INITIATOR), jsonResponse(NOT_READY))
    render(<GdPresentationControl lang="en" />)
    await act(async () => {})

    expect(screen.getByText('Present the cluster to Global Disciples')).toBeInTheDocument()
    expect(screen.getByText(/still has conditions to meet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /see the conditions/i })).toHaveAttribute(
      'href',
      '/en/cluster/42',
    )
    expect(screen.getByRole('checkbox')).toBeDisabled()
    expect(screen.getByRole('button', { name: /send request/i })).toBeDisabled()
  })

  it('keeps the send button disabled until the initiator confirms', async () => {
    queueFetch(jsonResponse(STATUS_INITIATOR), jsonResponse(READY))
    render(<GdPresentationControl lang="en" />)
    await act(async () => {})

    const button = screen.getByRole('button', { name: /send request/i })
    expect(button).toBeDisabled()
    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox'))
    })
    expect(button).toBeEnabled()
  })

  it('requests the presentation and shows the recorded request', async () => {
    queueFetch(
      jsonResponse(STATUS_INITIATOR),
      jsonResponse(READY),
      jsonResponse({ ok: true }),
      jsonResponse(STATUS_INITIATOR),
      jsonResponse({
        ...READY,
        request: {
          requested_at: '2026-10-27T12:00:00Z',
          sent_at: null,
          response: null,
          contact_email: null,
        },
      }),
    )
    render(<GdPresentationControl lang="en" />)
    await act(async () => {})

    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox'))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send request/i }))
    })

    const posts = mocks.fetch.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
    )
    expect(posts).toHaveLength(1)
    expect(posts[0][0]).toBe('/api/cluster/42/gd-presentation')
    expect(JSON.parse(String((posts[0][1] as RequestInit).body))).toEqual({
      walletAddress: '0xaaa',
    })
    expect(screen.getByText(/presentation requested/i)).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('shows the answer and the contact from Global Disciples', async () => {
    queueFetch(
      jsonResponse(STATUS_INITIATOR),
      jsonResponse({
        ...READY,
        request: {
          requested_at: '2026-10-27T12:00:00Z',
          sent_at: '2026-10-28T09:00:00Z',
          response: 'We can meet in November.',
          contact_email: 'gd@example.org',
        },
      }),
    )
    render(<GdPresentationControl lang="es" />)
    await act(async () => {})

    expect(screen.getByText(/pdJ escribió a GD/i)).toBeInTheDocument()
    expect(screen.getByText('We can meet in November.')).toBeInTheDocument()
    expect(screen.getByText('gd@example.org')).toBeInTheDocument()
    expect(screen.getByText(/Correo o canal para continuar/i)).toBeInTheDocument()
  })

  it('reports a failed request and keeps the form available', async () => {
    queueFetch(jsonResponse(STATUS_INITIATOR), jsonResponse(READY), jsonResponse({}, false))
    render(<GdPresentationControl lang="en" />)
    await act(async () => {})

    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox'))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send request/i }))
    })

    expect(screen.getByText(/could not send the request/i)).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(screen.getByRole('button', { name: /send request/i })).toBeEnabled()
  })
})
