'use client'

import { useState } from 'react'
import { isValidPassword } from '@learn-tg/pdj-wallet'
import { t, type Lang } from '../i18n.js'
import { useInAppWallet } from '../useInAppWallet.js'

export interface InAppWalletSetupProps {
  lang?: Lang
  onDone?: (address: `0x${string}`) => void
}

export function InAppWalletSetup({ lang = 'en', onDone }: InAppWalletSetupProps) {
  const { create, importExisting, error } = useInAppWallet()
  const [mode, setMode] = useState<'create' | 'import'>('create')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [mnemonic, setMnemonic] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [recoveryPhrase, setRecoveryPhrase] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLocalError(null)
    if (!isValidPassword(password)) {
      setLocalError(t(lang, 'passwordTooShort'))
      return
    }
    if (password !== confirm) {
      setLocalError(t(lang, 'passwordMismatch'))
      return
    }
    setBusy(true)
    try {
      if (mode === 'create') {
        const result = await create(password)
        setRecoveryPhrase(result.mnemonic)
        onDone?.(result.walletInfo.address)
      } else {
        const info = await importExisting({
          password,
          mnemonic: mnemonic.trim() ? mnemonic : undefined,
          privateKey: privateKey.trim() ? (privateKey.trim() as `0x${string}`) : undefined,
        })
        onDone?.(info.address)
      }
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const message = localError ?? error

  return (
    <form onSubmit={handleSubmit} data-testid="in-app-wallet-setup">
      <h2>{mode === 'create' ? t(lang, 'createTitle') : t(lang, 'importTitle')}</h2>

      <div role="group">
        <button type="button" data-testid="mode-create" onClick={() => setMode('create')} aria-pressed={mode === 'create'}>
          {t(lang, 'create')}
        </button>
        <button type="button" data-testid="mode-import" onClick={() => setMode('import')} aria-pressed={mode === 'import'}>
          {t(lang, 'import')}
        </button>
      </div>

      {mode === 'import' && (
        <>
          <label>
            {t(lang, 'mnemonic')}
            <textarea
              aria-label={t(lang, 'mnemonic')}
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
            />
          </label>
          <label>
            {t(lang, 'privateKey')}
            <input
              aria-label={t(lang, 'privateKey')}
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
            />
          </label>
        </>
      )}

      <label>
        {t(lang, 'password')}
        <input
          type="password"
          inputMode="text"
          aria-label={t(lang, 'password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      <label>
        {t(lang, 'passwordConfirm')}
        <input
          type="password"
          inputMode="text"
          aria-label={t(lang, 'passwordConfirm')}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>

      <p data-testid="recovery-warning">{t(lang, 'warning')}</p>

      {recoveryPhrase && (
        <div data-testid="recovery-phrase">
          <p>{recoveryPhrase}</p>
          <button type="button" onClick={() => navigator.clipboard?.writeText(recoveryPhrase)}>
            {t(lang, 'copy')}
          </button>
        </div>
      )}

      {message && <p role="alert">{message}</p>}

      <button type="submit" data-testid="submit" disabled={busy}>
        {mode === 'create' ? t(lang, 'create') : t(lang, 'import')}
      </button>
    </form>
  )
}
