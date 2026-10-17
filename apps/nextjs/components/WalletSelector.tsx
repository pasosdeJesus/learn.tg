'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { signOut } from 'next-auth/react'
import { useInAppWallet } from '@pasosdejesus/m/wallet/next'
import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import { WalletConnect, type WalletConnectBodyContext } from 'generated-wallet/next'
import { ConnectWalletButton } from '@/components/ConnectWalletButton'
import { WalletDialog } from '@/components/WalletDialog'
import { WalletPanel } from '@/components/WalletPanel'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { clearRestrictedCourseCopies } from '@/lib/offline-course-db'
import { useExternalProvider } from '@/lib/external-provider'
import { isWalletBrowser } from '@/lib/wallet-browser'
import { OPEN_IN_APP_WALLET_DIALOG } from '@/lib/in-app-wallet-dialog'
import { createComponentT } from '@/lib/hooks/useTranslation'

interface WalletSelectorProps {
  lang?: string
}

/**
 * Entrada de la cabecera para la billetera (R-#238/R-#244/R-#265 §3.9).
 *
 * Sin sesión muestra **un solo** botón "Conectar": `WalletConnect` del motor `wallet`
 * (`generated-wallet/next`) abre el modal de elección (in-app o externa), con el cuerpo
 * sobrecargado para learn.tg (`WalletDialog` para crear/importar/desbloquear/ingresar y
 * `ConnectWalletButton` para la red + SIWE externas). Con sesión muestra la dirección
 * corta, "Desconectar" y la píldora que abre el panel o el diálogo; vincular e invitar
 * viven en la pestaña "Cuentas" del panel y en el perfil. En el navegador de una
 * billetera la externa va primero dentro del modal (`?iappwallet=1` invierte la prioridad).
 */
export function WalletSelector({ lang = 'en' }: WalletSelectorProps) {
  const { status, lock } = useInAppWallet()
  const { address, sessionAddress, inAppAddress, isSessionLoading } = useAuthAddress()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  // R-#246: la billetera inyectada se detecta por EIP-6963 (Rabby, MetaMask y
  // OneKey móviles no definen `window.ethereum`), así que ya no se decide durante
  // el render ni con un solo evento `ethereum#initialized`.
  const { available: externalAvailable } = useExternalProvider()

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
      connect: 'Connect Wallet',
      walletTitle: 'Wallet',
      inAppHint: 'Create a wallet inside the app — no installation needed.',
      externalHint: 'Or connect a wallet you already have (Rabby, MetaMask…).',
      signInHint: 'The wallet is unlocked: sign in to use your account.',
      disconnect: 'Disconnect',
      openWallet: 'In-app wallet options',
      walletBrowserNote: 'In this browser the in-app wallet has no fingerprint or Face ID: you would unlock it with the password.',
      haveWalletImport: 'Already have a wallet? Import your recovery phrase',
    },
    es: {
      useInApp: 'Usar billetera de la aplicación',
      loadingInApp: 'Billetera de la aplicación',
      unlockInApp: 'Desbloquear tu billetera',
      signInInApp: 'Ingresar con la billetera de la aplicación',
      useExternal: 'Usar billetera externa',
      connect: 'Conectar Billetera',
      walletTitle: 'Billetera',
      inAppHint: 'Crea una billetera dentro de la aplicación, sin instalar nada.',
      externalHint: 'O conecta una billetera que ya tengas (Rabby, MetaMask…).',
      signInHint: 'La billetera está desbloqueada: ingresa para usar tu cuenta.',
      disconnect: 'Desconectar',
      openWallet: 'Opciones de la billetera de la aplicación',
      walletBrowserNote: 'En este navegador la billetera de la aplicación no tiene huella ni Face ID: la desbloquearías con la clave.',
      haveWalletImport: '¿Ya tienes billetera? Importa tu frase de recuperación',
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
    // R-#256 §3.5/§3.6b: al desconectar no deben quedar en el dispositivo los
    // cursos de pago (el derecho no se puede comprobar) ni los de contenido
    // sensible (el interruptor vive en la sesión).
    await clearRestrictedCourseCopies().catch(() => {})
    await lock()
    await signOut({ redirect: true, callbackUrl: `/${lang}` })
  }, [lang, lock])

  // R-#246 §3 (2026-09-19): en un navegador que ya trae billetera inyectada (OKX,
  // Rabby, MetaMask, OneKey…) mandan las reglas de esa billetera y la de la
  // aplicación solo se ofrece si el URL la pide (`?iappwallet=1`). En un navegador
  // sin billetera sigue siendo el único camino, y si este dispositivo ya tiene una
  // billetera de la aplicación se conserva su interfaz para no dejarla inaccesible.
  // El estado va aquí arriba (antes de los `return` de abajo) para que el número de
  // hooks no cambie entre renders.
  // R-#270 §3.1: la billetera de la aplicación es la opción por defecto; la externa
  // manda sólo dentro del navegador propio de una billetera (R-#246 §3), donde el
  // usuario ya vive con esa billetera. El contacto del navegador se lee al montar
  // para no romper la hidratación, y el usuario puede pedir la in-app con
  // `?iappwallet=1` o con el botón secundario.
  const [inAppRequested, setInAppRequested] = useState(false)
  const [walletBrowser, setWalletBrowser] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    setInAppRequested(new URLSearchParams(window.location.search).get('iappwallet') === '1')
    setWalletBrowser(isWalletBrowser())
  }, [])
  const hasInAppWallet = status === 'locked' || status === 'unlocked'
  // El navegador de una billetera conserva la del dispositivo como principal, salvo
  // que el URL pida la in-app o ya tenga una en este equipo. `externalPrimary` ahora
  // sólo ordena las opciones dentro del modal (externa primero), no cambia la cabecera.
  const externalPrimary = externalAvailable && walletBrowser && !inAppRequested && !hasInAppWallet
  const migrationHref = lang === 'es' ? '/es/migracion-billetera-app' : '/en/migration-in-app-wallet'

  if (signedIn) {
    // R-#249/R-#265 (2026-10-17): con sesión la píldora abre **siempre** el panel
    // (saldos, recibir, enviar, coleccionables y la pestaña Cuentas). Antes, con la
    // billetera bloqueada abría el diálogo de desbloqueo: tras el SIWE la recarga deja
    // la clave fuera de memoria, así que el usuario desbloqueaba dos veces. Ahora el
    // panel ofrece "Desbloquear" cuando hace falta firmar.
    const openWalletUi = () => setPanelOpen(true)
    return (
      <>
        <div data-testid="wallet-selector-in-app" className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            data-testid="wallet-open-dialog"
            title={t('openWallet')}
            aria-label={t('openWallet')}
            onClick={openWalletUi}
            className="text-xs text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full font-mono hover:bg-gray-200"
          >
            {shortAddress}
          </Button>
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
        <WalletPanel
          lang={lang}
          open={panelOpen}
          onOpenChange={setPanelOpen}
          address={inAppAddress || shownAddress || ''}
          onLock={() => { void disconnect() }}
          onRequestUnlock={() => setDialogOpen(true)}
        />
      </>
    )
  }

  // Mientras se consulta IndexedDB (`loading`) o NextAuth resuelve la cookie
  // todavía no se sabe si hay billetera o sesión: decir "Use in-app wallet" o
  // "Unlock your in-app wallet" confunde (reportado el 2026-09-15).
  const booting = status === 'loading' || isSessionLoading

  // R-#265 §3.9 y preferencia del operador (2026-10-17): **un solo** botón "Conectar"
  // en la cabecera y **un modal** de elección (in-app o externa) del motor `wallet`
  // (`generated-wallet/next`), en vez de varios botones. El cuerpo se sobrecarga
  // (`renderBody`) para conservar el flujo de learn.tg: `WalletDialog` (creación,
  // importación, 12 palabras, ingreso) y `ConnectWalletButton` (red + SIWE externos).
  // En el navegador propio de una billetera la externa va primero; en el resto, la
  // in-app (R-#270 §3.1). La cabecera con sesión (panel, desvincular, invitar) sigue
  // aparte porque es específica de la app.
  const renderConnectBody = (ctx: WalletConnectBodyContext) => {
    if (booting) {
      return <p className="text-sm text-gray-600">{t('loadingInApp')}</p>
    }
    const inAppAction = (
      <div className="space-y-2">
        <p className="text-sm text-gray-600">
          {hasInAppWallet
            ? (status === 'locked' ? t('unlockInApp') : t('signInHint'))
            : t('inAppHint')}
        </p>
        <Button
          className="w-full"
          data-testid="wallet-open-dialog"
          onClick={() => { ctx.close(); setDialogOpen(true) }}
        >
          {hasInAppWallet
            ? (status === 'locked' ? t('unlockInApp') : t('signInInApp'))
            : t('useInApp')}
        </Button>
      </div>
    )
    const externalAction = externalAvailable ? (
      <div className="space-y-2" data-testid="wallet-use-external">
        <p className="text-xs text-gray-500">{t('externalHint')}</p>
        <ConnectWalletButton lang={lang} />
      </div>
    ) : null
    return (
      <div className="space-y-4">
        {externalPrimary ? (
          <>{externalAction}{inAppAction}</>
        ) : (
          <>{inAppAction}{externalAction}</>
        )}
        {externalAvailable && (
          /* R-#270 §3.1: conservar la dirección e historial, a un clic. */
          <a
            href={migrationHref}
            className="block text-xs text-blue-600 hover:underline"
            data-testid="wallet-import-hint"
          >
            {t('haveWalletImport')}
          </a>
        )}
        {walletBrowser && (
          <p className="text-[11px] text-gray-500" data-testid="wallet-browser-note">
            {t('walletBrowserNote')}
          </p>
        )}
      </div>
    )
  }

  return (
    <div
      data-testid="wallet-selector"
      data-external-primary={externalPrimary ? 'true' : 'false'}
      className="flex items-center gap-2"
    >
      <WalletConnect
        lang={lang === 'es' ? 'es' : 'en'}
        messages={{
          connect: t('connect'),
          title: t('walletTitle'),
          inAppBtn: t('useInApp'),
          external: t('useExternal'),
          inAppHint: t('inAppHint'),
          externalHint: t('externalHint'),
          signIn: t('signInInApp'),
          signInHint: t('signInHint'),
          loading: t('loadingInApp'),
        }}
        isConnected={false}
        externalAvailable={externalAvailable}
        onSignIn={() => setDialogOpen(true)}
        renderBody={renderConnectBody}
      />
      <WalletDialog lang={lang} open={dialogOpen} onOpenChange={setDialogOpen} sessionAddress={sessionAddress} />
    </div>
  )
}
