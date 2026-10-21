// @vitest-environment jsdom
import * as React from 'react'
import { render, screen, act, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { InstallPrompt } from '../InstallPrompt'

function makeInstallEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: string }>
  }
  event.prompt = vi.fn(async () => undefined)
  event.userChoice = Promise.resolve({ outcome })
  return event
}

describe('InstallPrompt (R-#243)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders nothing when the browser has not offered an install', () => {
    const { container } = render(<InstallPrompt lang="en" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the banner when the app is installable', async () => {
    render(<InstallPrompt lang="en" />)
    await act(async () => {
      window.dispatchEvent(makeInstallEvent())
    })
    expect(screen.getByTestId('install-prompt')).toHaveTextContent(/install Learn\.tg/i)
  })

  it('is bilingual', async () => {
    render(<InstallPrompt lang="es" />)
    await act(async () => {
      window.dispatchEvent(makeInstallEvent())
    })
    expect(screen.getByTestId('install-prompt')).toHaveTextContent(/pantalla de inicio/i)
  })

  it('calls prompt() and hides when the user accepts', async () => {
    render(<InstallPrompt lang="en" />)
    const event = makeInstallEvent('accepted')
    await act(async () => {
      window.dispatchEvent(event)
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('install-accept'))
    })

    expect(event.prompt).toHaveBeenCalled()
    expect(screen.queryByTestId('install-prompt')).not.toBeInTheDocument()
  })

  it('remembers a dismissal so the banner does not come back', async () => {
    const first = render(<InstallPrompt lang="en" />)
    await act(async () => {
      window.dispatchEvent(makeInstallEvent())
    })
    fireEvent.click(screen.getByTestId('install-dismiss'))
    first.unmount()

    render(<InstallPrompt lang="en" />)
    expect(screen.queryByTestId('install-prompt')).not.toBeInTheDocument()
  })

  // iPhone: Safari no dispara `beforeinstallprompt`, así que sin instrucciones el
  // estudiante no ve nunca cómo instalar (reporte del operador, 2026-09-23).
  describe('iOS/Safari', () => {
    const original = navigator.userAgent

    function setUserAgent(value: string) {
      Object.defineProperty(navigator, 'userAgent', { value, configurable: true })
    }

    beforeEach(() => {
      Object.defineProperty(document, 'ontouchend', { value: null, configurable: true })
    })

    it('gives the Share instructions on Safari for iPhone', async () => {
      setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')

      render(<InstallPrompt lang="en" />)

      const banner = await screen.findByTestId('install-prompt')
      expect(banner).toHaveTextContent(/Add to Home Screen/i)
      // No hay evento que disparar: no se ofrece un botón "Install" inútil.
      expect(screen.queryByTestId('install-accept')).not.toBeInTheDocument()
      expect(screen.getByTestId('install-dismiss')).toBeInTheDocument()
    })

    it('stays silent on Chrome for iOS (no Add to Home Screen there)', async () => {
      setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) CriOS/120.0 Mobile/15E148 Safari/604.1')

      const { container } = render(<InstallPrompt lang="en" />)

      await act(async () => {})
      expect(container).toBeEmptyDOMElement()
    })

    it('stays silent when the app already runs installed (standalone)', async () => {
      setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')
      Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })

      const { container } = render(<InstallPrompt lang="en" />)

      await act(async () => {})
      expect(container).toBeEmptyDOMElement()

      setUserAgent(original)
      Object.defineProperty(navigator, 'standalone', { value: undefined, configurable: true })
    })
  })
})
