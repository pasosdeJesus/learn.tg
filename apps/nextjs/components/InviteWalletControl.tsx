'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { createComponentT } from '@/lib/hooks/useTranslation'
import {
  cancelInvitationRequest,
  fetchAccountInvitations,
  inviteWalletAddress,
  type AccountInvitation,
} from '@/lib/wallet-account'

interface InviteWalletControlProps {
  lang?: string
  /** Se dispara cuando cambia la lista de invitaciones (por ejemplo, al aceptar otra). */
  onChanged?: () => void
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/**
 * Invitar una billetera a la cuenta, para el caso **entre dispositivos** (R-#265 §3.2).
 *
 * `LinkWalletButton` firma con la billetera activa **en el acto**; aquí se invita una
 * **dirección**: la otra persona abre learn.tg en su propio dispositivo, firma y acepta
 * al entrar. La invitación se lista y se puede cancelar (liberar el cupo de la dirección).
 * La cuenta que invita debe tener perfil suficiente (`lib/wallet-invite-policy.ts`).
 */
export function InviteWalletControl({ lang = 'en', onChanged }: InviteWalletControlProps) {
  const { sessionAddress } = useAuthAddress()
  const sessionWallet = sessionAddress || ''
  const [open, setOpen] = useState(false)
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [invitations, setInvitations] = useState<AccountInvitation[]>([])

  const t = createComponentT(lang, {
    en: {
      invite: 'Invite a wallet',
      addressLabel: 'Wallet address',
      placeholder: '0x…',
      sendInvite: 'Send invite',
      inviting: 'Inviting…',
      cancel: 'Cancel',
      invited:
        'Invitation created. That wallet can accept it when it signs in on its own device.',
      unverified: 'Your profile needs at least 50 points before you can invite a wallet.',
      conflict: 'That wallet is already in an account or has a pending invitation.',
      invalid: 'Enter a valid wallet address.',
      unauthorized: 'Sign in first.',
      failed: 'The invitation could not be created. Try again.',
      cancelled: 'Invitation cancelled.',
      cancelFailed: 'The invitation could not be cancelled. Try again.',
      pending: 'Pending invitations',
      none: 'No pending invitations.',
    },
    es: {
      invite: 'Invitar billetera',
      addressLabel: 'Dirección de la billetera',
      placeholder: '0x…',
      sendInvite: 'Enviar invitación',
      inviting: 'Invitando…',
      cancel: 'Cancelar',
      invited:
        'Invitación creada. Esa billetera puede aceptarla cuando ingrese desde su propio dispositivo.',
      unverified: 'Tu perfil necesita al menos 50 puntos para invitar una billetera.',
      conflict: 'Esa billetera ya está en una cuenta o tiene una invitación pendiente.',
      invalid: 'Escribe una dirección de billetera válida.',
      unauthorized: 'Inicia sesión primero.',
      failed: 'No se pudo crear la invitación. Intenta de nuevo.',
      cancelled: 'Invitación cancelada.',
      cancelFailed: 'No se pudo cancelar la invitación. Intenta de nuevo.',
      pending: 'Invitaciones pendientes',
      none: 'No hay invitaciones pendientes.',
    },
  })

  const refresh = useCallback(async () => {
    if (!sessionWallet) { setInvitations([]); return }
    const list = await fetchAccountInvitations(sessionWallet)
    setInvitations(list ?? [])
  }, [sessionWallet])

  useEffect(() => {
    if (open) void refresh()
  }, [open, refresh])

  const handleInvite = useCallback(async () => {
    if (!sessionWallet) { setMessage(t('unauthorized')); return }
    const target = address.trim()
    if (!target) { setMessage(t('invalid')); return }
    setBusy(true)
    setMessage('')
    const result = await inviteWalletAddress(sessionWallet, target)
    if (result.ok) {
      setInvitations(result.invitations)
      setAddress('')
      setMessage(t('invited'))
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
  }, [address, onChanged, sessionWallet, t])

  const handleCancel = useCallback(async (target: string) => {
    if (!sessionWallet) return
    setBusy(true)
    setMessage('')
    const result = await cancelInvitationRequest(sessionWallet, target)
    if (result.ok) {
      setInvitations(result.invitations)
      setMessage(result.cancelled ? t('cancelled') : t('none'))
      onChanged?.()
    } else {
      setMessage(t('cancelFailed'))
    }
    setBusy(false)
  }, [onChanged, sessionWallet, t])

  if (!sessionWallet) return null

  return (
    <span className="relative flex flex-col items-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        data-testid="wallet-invite-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="text-xs text-gray-600 hover:bg-gray-100"
      >
        {t('invite')}
        {invitations.length > 0 ? ` (${invitations.length})` : ''}
      </Button>
      {open && (
        <div
          data-testid="wallet-invite-panel"
          className="absolute right-0 top-full z-50 mt-1 w-72 rounded-md border border-gray-200 bg-white p-3 text-left shadow-lg"
        >
          <label className="block text-xs font-medium text-gray-700" htmlFor="wallet-invite-address">
            {t('addressLabel')}
          </label>
          <input
            id="wallet-invite-address"
            data-testid="wallet-invite-address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder={t('placeholder')}
            autoComplete="off"
            spellCheck={false}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 font-mono text-xs"
          />
          <Button
            variant="default"
            size="sm"
            data-testid="wallet-invite-submit"
            disabled={busy || address.trim().length === 0}
            onClick={() => { void handleInvite() }}
            className="mt-2 w-full text-xs"
          >
            {busy ? t('inviting') : t('sendInvite')}
          </Button>

          <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-gray-500">
            {t('pending')}
          </p>
          {invitations.length === 0 ? (
            <p className="text-xs text-gray-500" data-testid="wallet-invite-none">
              {t('none')}
            </p>
          ) : (
            <ul className="mt-1 divide-y divide-gray-100">
              {invitations.map((invitation) => (
                <li
                  key={invitation.id}
                  data-testid="wallet-invitation"
                  className="flex items-center justify-between gap-2 py-1"
                >
                  <span
                    className="font-mono text-xs text-gray-700"
                    title={invitation.direccion_invitada}
                  >
                    {shortAddress(invitation.direccion_invitada)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid="wallet-invite-cancel"
                    disabled={busy}
                    onClick={() => { void handleCancel(invitation.direccion_invitada) }}
                    className="text-[11px] text-gray-500 hover:text-red-600"
                  >
                    {t('cancel')}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {message && (
            <p data-testid="wallet-invite-message" className="mt-2 text-[11px] text-gray-600">
              {message}
            </p>
          )}
        </div>
      )}
    </span>
  )
}
