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
})
