'use client'

import { useEffect, useState } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { fetchAccountWallets, type AccountWallet } from '@/lib/wallet-account'

interface AccountWalletListProps {
  lang?: string
  /** Billetera de la sesión: pista para `GET /api/wallet` (debe pertenecer a la cuenta). */
  address: string
  /** Cambia para volver a leer la lista (tras vincular, invitar o aceptar). */
  refreshKey?: number
  /** Billetera con la que se ingresó, para marcarla. */
  sessionAddress?: string
  /** Billetera in-app desbloqueada, para marcarla. */
  inAppAddress?: string
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/**
 * Lista de billeteras de la cuenta para el perfil (R-#265/R-#288). El panel de la
 * billetera ya las muestra en su pestaña **Accounts**; el perfil solo tenía las
 * acciones (vincular/invitar) y no la lista, así que no se veían las billeteras
 * de la cuenta (reporte del operador, 2026-10-23).
 */
export function AccountWalletList({
  lang = 'en',
  address,
  refreshKey = 0,
  sessionAddress,
  inAppAddress,
}: AccountWalletListProps) {
  const [wallets, setWallets] = useState<AccountWallet[] | null>(null)

  const t = createComponentT(lang, {
    en: {
      loading: 'Loading wallets…',
      empty: 'No wallets found in this account.',
      thisDevice: 'This device',
      inApp: 'In-app',
    },
    es: {
      loading: 'Cargando billeteras…',
      empty: 'No se encontraron billeteras en esta cuenta.',
      thisDevice: 'Este dispositivo',
      inApp: 'En la app',
    },
  })

  useEffect(() => {
    let cancelled = false
    if (!address) {
      setWallets([])
      return
    }
    void fetchAccountWallets(address).then((list) => {
      if (!cancelled) setWallets(list ?? [])
    })
    return () => { cancelled = true }
  }, [address, refreshKey])

  if (!address) return null
  if (wallets === null) {
    return <p className="text-sm text-gray-500" data-testid="account-wallet-list-loading">{t('loading')}</p>
  }
  if (wallets.length === 0) {
    return <p className="text-sm text-gray-500" data-testid="account-wallet-list-empty">{t('empty')}</p>
  }

  const session = sessionAddress?.toLowerCase()
  const inApp = inAppAddress?.toLowerCase()

  return (
    <ul className="space-y-2" data-testid="account-wallet-list">
      {wallets.map((wallet) => {
        const value = wallet.billetera.toLowerCase()
        return (
          <li
            key={wallet.id}
            className="flex flex-wrap items-center gap-2 rounded-md border p-3"
            data-testid={`account-wallet-${value}`}
          >
            <span className="font-mono text-sm break-all" title={wallet.billetera}>
              {shortAddress(wallet.billetera)}
            </span>
            {session === value && (
              <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] uppercase text-gray-600">
                {t('thisDevice')}
              </span>
            )}
            {inApp === value && (
              <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] uppercase text-gray-600">
                {t('inApp')}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
