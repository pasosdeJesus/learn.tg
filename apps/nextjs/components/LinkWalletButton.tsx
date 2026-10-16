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
      link: 'Link another wallet',
      linking: 'Linking…',
      linked: 'Wallet linked to your account.',
      needSession: 'Sign in first.',
      noWallet: 'No wallet can sign yet. Unlock your in-app wallet, or install and enable a browser wallet (OneKey, MetaMask, Rabby…) and press again.',
      isSessionWallet: 'That wallet is already in your account. To add another: unlock your in-app wallet, or connect a different wallet in your browser and press again.',
      cancelled: 'The wallet did not grant access, or the signature was cancelled.',
      owned: 'That wallet belongs to another account.',
      invalid: 'The signature could not be verified. Try again.',
      failed: 'The wallet could not be linked. Try again.',
    },
    es: {
      link: 'Vincular otra billetera',
      linking: 'Vinculando…',
      linked: 'Billetera vinculada a tu cuenta.',
      needSession: 'Inicia sesión primero.',
      noWallet: 'Ninguna billetera puede firmar todavía. Desbloquea tu billetera de la aplicación, o instala y activa una billetera del navegador (OneKey, MetaMask, Rabby…) y vuelve a pulsar.',
      isSessionWallet: 'Esa billetera ya está en tu cuenta. Para agregar otra: desbloquea tu billetera de la aplicación, o conecta una billetera distinta en el navegador y vuelve a pulsar.',
      cancelled: 'La billetera no concedió acceso o se canceló la firma.',
      owned: 'Esa billetera pertenece a otra cuenta.',
      invalid: 'No se pudo verificar la firma. Intenta de nuevo.',
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
        setMessage(
          resolution.reason === 'no-wallet'
            ? t('noWallet')
            : resolution.reason === 'cancelled'
              ? t('cancelled')
              : t('isSessionWallet'),
        )
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
