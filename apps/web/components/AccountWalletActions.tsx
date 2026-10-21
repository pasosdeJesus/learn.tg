'use client'

import { useEffect, useState } from 'react'
import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import { useInAppWallet } from '@pasosdejesus/m/wallet/next'
import { getExternalProvider, useExternalProvider } from '@/lib/external-provider'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { hasAnotherWallet } from '@/lib/wallet-availability'
import { LinkWalletButton } from '@/components/LinkWalletButton'
import { InviteWalletControl } from '@/components/InviteWalletControl'

interface AccountWalletActionsProps {
  lang?: string
  /** Refresca la lista de billeteras tras vincular o invitar. */
  onChanged?: () => void
  /** Abre el diálogo de la billetera para desbloquearla (firmar). */
  onUnlock?: () => void
  /** Muestra el aviso de qué pasa al desvincular (sólo donde existe "Desvincular"). */
  showUnlinkWarning?: boolean
}

/**
 * Acciones de la cuenta con varias billeteras (R-#265 §3.2): **vincular** la billetera
 * activa y **invitar** una dirección. Viven en la pestaña "Cuentas" del panel de la
 * billetera y en el perfil, no en la cabecera.
 *
 * "Vincular otra billetera" sólo se muestra si `hasAnotherWallet()` detecta una
 * billetera distinta de la conectada: la de la aplicación, otra cuenta de la externa o
 * un segundo proveedor. Así el botón no promete algo que el dispositivo no tiene.
 *
 * R-#265 §3.3 (decisión del operador, 2026-10-18): al desvincular una billetera se
 * **revocan** las credenciales (SBT) emitidas a ella; el aviso se muestra junto a las
 * acciones cuando el llamador lo pide (`showUnlinkWarning`, sólo en el panel).
 */
export function AccountWalletActions({
  lang = 'en',
  onChanged,
  onUnlock,
  showUnlinkWarning = false,
}: AccountWalletActionsProps) {
  const { status, walletInfo } = useInAppWallet()
  const { address, sessionAddress } = useAuthAddress()
  const { available: externalAvailable, announced } = useExternalProvider()
  const [externalAccounts, setExternalAccounts] = useState<string[]>([])
  const t = createComponentT(lang, {
    en: {
      unlock: 'Unlock your in-app wallet',
      unlinkWarning:
        'Removing a wallet revokes, on chain, the course credentials (SBT) minted to it. Your account keeps the proof and a verifier can re-mint it to another wallet.',
    },
    es: {
      unlock: 'Desbloquear tu billetera',
      unlinkWarning:
        'Desvincular una billetera revoca en la cadena las credenciales (SBT) de cursos emitidas a ella. La cuenta conserva la prueba y el verificador puede reacuñarla a otra billetera.',
    },
  })

  // Cuentas que el sitio ya puede usar sin abrir el diálogo de la billetera externa.
  useEffect(() => {
    const provider = getExternalProvider()
    if (!provider) {
      setExternalAccounts([])
      return
    }
    let cancelled = false
    provider
      .request({ method: 'eth_accounts' })
      .then((accounts) => {
        if (!cancelled && Array.isArray(accounts)) setExternalAccounts(accounts as string[])
      })
      .catch(() => {
        if (!cancelled) setExternalAccounts([])
      })
    return () => { cancelled = true }
  }, [externalAvailable])

  const sessionWallet = sessionAddress || address || ''
  const showLink = hasAnotherWallet({
    sessionAddress: sessionWallet,
    inAppAddress: walletInfo?.address,
    hasInAppWallet: status === 'locked' || status === 'unlocked',
    externalAvailable,
    externalAccounts,
    announcedCount: announced.length,
  })

  if (!sessionWallet) return null

  return (
    <div className="flex flex-col items-start gap-2" data-testid="account-wallet-actions">
      {status === 'locked' && onUnlock && (
        <Button
          variant="outline"
          size="sm"
          data-testid="wallet-unlock-from-panel"
          onClick={onUnlock}
          className="text-xs"
        >
          {t('unlock')}
        </Button>
      )}
      {showLink && <LinkWalletButton lang={lang} onLinked={onChanged} align="start" />}
      <InviteWalletControl lang={lang} onChanged={onChanged} align="start" />
      {showUnlinkWarning && (
        <p className="text-xs text-muted-foreground" data-testid="wallet-unlink-warning">
          {t('unlinkWarning')}
        </p>
      )}
    </div>
  )
}
