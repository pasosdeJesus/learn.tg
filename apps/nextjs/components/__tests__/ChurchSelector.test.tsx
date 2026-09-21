import * as React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'

import { ChurchSelector } from '@/components/shared/ChurchSelector'

const WALLET = '0x84272a6dd0d5fe9ea2ab28cf96e72f4f7da00c5c'

const CHURCHES = [
  { id: 1, name: 'Hope Church', city_name: 'Freetown' },
  { id: 2, name: 'Light Church', city_name: 'Bo' },
]

function mockFetchOnce(payload: unknown, ok = true) {
  const fetchMock = vi.fn(async (_url: string) => ({
    ok,
    status: ok ? 200 : 401,
    json: async () => payload,
  }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// Reemplaza la cobertura del E2E `church-selector-diag` (retirado): el selector
// depende de la cookie de sesión para autorizar la consulta misma-origen y del
// `walletAddress` como pista de identidad (R-#233).
describe('ChurchSelector', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('queries the same-origin search with country, city and the wallet hint', async () => {
    localStorage.setItem('learn.tg.sessionAddress', WALLET)
    const fetchMock = mockFetchOnce({ churches: CHURCHES })

    render(
      <ChurchSelector value={null} countryId={694} cityId={7} onChange={vi.fn()} />,
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const url = fetchMock.mock.calls[0][0]
    expect(url).toContain('/api/churches/search?')
    expect(url).toContain('country=694')
    expect(url).toContain('cityId=7')
    expect(url).toContain(`walletAddress=${WALLET}`)

    expect(await screen.findByText('Hope Church — Freetown')).toBeInTheDocument()
    expect(screen.getByText('Light Church — Bo')).toBeInTheDocument()
  })

  it('accepts a bare array response as well', async () => {
    mockFetchOnce(CHURCHES)

    render(<ChurchSelector value={null} countryId={694} cityId={null} onChange={vi.fn()} />)

    expect(await screen.findByText('Hope Church — Freetown')).toBeInTheDocument()
  })

  it('keeps the assigned church visible even when it is not in the list', async () => {
    mockFetchOnce({ churches: CHURCHES })

    render(<ChurchSelector value={99} countryId={694} cityId={7} onChange={vi.fn()} />)

    // Sin nombre conocido cae a `#99`, pero nunca desaparece de las opciones.
    expect(await screen.findByText('#99')).toBeInTheDocument()
  })

  it('hints that the session expired when the list comes back empty', async () => {
    mockFetchOnce({ churches: [] })

    render(<ChurchSelector value={null} countryId={694} cityId={null} lang="es" onChange={vi.fn()} />)

    expect(
      await screen.findByText(/La sesión expiró/),
    ).toBeInTheDocument()
  })

  it('reports a failed load instead of an empty selector', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))

    render(<ChurchSelector value={null} countryId={694} cityId={null} lang="es" onChange={vi.fn()} />)

    expect(await screen.findByText(/No se pudieron cargar las iglesias/)).toBeInTheDocument()
  })

  it('does not query without a country and clears the options', () => {
    const fetchMock = mockFetchOnce({ churches: CHURCHES })

    const { container } = render(
      <ChurchSelector value={null} countryId={null} cityId={null} onChange={vi.fn()} />,
    )

    expect(fetchMock).not.toHaveBeenCalled()
    expect(container.querySelector('select')).toBeDisabled()
    expect(container.querySelectorAll('option')).toHaveLength(1)
  })

  it('offers "+ New church" only when allowed and calls back instead of changing', async () => {
    mockFetchOnce({ churches: CHURCHES })
    const onChange = vi.fn()
    const onNewChurch = vi.fn()

    render(
      <ChurchSelector
        value={null}
        countryId={694}
        cityId={null}
        lang="es"
        onChange={onChange}
        allowNew
        onNewChurch={onNewChurch}
      />,
    )

    const option = await screen.findByText('+ Nueva iglesia')
    expect(option).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})
