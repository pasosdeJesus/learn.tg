'use client'

import { useState } from 'react'
import { useInAppWallet, InAppWalletSetup, InAppWalletUnlock } from '@learn-tg/pdj-wallet-next'
import { ConnectWalletButton } from '@/components/ConnectWalletButton'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'

interface WalletSelectorProps {
  lang?: string
}

const LABELS = {
  en: {
    useInApp: 'Use in-app wallet',
    useExternal: 'Use external wallet',
    unlock: 'Unlock in-app wallet',
    inApp: 'In-app wallet',
    disconnect: 'Disconnect',
  },
  es: {
    useInApp: 'Usar billetera de la aplicación',
    useExternal: 'Usar billetera externa',
    unlock: 'Desbloquear billetera de la aplicación',
    inApp: 'Billetera de la aplicación',
    disconnect: 'Desconectar',
  },
} as const

export function WalletSelector({ lang = 'en' }: WalletSelectorProps) {
  const { status, walletInfo, remove } = useInAppWallet()
  const { address } = useAuthAddress()
  const [mode, setMode] = useState<'choose' | 'in-app'>('choose')
  const [external, setExternal] = useState(false)

  const uiLang: 'en' | 'es' = lang === 'es' ? 'es' : 'en'
  const text = LABELS[uiLang]

  if (external) {
    return <ConnectWalletButton lang={lang} />
  }

  if (status === 'loading') {
    return null
  }

  if (status === 'unlocked') {
    return (
      <div data-testid="wallet-selector-in-app" className="flex items-center gap-2">
        <span className="text-sm">
          {text.inApp}: {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''}
        </span>
        <button type="button" onClick={() => { void remove() }}>
          {text.disconnect}
        </button>
      </div>
    )
  }

  if (status === 'locked') {
    return (
      <div data-testid="wallet-selector-locked">
        <InAppWalletUnlock lang={uiLang} />
      </div>
    )
  }

  if (mode === 'in-app') {
    return (
      <div data-testid="wallet-selector-setup">
        <InAppWalletSetup lang={uiLang} onDone={() => setMode('choose')} />
      </div>
    )
  }

  return (
    <div data-testid="wallet-selector" className="flex flex-col gap-2">
      <button type="button" onClick={() => setMode('in-app')}>
        {text.useInApp}
      </button>
      {typeof window !== 'undefined' && !!window.ethereum && (
        <button type="button" onClick={() => setExternal(true)}>
          {text.useExternal}
        </button>
      )}
      {walletInfo && <span className="text-xs">{text.inApp}: {walletInfo.address.slice(0, 10)}…</span>}
    </div>
  )
}
