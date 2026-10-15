'use client'

/**
 * `WalletConnect` — vista **genérica** de conexión de billetera del motor `wallet`
 * ([REQ/50](https://gitlab.com/pasosdeJesus/m/-/work_items/50) D9; base learn.tg, punto de entrada con el **modal de
 * elección** de sivel3: un solo botón «Conectar» que ofrece *in-app* o *externa*, en
 * vez de dos botones en el header).
 *
 * **Sobrecargable** (D10): el consumidor puede (a) importar esta vista, (b) usar sus
 * componentes granularmente (`InAppWalletSetup`/`Unlock` desde `@pasosdejesus/m/wallet/next`),
 * o (c) reemplazar el cuerpo del diálogo con `renderBody`. El estado de conexión y los
 * textos se **inyectan** (no dependemos de un contexto de la app).
 */

import { useState, type ReactNode } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@pasosdejesus/m/shadcn-components/ui/dialog'
import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import { Badge } from '@pasosdejesus/m/shadcn-components/ui/badge'
import { Separator } from '@pasosdejesus/m/shadcn-components/ui/separator'
import { useInAppWallet, InAppWalletSetup, InAppWalletUnlock } from '@pasosdejesus/m/wallet/next'
import { getExternalProvider } from '@pasosdejesus/m/wallet'

export type WalletLang = 'en' | 'es'

/** Textos de la vista (inyectables; sobreescriben los por defecto). */
export interface WalletConnectMessages {
  connect: string
  title: string
  inAppBtn: string
  inAppHint: string
  external: string
  externalHint: string
  disconnect: string
  connected: string
  inAppBadge: string
  noExternal: string
  externalFailed: string
  loading: string
  signIn: string
  signInHint: string
}

const DEFAULT_MESSAGES: Record<WalletLang, WalletConnectMessages> = {
  en: {
    connect: 'Connect Wallet',
    title: 'Wallet',
    inAppBtn: 'Use in-app wallet',
    inAppHint: 'Create a wallet inside the app — no installation needed.',
    external: 'Connect external wallet',
    externalHint: 'Or connect a wallet you already have (Rabby, MetaMask…).',
    disconnect: 'Disconnect',
    connected: 'Connected wallet',
    inAppBadge: 'In-app',
    noExternal: 'No external wallet detected.',
    externalFailed: 'Could not connect the external wallet.',
    loading: 'Loading…',
    signIn: 'Sign in with in-app wallet',
    signInHint: 'The wallet is unlocked: sign in to use your account.',
  },
  es: {
    connect: 'Conectar Billetera',
    title: 'Billetera',
    inAppBtn: 'Usar billetera de la aplicación',
    inAppHint: 'Crea una billetera dentro de la aplicación, sin instalar nada.',
    external: 'Conectar billetera externa',
    externalHint: 'O conecta una billetera que ya tengas (Rabby, MetaMask…).',
    disconnect: 'Desconectar',
    connected: 'Billetera conectada',
    inAppBadge: 'En la app',
    noExternal: 'No se detectó billetera externa.',
    externalFailed: 'No se pudo conectar la billetera externa.',
    loading: 'Cargando…',
    signIn: 'Ingresar con la billetera de la aplicación',
    signInHint: 'La billetera está desbloqueada: ingresa para usar tu cuenta.',
  },
}

/** Contexto que recibe `renderBody` para sobrecargar el cuerpo del diálogo. */
export interface WalletConnectBodyContext {
  lang: WalletLang
  close: () => void
  connectExternal: () => Promise<void>
  externalError: string | null
}

export interface WalletConnectProps {
  lang?: WalletLang
  messages?: Partial<WalletConnectMessages>
  /** Estado de conexión (lo aporta el consumidor, p. ej. su propio `WalletContext`). */
  isConnected?: boolean
  effectiveAddress?: string | null
  isInApp?: boolean
  externalAvailable?: boolean
  onDisconnect?: () => void
  /**
   * Iniciar sesión (SIWE) con la billetera in-app desbloqueada. El motor no hace
   * SIWE (es glue del consumidor); si no se aporta, se muestra sólo la pista (V2).
   */
  onSignIn?: () => void
  /** Reemplaza el cuerpo del diálogo (sobrecarga granular). */
  renderBody?: (ctx: WalletConnectBodyContext) => ReactNode
}

function shorten(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function WalletConnect({
  lang = 'en',
  messages,
  isConnected = false,
  effectiveAddress = null,
  isInApp = false,
  externalAvailable = false,
  onDisconnect,
  onSignIn,
  renderBody,
}: WalletConnectProps) {
  const text = { ...DEFAULT_MESSAGES[lang], ...messages }
  const inApp = useInAppWallet()
  const [open, setOpen] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setShowSetup(false)
      setError(null)
    }
  }

  const connectExternal = async () => {
    setError(null)
    const provider = getExternalProvider()
    if (!provider) {
      setError(text.noExternal)
      return
    }
    try {
      await provider.request({ method: 'eth_requestAccounts' })
      setOpen(false)
    } catch {
      setError(text.externalFailed)
    }
  }

  const renderContent = (): ReactNode => {
    if (renderBody) return renderBody({ lang, close: () => setOpen(false), connectExternal, externalError: error })
    if (showSetup) return <InAppWalletSetup lang={lang} onDone={() => setOpen(false)} />
    if (isConnected && effectiveAddress) {
      return (
        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">{text.connected}</p>
            <p className="text-sm font-mono break-all mt-1">{effectiveAddress}</p>
            {isInApp && (
              <Badge variant="secondary" className="mt-2 text-[10px]">
                {text.inAppBadge}
              </Badge>
            )}
          </div>
          <Separator />
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            data-testid="disconnect-wallet"
            onClick={() => onDisconnect?.()}
          >
            {text.disconnect}
          </Button>
        </div>
      )
    }
    if (inApp.status === 'unlocked') {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{text.signInHint}</p>
          {onSignIn && (
            <Button
              className="w-full"
              data-testid="sign-in-wallet"
              onClick={() => {
                onSignIn()
                setOpen(false)
              }}
            >
              {text.signIn}
            </Button>
          )}
        </div>
      )
    }
    if (inApp.status === 'locked') return <InAppWalletUnlock lang={lang} onUnlocked={() => setOpen(false)} />
    if (inApp.status === 'no-wallet') {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{text.inAppHint}</p>
          <Button className="w-full" data-testid="use-in-app-wallet" onClick={() => setShowSetup(true)}>
            {text.inAppBtn}
          </Button>
          {externalAvailable && (
            <>
              <Separator />
              <p className="text-xs text-muted-foreground">{text.externalHint}</p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                data-testid="use-external-wallet"
                onClick={connectExternal}
              >
                {text.external}
              </Button>
            </>
          )}
        </div>
      )
    }
    return <p className="text-sm text-muted-foreground">{text.loading}</p>
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {isConnected && effectiveAddress ? (
          <Button variant="default" size="sm" className="h-8 gap-2 px-3" data-testid="connected-wallet">
            <Badge variant="outline" className="h-2 w-2 p-0 bg-green-500 border-green-500" />
            <span className="text-xs font-medium">{shorten(effectiveAddress)}</span>
          </Button>
        ) : (
          <Button variant="default" size="sm" className="gap-2" data-testid="connect-wallet">
            {text.connect}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{text.title}</DialogTitle>
        </DialogHeader>
        {renderContent()}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  )
}
