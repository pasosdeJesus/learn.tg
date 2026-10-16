'use client'

import { useState } from 'react'
import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import { useInAppWallet } from '@pasosdejesus/m/wallet/next'
import { getExternalProvider } from '@/lib/external-provider'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { getRpcUrl } from '@/lib/rpc-url'
import { detectActiveWalletSigner, linkActiveWallet } from '@/lib/wallet-link'

interface LinkWalletButtonProps {
  lang?: string
  /** Se dispara con un enlace exitoso, para refrescar la lista de billeteras. */
  onLinked?: () => void
}

/**
 * "Vincular billetera activa" (R-#265 §3.2). Firma un SIWE con la billetera **activa**
 * —la de la aplicación desbloqueada o, si no, la externa conectada— y la enlaza a la
 * cuenta de la sesión. No hay selector: la decisión es que firme la activa; si la activa
 * es la propia billetera de la sesión, se explica que ya está en la cuenta.
 */
export function LinkWalletButton({ lang = 'en', onLinked }: LinkWalletButtonProps) {
  const { status, walletInfo, getProvider } = useInAppWallet()
  const { address, sessionAddress } = useAuthAddress()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const t = createComponentT(lang, {
    en: {
      link: 'Link active wallet',
      linking: 'Linking…',
      linked: 'Wallet linked to your account.',
      needSession: 'Sign in first.',
      noWallet: 'Unlock the in-app wallet or connect an external one first.',
      isSessionWallet: 'That wallet is already part of your account.',
      owned: 'That wallet belongs to another account.',
      invalid: 'The signature could not be verified. Try again.',
      cancelled: 'The signature was cancelled.',
      failed: 'The wallet could not be linked. Try again.',
    },
    es: {
      link: 'Vincular billetera activa',
      linking: 'Vinculando…',
      linked: 'Billetera vinculada a tu cuenta.',
      needSession: 'Inicia sesión primero.',
      noWallet: 'Desbloquea la billetera de la aplicación o conecta una externa primero.',
      isSessionWallet: 'Esa billetera ya es parte de tu cuenta.',
      owned: 'Esa billetera pertenece a otra cuenta.',
      invalid: 'No se pudo verificar la firma. Intenta de nuevo.',
      cancelled: 'Se canceló la firma.',
      failed: 'No se pudo vincular la billetera. Intenta de nuevo.',
    },
  })

  const sessionWallet = sessionAddress || address || ''

  async function handleClick() {
    if (!sessionWallet) {
      setMessage(t('needSession'))
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const resolution = await detectActiveWalletSigner({
        inAppUnlocked: status === 'unlocked',
        inAppAddress: walletInfo?.address,
        inAppProvider: status === 'unlocked' ? getProvider(getRpcUrl()) : null,
        externalProvider: getExternalProvider(),
        sessionAddress: sessionWallet,
      })
      if (!resolution.ok) {
        setMessage(resolution.reason === 'no-wallet' ? t('noWallet') : t('isSessionWallet'))
        return
      }
      const result = await linkActiveWallet({ signer: resolution.signer, sessionWallet })
      if (result.ok) {
        setMessage(t('linked'))
        onLinked?.()
        return
      }
      setMessage(
        result.reason === 'owned-by-other'
          ? t('owned')
          : result.reason === 'invalid'
            ? t('invalid')
            : result.reason === 'cancelled'
              ? t('cancelled')
              : t('failed'),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        data-testid="wallet-link"
        disabled={busy}
        onClick={() => { void handleClick() }}
        className="text-xs text-gray-600 hover:bg-gray-100"
      >
        {busy ? t('linking') : t('link')}
      </Button>
      {message && (
        <span
          className="max-w-[220px] text-right text-[10px] text-gray-500"
          data-testid="wallet-link-message"
        >
          {message}
        </span>
      )}
    </span>
  )
}
