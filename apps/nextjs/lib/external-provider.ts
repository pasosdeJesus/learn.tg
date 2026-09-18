'use client'

import { useSyncExternalStore } from 'react'
import type { Eip1193Provider } from '@learn-tg/pdj-wallet'

/**
 * Resolves the injected wallet provider (R-#246, §8 finding 5).
 *
 * Background: the app used to read `window.ethereum` in nine places, but several
 * wallet browsers do not define it at page load — Rabby, MetaMask and OneKey
 * mobile only announce through **EIP-6963** (`eip6963:announceProvider`), and the
 * announcement can arrive a bit later than the first render. Depending on that
 * timing left the "Use external wallet" option hidden until a reload and left
 * `WalletEventListener` unattached.
 *
 * This module listens for the announcements, asks for them
 * (`eip6963:requestProvider`), keeps `window.ethereum` as fallback and retries
 * briefly (plus once on the first user interaction) so a late injection is still
 * seen. The choice is **sticky** for the page session: switching provider identity
 * mid-flight would invalidate the viem clients built on top of it.
 */
export interface AnnouncedProvider {
  uuid: string
  name: string
  rdns: string
  icon?: string
  provider: Eip1193Provider
}

export interface ExternalProviderState {
  provider: Eip1193Provider | null
  announced: AnnouncedProvider[]
}

const EMPTY: ExternalProviderState = { provider: null, announced: [] }

let state: ExternalProviderState = EMPTY
let started = false
const listeners = new Set<() => void>()

function emit(partial: Partial<ExternalProviderState>): void {
  state = { ...state, ...partial }
  for (const listener of listeners) listener()
}

function injected(): Eip1193Provider | null {
  if (typeof window === 'undefined') return null
  return (window as { ethereum?: Eip1193Provider }).ethereum ?? null
}

/** Sticky choice: `window.ethereum` when it exists, otherwise the announcement. */
function choose(): void {
  if (state.provider) return
  const direct = injected()
  if (direct) {
    emit({ provider: direct })
    return
  }
  if (state.announced[0]) emit({ provider: state.announced[0].provider })
}

function start(): void {
  if (started || typeof window === 'undefined') return
  started = true

  window.addEventListener('eip6963:announceProvider', (event) => {
    const detail = (event as CustomEvent<{
      info?: { uuid?: string; name?: string; rdns?: string; icon?: string }
      provider?: Eip1193Provider
    }>).detail
    if (!detail?.provider) return
    const rdns = detail.info?.rdns ?? detail.info?.name ?? 'unknown'
    const announced = [
      ...state.announced.filter((item) => item.rdns !== rdns),
      {
        uuid: detail.info?.uuid ?? rdns,
        name: detail.info?.name ?? rdns,
        rdns,
        icon: detail.info?.icon,
        provider: detail.provider,
      },
    ]
    emit({ announced })
    choose()
  })

  window.addEventListener('ethereum#initialized', choose)
  window.dispatchEvent(new Event('eip6963:requestProvider'))

  // Algunas WebViews inyectan tarde: reintentar un rato y una vez al primer gesto.
  let attempts = 0
  const timer = window.setInterval(() => {
    attempts += 1
    choose()
    if (attempts >= 8) window.clearInterval(timer)
  }, 400)
  for (const eventName of ['pointerdown', 'keydown', 'focus', 'visibilitychange']) {
    window.addEventListener(eventName, choose, { once: true })
  }
}

function subscribe(listener: () => void): () => void {
  start()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): ExternalProviderState {
  start()
  choose()
  return state
}

function getServerSnapshot(): ExternalProviderState {
  return EMPTY
}

/** Effective injected provider, or `null` (also callable outside React). */
export function getExternalProvider(): Eip1193Provider | null {
  start()
  choose()
  return state.provider
}

export function getAnnouncedProviders(): AnnouncedProvider[] {
  start()
  return state.announced
}

/** Test-only: forgets the listeners and the chosen provider. */
export function resetExternalProviderForTests(): void {
  state = EMPTY
  started = false
  listeners.clear()
}

export function useExternalProvider(): {
  provider: Eip1193Provider | null
  announced: AnnouncedProvider[]
  available: boolean
} {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return {
    provider: snapshot.provider,
    announced: snapshot.announced,
    available: snapshot.provider !== null,
  }
}
