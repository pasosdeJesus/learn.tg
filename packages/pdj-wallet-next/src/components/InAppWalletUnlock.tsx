'use client'

import { useState } from 'react'
import { t, type Lang } from '../i18n.js'
import { useInAppWallet } from '../useInAppWallet.js'

export interface InAppWalletUnlockProps {
  lang?: Lang
  onUnlocked?: (address: `0x${string}`) => void
}

export function InAppWalletUnlock({ lang = 'en', onUnlocked }: InAppWalletUnlockProps) {
  const { unlock } = useInAppWallet()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const info = await unlock(pin)
      onUnlocked?.(info.address)
    } catch {
      setError(t(lang, 'wrongPin'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} data-testid="in-app-wallet-unlock">
      <h2>{t(lang, 'unlockTitle')}</h2>
      <label>
        {t(lang, 'pin')}
        <input
          type="password"
          inputMode="numeric"
          aria-label={t(lang, 'pin')}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={busy}>
        {t(lang, 'unlock')}
      </button>
    </form>
  )
}
