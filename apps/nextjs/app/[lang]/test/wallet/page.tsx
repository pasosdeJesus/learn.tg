'use client'

import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { SiweMessage } from 'siwe'
import { getAddress } from 'viem'
import { useInAppWallet } from '@learn-tg/pdj-wallet-next'
import { createComponentT } from '@/lib/hooks/useTranslation'

const CHAIN_IDS: Record<string, number> = { celo: 42220, celoSepolia: 11142220 }

export default function WalletTestPage() {
  const params = useParams<{ lang?: string }>()
  const lang = params?.lang === 'es' ? 'es' : 'en'
  const { status, walletInfo, create, importExisting, unlock, lock, remove, getProvider } = useInAppWallet()
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [mnemonic, setMnemonic] = useState('')
  const [recovery, setRecovery] = useState<string | null>(null)
  const [lines, setLines] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const t = useMemo(() => createComponentT(lang, {
    en: {
      title: 'In-app wallet test page',
      warning: 'Development only. Do not enable in production.',
      status: 'Status',
      pin: 'PIN (6+ digits)',
      pinConfirm: 'Confirm PIN',
      create: 'Create wallet',
      import: 'Import wallet',
      mnemonic: 'Mnemonic (import only)',
      unlock: 'Unlock',
      lock: 'Lock',
      signIn: 'Sign in with SIWE',
      remove: 'Delete wallet',
      recovery: 'Recovery phrase (write it down)',
      log: 'Log',
      unavailable: 'This page is disabled on the production network.',
    },
    es: {
      title: 'Página de prueba de la billetera de la aplicación',
      warning: 'Solo desarrollo. No habilitar en producción.',
      status: 'Estado',
      pin: 'PIN (6 o más dígitos)',
      pinConfirm: 'Confirmar PIN',
      create: 'Crear billetera',
      import: 'Importar billetera',
      mnemonic: 'Mnemónico (solo para importar)',
      unlock: 'Desbloquear',
      lock: 'Bloquear',
      signIn: 'Ingresar con SIWE',
      remove: 'Borrar billetera',
      recovery: 'Frase de recuperación (anótala)',
      log: 'Bitácora',
      unavailable: 'Esta página está deshabilitada en la red de producción.',
    },
  }), [lang])

  const network = process.env.NEXT_PUBLIC_NETWORK || 'celoSepolia'
  const isProductionNetwork = network === 'celo'

  const append = (line: string) => setLines((previous) => [...previous, line])

  async function guarded(action: () => Promise<void>) {
    setBusy(true)
    try {
      await action()
    } catch (error) {
      append(`ERROR ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const onCreate = () => guarded(async () => {
    const result = await create(pin)
    setRecovery(result.mnemonic)
    setPin('')
    setConfirm('')
    append(`OK wallet created ${result.walletInfo.address}`)
  })

  const onImport = () => guarded(async () => {
    const info = await importExisting({ pin, mnemonic: mnemonic.trim() })
    setPin('')
    append(`OK wallet imported ${info.address}`)
  })

  const onUnlock = () => guarded(async () => {
    const info = await unlock(pin)
    setPin('')
    append(`OK wallet unlocked ${info.address}`)
  })

  const onLock = () => guarded(async () => {
    await lock()
    append('OK wallet locked')
  })

  const onRemove = () => guarded(async () => {
    await remove()
    localStorage.removeItem('learn.tg.sessionAddress')
    setRecovery(null)
    append('OK wallet deleted')
  })

  const onSignIn = () => guarded(async () => {
    const provider = getProvider()
    if (!provider) throw new Error('wallet is not unlocked')

    const accounts = (await provider.request({ method: 'eth_accounts' })) as string[]
    const address = accounts[0]
    if (!address) throw new Error('no accounts from the in-app wallet')

    const csrfRes = await fetch('/api/auth/csrf')
    const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string }
    if (!csrfToken) throw new Error('could not get the CSRF token')

    const msg = new SiweMessage({
      domain: window.location.host,
      address: getAddress(address),
      statement: 'Sign in to Learn through games.',
      uri: window.location.origin,
      version: '1',
      chainId: CHAIN_IDS[network] ?? 11142220,
      nonce: csrfToken,
    })
    const message = msg.prepareMessage()
    const signature = (await provider.request({
      method: 'personal_sign',
      params: [message, address],
    })) as string

    const body = new URLSearchParams({
      csrfToken,
      message,
      signature,
      redirect: 'false',
      json: 'true',
    })
    const callback = await fetch('/api/auth/callback/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    if (!callback.ok) throw new Error(`authentication failed (${callback.status})`)

    localStorage.setItem('learn.tg.sessionAddress', getAddress(address))
    append(`OK signed in as ${address}`)
  })

  if (isProductionNetwork) {
    return (
      <main className="max-w-xl mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold mb-4">{t('title')}</h1>
        <p>{t('unavailable')}</p>
      </main>
    )
  }

  return (
    <main className="max-w-xl mx-auto px-4 py-16" data-testid="wallet-test-page">
      <h1 className="text-2xl font-bold mb-2">{t('title')}</h1>
      <p className="text-sm text-amber-800 bg-amber-100 px-3 py-2 rounded mb-6">
        {t('warning')}
      </p>

      <p className="mb-4">
        {t('status')}: <code data-testid="wallet-status">{status}</code>
        {walletInfo?.address ? (
          <>
            {' '}
            <code data-testid="wallet-address">{walletInfo.address}</code>
          </>
        ) : null}
      </p>

      <div className="flex flex-col gap-3 mb-6">
        {status !== 'unlocked' && (
          <>
            <label className="flex flex-col gap-1">
              {t('pin')}
              <input
                type="password"
                inputMode="numeric"
                data-testid="wallet-pin"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                className="border px-2 py-1"
              />
            </label>
            {status === 'no-wallet' && (
              <>
                <label className="flex flex-col gap-1">
                  {t('pinConfirm')}
                  <input
                    type="password"
                    inputMode="numeric"
                    data-testid="wallet-pin-confirm"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    className="border px-2 py-1"
                  />
                </label>
                <button
                  type="button"
                  data-testid="wallet-create"
                  onClick={onCreate}
                  disabled={busy || pin.length < 6 || pin !== confirm}
                  className="px-4 py-2 rounded bg-emerald-700 text-white disabled:opacity-50"
                >
                  {t('create')}
                </button>
                <label className="flex flex-col gap-1">
                  {t('mnemonic')}
                  <textarea
                    data-testid="wallet-mnemonic"
                    value={mnemonic}
                    onChange={(event) => setMnemonic(event.target.value)}
                    className="border px-2 py-1"
                    rows={2}
                  />
                </label>
                <button
                  type="button"
                  data-testid="wallet-import"
                  onClick={onImport}
                  disabled={busy || pin.length < 6 || !mnemonic.trim()}
                  className="px-4 py-2 rounded border border-emerald-700 disabled:opacity-50"
                >
                  {t('import')}
                </button>
              </>
            )}
            {status === 'locked' && (
              <button
                type="button"
                data-testid="wallet-unlock"
                onClick={onUnlock}
                disabled={busy || pin.length < 6}
                className="px-4 py-2 rounded bg-emerald-700 text-white disabled:opacity-50"
              >
                {t('unlock')}
              </button>
            )}
          </>
        )}

        {status === 'unlocked' && (
          <>
            <button
              type="button"
              data-testid="wallet-signin"
              onClick={onSignIn}
              disabled={busy}
              className="px-4 py-2 rounded bg-emerald-700 text-white disabled:opacity-50"
            >
              {t('signIn')}
            </button>
            <button
              type="button"
              data-testid="wallet-lock"
              onClick={onLock}
              disabled={busy}
              className="px-4 py-2 rounded border border-emerald-700 disabled:opacity-50"
            >
              {t('lock')}
            </button>
            <button
              type="button"
              data-testid="wallet-remove"
              onClick={onRemove}
              disabled={busy}
              className="px-4 py-2 rounded border border-red-700 text-red-700 disabled:opacity-50"
            >
              {t('remove')}
            </button>
          </>
        )}
      </div>

      {recovery && (
        <div data-testid="wallet-recovery" className="mb-6 text-sm">
          <p className="font-semibold">{t('recovery')}</p>
          <code>{recovery}</code>
        </div>
      )}

      <h2 className="font-semibold mb-2">{t('log')}</h2>
      <pre
        data-testid="wallet-log"
        className="bg-black text-emerald-200 text-xs p-3 rounded min-h-16 whitespace-pre-wrap"
      >
        {lines.join('\n')}
      </pre>
    </main>
  )
}
