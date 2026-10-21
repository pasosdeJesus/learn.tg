'use client'

import { useEffect, useState } from 'react'
import { adminFetch } from '@/lib/admin-fetch'
import { Button } from '@/components/ui/button'

export interface AdminWalletItem {
  id: number
  billetera: string
  linked_at?: string | null
}

export interface AdminCredentialItem {
  token_id: number
  course_id: number
  course_name?: string | null
  billetera?: string | null
  revoked_at?: string | null
  emitted_at?: string | null
}

interface AdminCredentialsSectionProps {
  lang: string
  userId: number
  wallets: AdminWalletItem[]
  credentials: AdminCredentialItem[]
}

function short(address?: string | null): string {
  if (!address) return '—'
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/**
 * Billeteras y credenciales de una cuenta (R-#265 §3.5/§3.7).
 *
 * La credencial sigue a la **billetera** que completó el curso. Si esa billetera se
 * pierde o se compromete, el verificador revoca el SBT y lo re-acuña a otra billetera
 * **de la misma cuenta**; ambas acciones quedan en `userevent`
 * (`/api/admin/credentials/revoke|re-mint`). Un SBT es soulbound: quien roba la llave
 * no puede moverlo, pero sí quedarse como su titular.
 */
export function AdminCredentialsSection({
  lang,
  userId,
  wallets,
  credentials,
}: AdminCredentialsSectionProps) {
  const [rows, setRows] = useState<AdminCredentialItem[]>(credentials)
  const [busy, setBusy] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [targets, setTargets] = useState<Record<number, string>>({})

  const es = lang === 'es'

  // El modal pide las billeteras/credenciales al abrirse: cuando llegan, la sección
  // debe reflejarlas (el estado local solo guarda las acciones hechas aquí).
  useEffect(() => { setRows(credentials) }, [credentials])

  async function revoke(row: AdminCredentialItem) {
    setBusy(row.token_id)
    setMessage('')
    try {
      await adminFetch('/api/admin/credentials/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          tokenId: row.token_id,
          wallet: row.billetera || undefined,
        }),
      })
      setRows((current) =>
        current.map((entry) =>
          entry.token_id === row.token_id
            ? { ...entry, revoked_at: new Date().toISOString() }
            : entry,
        ),
      )
      setMessage(es ? 'Credencial revocada.' : 'Credential revoked.')
    } catch (error) {
      setMessage(
        `${es ? 'No se pudo revocar' : 'Could not revoke'}: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      setBusy(null)
    }
  }

  async function remint(row: AdminCredentialItem) {
    const target = targets[row.token_id]
    if (!target) return
    setBusy(row.token_id)
    setMessage('')
    try {
      const result = await adminFetch<{ txHash?: string | null; alreadyHeld?: boolean }>(
        '/api/admin/credentials/re-mint',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, courseId: row.course_id, wallet: target }),
        },
      )
      setRows((current) =>
        current.map((entry) =>
          entry.token_id === row.token_id
            ? { ...entry, billetera: target.toLowerCase(), revoked_at: null }
            : entry,
        ),
      )
      setMessage(
        result?.alreadyHeld
          ? (es ? 'Esa billetera ya tenía la credencial en cadena.' : 'That wallet already held the credential on-chain.')
          : (es ? 'Credencial re-acuñada.' : 'Credential re-minted.'),
      )
    } catch (error) {
      setMessage(
        `${es ? 'No se pudo re-acuñar' : 'Could not re-mint'}: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      setBusy(null)
    }
  }

  if (wallets.length === 0 && rows.length === 0) return null

  return (
    <div className="mt-6 border-t pt-4" data-testid="admin-credentials">
      <h4 className="text-sm font-semibold text-gray-700 mb-2">
        {es ? 'Billeteras y credenciales' : 'Wallets and credentials'}
      </h4>

      <ul className="mb-3 flex flex-wrap gap-2" data-testid="admin-wallets">
        {wallets.map((wallet) => (
          <li
            key={wallet.id}
            className="rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700"
            title={wallet.billetera}
          >
            {short(wallet.billetera)}
          </li>
        ))}
      </ul>

      {rows.length === 0 ? (
        <p className="text-xs text-gray-500">
          {es ? 'Sin credenciales emitidas.' : 'No credentials minted.'}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map((row) => (
            <li key={row.token_id} className="py-2 text-xs" data-testid="admin-credential">
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-700">
                  {row.course_name || (es ? 'Curso' : 'Course')} #{row.course_id} ·{' '}
                  <span className="font-mono">{short(row.billetera)}</span>
                </span>
                {row.revoked_at ? (
                  <span className="rounded bg-red-50 px-2 py-0.5 text-red-600">
                    {es ? 'Revocada' : 'Revoked'}
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid={`admin-credential-revoke-${row.token_id}`}
                    disabled={busy === row.token_id}
                    onClick={() => { void revoke(row) }}
                    className="text-[11px] text-gray-500 hover:text-red-600"
                  >
                    {es ? 'Revocar' : 'Revoke'}
                  </Button>
                )}
              </div>
              {row.revoked_at && wallets.length > 0 && (
                <div className="mt-1 flex items-center gap-2">
                  <select
                    data-testid={`admin-credential-target-${row.token_id}`}
                    value={targets[row.token_id] || ''}
                    onChange={(event) =>
                      setTargets((current) => ({ ...current, [row.token_id]: event.target.value }))
                    }
                    className="rounded border border-gray-300 px-1 py-0.5 font-mono text-[11px]"
                  >
                    <option value="">{es ? 'Billetera destino…' : 'Target wallet…'}</option>
                    {wallets.map((wallet) => (
                      <option key={wallet.id} value={wallet.billetera}>
                        {short(wallet.billetera)}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="default"
                    size="sm"
                    data-testid={`admin-credential-remint-${row.token_id}`}
                    disabled={busy === row.token_id || !targets[row.token_id]}
                    onClick={() => { void remint(row) }}
                    className="text-[11px]"
                  >
                    {es ? 'Re-acuñar' : 'Re-mint'}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {message && (
        <p className="mt-2 text-[11px] text-gray-600" data-testid="admin-credentials-message">
          {message}
        </p>
      )}
    </div>
  )
}
