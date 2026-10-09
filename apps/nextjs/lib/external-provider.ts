'use client'

import { useSyncExternalStore } from 'react'
import {
  externalWalletSource,
  getAnnouncedProviders,
  getExternalProvider,
  getExternalProviderSnapshot,
  resetExternalProviderForTests,
  subscribeExternalProvider,
  type AnnouncedProvider,
  type Eip1193Provider,
  type ExternalProviderSource,
  type ExternalProviderState,
} from '@pasosdejesus/m/wallet'

/**
 * Resolves the injected wallet provider (R-#246, §8 finding 5).
 *
 * The store graduated to `@pasosdejesus/m/wallet` (`m/REQ/14`, Phase 2): several
 * wallet browsers (Rabby, MetaMask, OneKey mobile) only announce through EIP-6963
 * and the announcement can arrive later than the first render, so the shared
 * module listens for the announcements, asks for them, keeps `window.ethereum`
 * as fallback and retries briefly. The choice is sticky for the page session.
 *
 * This file keeps only the React adapter (`useExternalProvider`); the rest is
 * re-exported so the app keeps a single import path.
 */
export {
  externalWalletSource,
  getAnnouncedProviders,
  getExternalProvider,
  resetExternalProviderForTests,
}
export type { AnnouncedProvider, ExternalProviderSource }

/** Stable SSR snapshot (`useSyncExternalStore` needs a cached value). */
const EMPTY: ExternalProviderState = { provider: null, announced: [], source: null, rdns: null }

export function useExternalProvider(): {
  provider: Eip1193Provider | null
  announced: AnnouncedProvider[]
  available: boolean
  /** De dónde salió el proveedor elegido (R-#246 §8). */
  source: ExternalProviderSource
  rdns: string | null
} {
  const snapshot = useSyncExternalStore(
    subscribeExternalProvider,
    getExternalProviderSnapshot,
    () => EMPTY,
  )
  return {
    provider: snapshot.provider,
    announced: snapshot.announced,
    available: snapshot.provider !== null,
    source: snapshot.source,
    rdns: snapshot.rdns,
  }
}
