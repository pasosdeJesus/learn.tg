'use client'

import { useCallback, useMemo, useState } from 'react'
import { signOut } from 'next-auth/react'
import { useInAppWallet } from '@learn-tg/pdj-wallet-next'
import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import { ConnectWalletButton } from '@/components/ConnectWalletButton'
import { WalletDialog } from '@/components/WalletDialog'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { createComponentT } from '@/lib/hooks/useTranslation'

interface WalletSelectorProps {
  lang?: string
}

/**
 * Entrada de la cabecera para elegir billetera (R-#238/R-#244).
 *
 * La cabecera solo muestra el estado: un botón que abre `WalletDialog` (crear,
 * importar, desbloquear e ingresar con SIWE) o, cuando ya hay sesión con la
 * billetera de la aplicación, la dirección corta y "Desconectar". La ruta externa
 * sigue delegando en `ConnectWalletButton`, y solo se ofrece si existe
 * `window.ethereum` (en la app instalada, o en un teléfono sin billetera, no lo
 * hay: ese es justamente el caso que resuelve la billetera propia).
 */
export function WalletSelector({ lang = 'en' }: WalletSelectorProps) {
  const { status, lock } = useInAppWallet()
  const { sessionAddress, inAppAddress, isInAppUnlocked } = useAuthAddress()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [external, setExternal] = useState(false)

  const t = useMemo(() => createComponentT(lang, {
    en: {
      useInApp: 'Use in-app wallet',
      unlockInApp: 'Unlock your in-app wallet',
      signInInApp: 'Sign in with in-app wallet',
      useExternal: 'Use external wallet',
      disconnect: 'Disconnect',
    },
    es: {
      useInApp: 'Usar billetera de la aplicación',
      unlockInApp: 'Desbloquear tu billetera',
      signInInApp: 'Ingresar con la billetera de la aplicación',
      useExternal: 'Usar billetera externa',
      disconnect: 'Desconectar',
    },
  }), [lang])

  const signedInWithInApp = !!inAppAddress && !!sessionAddress &&
    sessionAddress.toLowerCase() === inAppAddress.toLowerCase()
  const shortAddress = inAppAddress
    ? `${inAppAddress.slice(0, 6)}…${inAppAddress.slice(-4)}`
    : ''

  const disconnect = useCallback(async () => {
    localStorage.removeItem('learn.tg.sessionAddress')
    await lock()
    await signOut({ redirect: true, callbackUrl: `/${lang}` })
  }, [lang, lock])

  if (external) {
    return <ConnectWalletButton lang={lang} />
  }

  if (signedInWithInApp) {
    return (
      <div data-testid="wallet-selector-in-app" className="flex items-center gap-2 text-sm">
        <span className="font-mono">{shortAddress}</span>
        <Button variant="outline" size="sm" data-testid="wallet-disconnect" onClick={() => { void disconnect() }}>
          {t('disconnect')}
        </Button>
      </div>
    )
  }

  const label = isInAppUnlocked
    ? t('signInInApp')
    : status === 'locked' ? t('unlockInApp') : t('useInApp')

  return (
    <div data-testid="wallet-selector" className="flex items-center gap-2">
      <Button size="sm" data-testid="wallet-open-dialog" onClick={() => setDialogOpen(true)}>
        {label}
      </Button>
      {typeof window !== 'undefined' && !!window.ethereum && (
        <Button
          variant="outline"
          size="sm"
          data-testid="wallet-use-external"
          onClick={() => setExternal(true)}
        >
          {t('useExternal')}
        </Button>
      )}
      <WalletDialog lang={lang} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
