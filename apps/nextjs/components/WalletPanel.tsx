'use client'

import { useMemo } from 'react'
import {
  WalletPanel as EngineWalletPanel,
  type WalletPanelMessages,
  type WalletToken,
  type WalletPanelWallet,
} from 'generated-wallet/next'
import { useInAppWallet } from '@pasosdejesus/m/wallet/next'
import { usePublicClient, useWalletClient } from '@/lib/hooks/useWallet'
import { TOKEN_DECIMALS } from '@/lib/wallet-amounts'

/**
 * `WalletPanel` de learn.tg — **envoltorio** del panel del motor `wallet` de `m`
 * ([`@pasosdejesus/wallet/next`](https://gitlab.com/pasosdeJesus/m/-/work_items/50), vendored como
 * `generated-wallet`, R-#265 §3.9). Aporta lo específico de learn.tg (tokens y
 * direcciones por env, red, clientes viem de `@/lib/hooks/useWallet`, desconexión) e
 * inyecta los textos que la app ya mostraba. La lógica de saldos/recibir/enviar/
 * coleccionables y su validación viven en el motor.
 */

interface WalletPanelProps {
  lang?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Dirección de la billetera de la aplicación (la del registro). */
  address: string
  /** Desconectar la billetera y cerrar la sesión, como el ✕ de la cabecera. */
  onLock?: () => void
}

/** Textos que learn.tg ya mostraba y difieren de los del motor. */
const MESSAGES: Record<'en' | 'es', Partial<WalletPanelMessages>> = {
  en: {
    errNoGas: 'Set aside some CELO for the network fee.',
    needWallet: 'Unlock your in-app wallet to send funds.',
  },
  es: {
    errNoGas: 'Deja algo de CELO para la comisión de red.',
    needWallet: 'Desbloquea tu billetera de la aplicación para enviar fondos.',
  },
}

/** Tokens de learn.tg (CELO nativo + USDT/SLEARN por env). */
function learnTgTokens(): WalletToken[] {
  return [
    { symbol: 'CELO', decimals: TOKEN_DECIMALS.CELO },
    {
      symbol: 'USDT',
      decimals: TOKEN_DECIMALS.USDT,
      address: process.env.NEXT_PUBLIC_USDT_ADDRESS as `0x${string}` | undefined,
    },
    {
      symbol: 'SLEARN',
      decimals: TOKEN_DECIMALS.SLEARN,
      address: process.env.NEXT_PUBLIC_SLEARN_ADDRESS as `0x${string}` | undefined,
    },
  ]
}

export function WalletPanel({ lang = 'en', open, onOpenChange, address, onLock }: WalletPanelProps) {
  const language = lang === 'es' ? 'es' : 'en'
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const inApp = useInAppWallet()
  // Igual que antes: enviar sólo con la billetera **de la aplicación** desbloqueada.
  const unlocked = inApp.status === 'unlocked'
  const wallets: WalletPanelWallet[] = address
    ? [{ address, isConnected: true, isInApp: unlocked }]
    : []
  const tokens = useMemo(learnTgTokens, [])

  return (
    <EngineWalletPanel
      lang={language}
      messages={MESSAGES[language]}
      open={open}
      onOpenChange={onOpenChange}
      address={address}
      wallets={wallets}
      onDisconnect={onLock}
      tokens={tokens}
      // `as never`: el `.d.ts` del motor referencia su propio `viem` (compilado en la
      // copia vendorizada); es la misma versión, pero tsc ve dos identidades.
      publicClient={publicClient as never}
      walletClient={(unlocked ? (walletClient ?? null) : null) as never}
      network={process.env.NEXT_PUBLIC_NETWORK}
    />
  )
}
