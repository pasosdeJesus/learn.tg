'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { signOut } from 'next-auth/react'
import { useInAppWallet } from '@learn-tg/pdj-wallet-next'
import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import { ConnectWalletButton } from '@/components/ConnectWalletButton'
import { WalletDialog } from '@/components/WalletDialog'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { OPEN_IN_APP_WALLET_DIALOG } from '@/lib/in-app-wallet-dialog'
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
  const { address, sessionAddress, isInAppUnlocked, isSessionLoading } = useAuthAddress()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [external, setExternal] = useState(false)
  // `window.ethereum` solo existe en el navegador: decidirlo durante el render
  // rompe la hidratación (el servidor no dibuja el botón y el cliente sí). Se
  // resuelve después de montar, como en `ConnectWalletButton`.
  const [externalAvailable, setExternalAvailable] = useState(false)

  useEffect(() => {
    const detect = () => setExternalAvailable(typeof window !== 'undefined' && !!window.ethereum)
    detect()
    window.addEventListener('ethereum#initialized', detect, { once: true })
    return () => window.removeEventListener('ethereum#initialized', detect)
  }, [])

  // Donation/purchase modals can ask for the wallet to be unlocked
  // (`lib/in-app-wallet-dialog.ts`).
  useEffect(() => {
    const openFromOutside = () => setDialogOpen(true)
    window.addEventListener(OPEN_IN_APP_WALLET_DIALOG, openFromOutside)
    return () => window.removeEventListener(OPEN_IN_APP_WALLET_DIALOG, openFromOutside)
  }, [])

  const t = useMemo(() => createComponentT(lang, {
    en: {
      useInApp: 'Use in-app wallet',
      loadingInApp: 'In-app wallet',
      unlockInApp: 'Unlock your in-app wallet',
      signInInApp: 'Sign in with in-app wallet',
      useExternal: 'Use external wallet',
      disconnect: 'Disconnect',
    },
    es: {
      useInApp: 'Usar billetera de la aplicación',
      loadingInApp: 'Billetera de la aplicación',
      unlockInApp: 'Desbloquear tu billetera',
      signInInApp: 'Ingresar con la billetera de la aplicación',
      useExternal: 'Usar billetera externa',
      disconnect: 'Desconectar',
    },
  }), [lang])

  // La credencial es la cookie de sesión (R-#233 Fase 2), así que el estado
  // "conectado" se decide por la sesión y NO por que la billetera esté
  // desbloqueada: tras el SIWE la página recarga para que NextAuth lea la cookie
  // y la billetera queda bloqueada (solo se desbloquea cuando hay que firmar).
  // Mirar `isInAppUnlocked` aquí hacía que la cabecera volviera a pedir
  // "Unlock your in-app wallet" después de cada ingreso.
  const signedIn = !!sessionAddress
  const shownAddress = sessionAddress || address || undefined
  const shortAddress = shownAddress
    ? `${shownAddress.slice(0, 6)}…${shownAddress.slice(-4)}`
    : ''

  const disconnect = useCallback(async () => {
    localStorage.removeItem('learn.tg.sessionAddress')
    await lock()
    await signOut({ redirect: true, callbackUrl: `/${lang}` })
  }, [lang, lock])

  if (external) {
    return <ConnectWalletButton lang={lang} />
  }

  if (signedIn) {
    return (
      <>
        <div data-testid="wallet-selector-in-app" className="flex items-center gap-2">
          <span className="text-xs text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full font-mono">
            {shortAddress}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-gray-500 hover:text-red-600"
            data-testid="wallet-disconnect"
            title={t('disconnect')}
            aria-label={t('disconnect')}
            onClick={() => { void disconnect() }}
          >
            ✕
          </Button>
        </div>
        {/* Con sesión iniciada la billetera queda bloqueada tras recargar, así que
            el diálogo tiene que seguir montado: es el único que atiende
            OPEN_IN_APP_WALLET_DIALOG. Sin él, el botón "desbloquear" de los modales
            de donación y de compra no hacía nada (reportado el 2026-09-16). */}
        <WalletDialog lang={lang} open={dialogOpen} onOpenChange={setDialogOpen} sessionAddress={sessionAddress} />
      </>
    )
  }

  // Mientras se consulta IndexedDB (`loading`) o NextAuth resuelve la cookie
  // todavía no se sabe si hay billetera o sesión: decir "Use in-app wallet" o
  // "Unlock your in-app wallet" confunde (reportado el 2026-09-15).
  const booting = status === 'loading' || isSessionLoading
  const label = booting
    ? t('loadingInApp')
    : isInAppUnlocked
      ? t('signInInApp')
      : status === 'locked' ? t('unlockInApp') : t('useInApp')

  return (
    <div data-testid="wallet-selector" className="flex items-center gap-2">
      <Button size="sm" data-testid="wallet-open-dialog" disabled={booting} onClick={() => setDialogOpen(true)}>
        {label}
      </Button>
      {externalAvailable && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-gray-600 hover:bg-gray-100"
          data-testid="wallet-use-external"
          onClick={() => setExternal(true)}
        >
          {t('useExternal')}
        </Button>
      )}
      <WalletDialog lang={lang} open={dialogOpen} onOpenChange={setDialogOpen} sessionAddress={sessionAddress} />
    </div>
  )
}
