'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  WalletPanel as EngineWalletPanel,
  type WalletPanelMessages,
  type WalletToken,
  type WalletPanelWallet,
} from 'generated-wallet/next'
import { useInAppWallet } from '@pasosdejesus/m/wallet/next'
import {
  resolveNetwork,
  SLEARN_ADDRESSES,
  USDT_ADDRESSES,
} from '@pasosdejesus/mpdj/blockchain/ecosystem-addresses'
import { usePublicClient, useWalletClient } from '@/lib/hooks/useWallet'
import { TOKEN_DECIMALS } from '@/lib/wallet-amounts'
import {
  fetchAccountWallets,
  unlinkAccountWalletRequest,
  type AccountWallet,
} from '@/lib/wallet-account'
import { reconcileDownloadedCourses } from '@/lib/offline-course-db'
import { AccountWalletActions } from '@/components/AccountWalletActions'

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
  /** Abrir el diálogo de la billetera (desbloquear) desde el panel. */
  onRequestUnlock?: () => void
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

/**
 * Tokens de learn.tg (CELO nativo + USDT/SLEARN). Las direcciones salen de `mpdj`
 * (`@pasosdejesus/mpdj/blockchain/ecosystem-addresses`), que resuelve por red: en mainnet
 * son las canónicas y no dependen del `.env`. Leer `NEXT_PUBLIC_*` directamente fue el
 * origen de que el panel mostrara USDT en cero cuando el `.env` venía de otra red.
 */
function learnTgTokens(): WalletToken[] {
  const network = resolveNetwork()
  return [
    { symbol: 'CELO', decimals: TOKEN_DECIMALS.CELO },
    { symbol: 'USDT', decimals: TOKEN_DECIMALS.USDT, address: USDT_ADDRESSES[network] },
    { symbol: 'SLEARN', decimals: TOKEN_DECIMALS.SLEARN, address: SLEARN_ADDRESSES[network] },
  ]
}

export function WalletPanel({ lang = 'en', open, onOpenChange, address, onLock, onRequestUnlock }: WalletPanelProps) {
  const language = lang === 'es' ? 'es' : 'en'
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const inApp = useInAppWallet()
  // Igual que antes: enviar sólo con la billetera **de la aplicación** desbloqueada.
  const unlocked = inApp.status === 'unlocked'
  const [accountWallets, setAccountWallets] = useState<AccountWallet[]>([])

  // R-#265: la cuenta puede tener N billeteras; se listan al abrir el panel. Si la
  // lectura falla (sin sesión, por ejemplo) se muestra sólo la conectada.
  const refreshWallets = useCallback(async () => {
    if (!address) { setAccountWallets([]); return }
    const list = await fetchAccountWallets(address)
    setAccountWallets(list ?? [])
  }, [address])
  useEffect(() => { if (open) void refreshWallets() }, [open, refreshWallets])

  const wallets: WalletPanelWallet[] = useMemo(() => {
    if (accountWallets.length > 0) {
      return accountWallets.map((wallet) => {
        const isConnected = wallet.billetera.toLowerCase() === address.toLowerCase()
        return {
          address: wallet.billetera,
          linkedAt: wallet.linked_at,
          isConnected,
          isInApp: isConnected && unlocked,
        }
      })
    }
    return address ? [{ address, isConnected: true, isInApp: unlocked }] : []
  }, [accountWallets, address, unlocked])

  const handleUnlink = useCallback(async (walletToUnlink: string) => {
    const result = await unlinkAccountWalletRequest(address, walletToUnlink)
    if (!result.ok) return
    setAccountWallets(result.wallets)
    // R-#265 §3.3: el servidor revoca las credenciales de la billetera desvinculada.
    // Aquí se actualiza qué billeteras de la cuenta pueden leer cada copia sin conexión.
    void reconcileDownloadedCourses(
      result.wallets.map((wallet) => wallet.billetera),
      result.usuarioId,
    ).catch(() => {})
  }, [address])

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
      onUnlink={handleUnlink}
      tokens={tokens}
      // `as never`: el `.d.ts` del motor referencia su propio `viem` (compilado en la
      // copia vendorizada); es la misma versión, pero tsc ve dos identidades.
      publicClient={publicClient as never}
      walletClient={(unlocked ? (walletClient ?? null) : null) as never}
      network={process.env.NEXT_PUBLIC_NETWORK}
      // R-#265 §3.2 (preferencia del operador, 2026-10-17; ajustada al verla en
      // producción): la cuenta con sus acciones (vincular/invitar) es la **última**
      // pestaña, después de saldos, recibir, enviar y coleccionables.
      tabOrder={['balances', 'receive', 'send', 'collectibles', 'accounts']}
      onRequestUnlock={onRequestUnlock}
      accountsActions={
        address
          ? (
            <AccountWalletActions
              lang={language}
              onChanged={refreshWallets}
              onUnlock={onRequestUnlock}
              showUnlinkWarning
              onClose={() => onOpenChange(false)}
            />
          )
          : undefined
      }
    />
  )
}
