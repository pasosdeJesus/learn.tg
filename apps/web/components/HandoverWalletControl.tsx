'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import { Input } from '@pasosdejesus/m/shadcn-components/ui/input'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { useWalletProvider } from '@/lib/hooks/useWalletProvider'
import { signSiweForAddress, SiweSignError } from '@/lib/siwe-sign'
import {
  acceptHandoverRequest,
  cancelHandoverRequest,
  fetchWalletOverview,
  requestHandover,
  type ReceivedHandover,
} from '@/lib/wallet-account'

interface HandoverWalletControlProps {
  lang?: string
  /** Refresca la lista de billeteras tras una solicitud aceptada. */
  onChanged?: () => void
  /** Abre el diálogo de la billetera in-app para desbloquearla (firmar). */
  onUnlock?: () => void
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-6)}`
}

/**
 * R-#288: the in-app wallet joins an existing, verified account.
 *
 * Two sides, decided by the server:
 * - the **duplicate** (unverified in-app account) requests the handover by typing the
 *   wallet address of the verified account;
 * - the **verified** account sees the pending requests addressed to its wallets and
 *   accepts by signing a SIWE with the session wallet. Accepting moves the in-app
 *   wallet into this account and deletes the duplicate account and its data.
 */
export function HandoverWalletControl({ lang = 'en', onChanged, onUnlock }: HandoverWalletControlProps) {
  const { sessionAddress, address, inAppAddress, isInAppUnlocked } = useAuthAddress()
  const { provider } = useWalletProvider()
  const sessionWallet = sessionAddress || address || ''

  const [received, setReceived] = useState<ReceivedHandover[]>([])
  const [verified, setVerified] = useState<boolean | null>(null)
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const t = createComponentT(lang, {
    en: {
      bring: 'I already have a verified account',
      bringHelp:
        'Add this wallet to your existing verified account. The verified account keeps its progress and you keep using this wallet.',
      addressLabel: 'Wallet address of your verified account',
      placeholder: '0x…',
      send: 'Send request',
      sending: 'Sending…',
      sent:
        'Request sent. Sign in with your verified wallet on its device (or switch to it) and accept there.',
      pending: 'Requests to join this account',
      pendingHelp:
        'Accepting adds that wallet here and deletes the other account and its data.',
      accept: 'Accept and add the wallet',
      accepting: 'Accepting…',
      accepted: 'Wallet added. This account is unchanged; the other account was deleted.',
      dismiss: 'Dismiss',
      dismissing: 'Dismissing…',
      dismissed: 'Request dismissed.',
      unlock: 'Unlock your wallet to sign',
      invalid: 'Enter a valid wallet address.',
      unauthorized: 'Sign in first.',
      unverified: 'The account of that wallet is not verified yet.',
      hasValue:
        'This account already holds transactions or credentials; a verifier must resolve it.',
      conflict: 'That wallet already belongs to another account or has a pending request.',
      canceled: 'The signature was cancelled.',
      failed: 'The operation could not be completed. Try again.',
    },
    es: {
      bring: 'Ya tengo una cuenta verificada',
      bringHelp:
        'Agrega esta billetera a tu cuenta verificada. La cuenta verificada conserva su avance y tú sigues usando esta billetera.',
      addressLabel: 'Dirección de la billetera de tu cuenta verificada',
      placeholder: '0x…',
      send: 'Enviar solicitud',
      sending: 'Enviando…',
      sent:
        'Solicitud enviada. Ingresa con tu billetera verificada en su dispositivo (o cambia a ella) y acepta allí.',
      pending: 'Solicitudes para unirse a esta cuenta',
      pendingHelp:
        'Al aceptar, esa billetera se agrega aquí y se borra la otra cuenta con sus datos.',
      accept: 'Aceptar y agregar la billetera',
      accepting: 'Aceptando…',
      accepted: 'Billetera agregada. Esta cuenta no cambió; la otra cuenta fue borrada.',
      dismiss: 'Descartar',
      dismissing: 'Descartando…',
      dismissed: 'Solicitud descartada.',
      unlock: 'Desbloquea tu billetera para firmar',
      invalid: 'Escribe una dirección de billetera válida.',
      unauthorized: 'Inicia sesión primero.',
      unverified: 'La cuenta de esa billetera aún no está verificada.',
      hasValue:
        'Esta cuenta ya tiene transacciones o credenciales; debe resolverlo un verificador.',
      conflict: 'Esa billetera ya está en otra cuenta o tiene una solicitud pendiente.',
      canceled: 'Se canceló la firma.',
      failed: 'No se pudo completar la operación. Intenta de nuevo.',
    },
  })

  const refresh = useCallback(async () => {
    if (!sessionWallet) {
      setReceived([])
      setVerified(null)
      return
    }
    const overview = await fetchWalletOverview(sessionWallet)
    setReceived(overview?.receivedInvitations ?? [])
    setVerified(overview?.verified ?? null)
  }, [sessionWallet])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleRequest = useCallback(async () => {
    if (!sessionWallet) { setMessage(t('unauthorized')); return }
    const wallet = target.trim()
    if (!wallet) { setMessage(t('invalid')); return }
    setBusy(true)
    setMessage('')
    const result = await requestHandover(sessionWallet, wallet)
    if (result.ok) {
      setTarget('')
      setMessage(t('sent'))
      onChanged?.()
    } else {
      setMessage(
        result.reason === 'unverified'
          ? t('unverified')
          : result.reason === 'conflict'
            ? t('conflict')
            : result.reason === 'invalid'
              ? t('invalid')
              : result.reason === 'unauthorized'
                ? t('unauthorized')
                : t('failed'),
      )
    }
    setBusy(false)
  }, [onChanged, sessionWallet, t, target])

  const handleAccept = useCallback(async () => {
    if (!sessionWallet) { setMessage(t('unauthorized')); return }
    // The signature must come from the wallet in session. If it is the in-app wallet and
    // it is locked, the effective provider is the external one; ask for the unlock first.
    const sessionIsInApp = inAppAddress?.toLowerCase() === sessionWallet.toLowerCase()
    if (sessionIsInApp && !isInAppUnlocked) {
      setMessage(t('unlock'))
      onUnlock?.()
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const { message: siweMessage, signature } = await signSiweForAddress(provider, sessionWallet)
      const result = await acceptHandoverRequest(siweMessage, signature)
      if (result.ok) {
        setMessage(t('accepted'))
        await refresh()
        onChanged?.()
      } else {
        setMessage(
          result.reason === 'target-not-verified'
            ? t('unverified')
            : result.reason === 'duplicate-has-value'
              ? t('hasValue')
              : result.reason === 'same-account'
                ? t('conflict')
                : result.reason === 'no-invitation'
                  ? t('failed')
                  : t('failed'),
        )
      }
    } catch (error) {
      if (error instanceof SiweSignError) {
        setMessage(
          error.code === 'cancelled'
            ? t('canceled')
            : error.code === 'wrong-account' || error.code === 'no-provider'
              ? t('unlock')
              : t('failed'),
        )
        if (error.code === 'no-provider' || error.code === 'wrong-account') onUnlock?.()
      } else {
        setMessage(t('failed'))
      }
    } finally {
      setBusy(false)
    }
  }, [inAppAddress, isInAppUnlocked, onChanged, onUnlock, provider, refresh, sessionWallet, t])

  const handleDismiss = useCallback(
    async (requestId: number) => {
      if (!sessionWallet) { setMessage(t('unauthorized')); return }
      setBusy(true)
      setMessage('')
      const result = await cancelHandoverRequest(sessionWallet, requestId)
      if (result.ok) {
        setMessage(t('dismissed'))
        await refresh()
      } else {
        setMessage(t('failed'))
      }
      setBusy(false)
    },
    [refresh, sessionWallet, t],
  )

  if (!sessionWallet) return null

  return (
    <div className="flex flex-col items-start gap-2" data-testid="handover-wallet-control">
      {received.length > 0 && (
        <div
          className="w-full space-y-1 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs"
          data-testid="handover-requests"
        >
          <p className="font-medium">{t('pending')}</p>
          <p className="text-muted-foreground">{t('pendingHelp')}</p>
          <ul className="space-y-1">
            {received.map((request) => (
              <li key={request.id} className="flex flex-col gap-1" data-testid="handover-request">
                <span>{shortAddress(request.duplicate_wallet || request.direccion_invitada)}</span>
                <Button
                  size="sm"
                  data-testid="handover-accept"
                  disabled={busy}
                  onClick={() => void handleAccept()}
                >
                  {busy ? t('accepting') : t('accept')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="handover-dismiss"
                  disabled={busy}
                  onClick={() => void handleDismiss(request.id)}
                >
                  {busy ? t('dismissing') : t('dismiss')}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {verified === false && (
        <div className="flex flex-col items-start gap-1">
          <Button
            variant="outline"
            size="sm"
            data-testid="handover-open"
            onClick={() => setOpen((value) => !value)}
          >
            {t('bring')}
          </Button>
          {open && (
            <div
              className="flex w-full flex-col items-start gap-1 rounded-md border p-2 text-xs"
              data-testid="handover-form"
            >
              <p className="text-muted-foreground">{t('bringHelp')}</p>
              <label htmlFor="handover-address" className="font-medium">
                {t('addressLabel')}
              </label>
              <Input
                id="handover-address"
                data-testid="handover-address"
                value={target}
                placeholder={t('placeholder')}
                onChange={(event) => setTarget(event.target.value)}
                autoComplete="off"
              />
              <Button
                size="sm"
                data-testid="handover-send"
                disabled={busy}
                onClick={() => void handleRequest()}
              >
                {busy ? t('sending') : t('send')}
              </Button>
            </div>
          )}
        </div>
      )}

      {message && (
        <p className="text-xs text-muted-foreground" data-testid="handover-message">
          {message}
        </p>
      )}
    </div>
  )
}
