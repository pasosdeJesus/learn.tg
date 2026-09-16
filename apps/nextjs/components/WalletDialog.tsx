'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@pasosdejesus/m/shadcn-components/ui/dialog'
import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import { Input } from '@pasosdejesus/m/shadcn-components/ui/input'
import { useInAppWallet } from '@learn-tg/pdj-wallet-next'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { signInWithInAppWallet } from '@/lib/in-app-siwe'

interface WalletDialogProps {
  lang?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const MIN_PIN = 6

/**
 * Modal que crea, importa o desbloquea la billetera de la aplicación y firma el
 * SIWE (R-#244). Vive fuera de la cabecera a propósito: el flujo completo
 * (PIN, frase de recuperación, ingreso) no cabe ahí y el usuario necesita leer
 * las 12 palabras con calma antes de continuar.
 */
export function WalletDialog({ lang = 'en', open, onOpenChange }: WalletDialogProps) {
  const { status, walletInfo, error, create, importExisting, unlock, remove, getProvider } = useInAppWallet()
  const [mode, setMode] = useState<'create' | 'import'>('create')
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [mnemonic, setMnemonic] = useState('')
  const [recovery, setRecovery] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const t = useMemo(() => createComponentT(lang, {
    en: {
      title: 'In-app wallet',
      createTitle: 'Create a wallet',
      createDescription: 'It is created on this device and protected with a PIN. No wallet app is needed.',
      importTitle: 'Import a wallet',
      importDescription: 'Use the 12 words or the private key of a wallet you already have.',
      lockedTitle: 'Unlock your in-app wallet',
      lockedDescription: 'Enter your PIN to sign in.',
      pin: 'PIN (6 or more digits)',
      pinConfirm: 'Repeat the PIN',
      mnemonic: 'Recovery phrase (12 words)',
      create: 'Create wallet',
      import: 'Import wallet',
      unlock: 'Unlock',
      back: 'Back',
      close: 'Close',
      signIn: 'Sign in',
      signingIn: 'Signing in...',
      recoveryTitle: 'Write down these 12 words',
      recoveryDescription: 'They are the only way to recover your wallet on another device. Nobody else can see them: keep them offline.',
      copy: 'Copy',
      copied: 'Copied',
      recoveryConfirm: 'I saved them, sign in',
      pinTooShort: 'The PIN needs at least 6 digits.',
      pinMismatch: 'The two PINs do not match.',
      notUnlocked: 'The wallet is not unlocked.',
      noAccounts: 'The wallet has no account.',
      noCsrf: 'Could not start the session. Try again.',
      authFailed: 'The signature was rejected. Try again.',
      unknownError: 'Something went wrong. Try again.',
      address: 'Address',
      deleteWallet: 'Delete wallet',
    },
    es: {
      title: 'Billetera de la aplicación',
      createTitle: 'Crear una billetera',
      createDescription: 'Se crea en este dispositivo y se protege con un PIN. No necesitas una aplicación de billetera.',
      importTitle: 'Importar una billetera',
      importDescription: 'Usa las 12 palabras o la clave privada de una billetera que ya tengas.',
      lockedTitle: 'Desbloquea tu billetera',
      lockedDescription: 'Escribe tu PIN para ingresar.',
      pin: 'PIN (6 o más dígitos)',
      pinConfirm: 'Repite el PIN',
      mnemonic: 'Frase de recuperación (12 palabras)',
      create: 'Crear billetera',
      import: 'Importar billetera',
      unlock: 'Desbloquear',
      back: 'Volver',
      close: 'Cerrar',
      signIn: 'Ingresar',
      signingIn: 'Ingresando...',
      recoveryTitle: 'Anota estas 12 palabras',
      recoveryDescription: 'Son la única forma de recuperar tu billetera en otro dispositivo. Nadie más puede verlas: guárdalas sin conexión.',
      copy: 'Copiar',
      copied: 'Copiado',
      recoveryConfirm: 'Ya las guardé, ingresar',
      pinTooShort: 'El PIN necesita al menos 6 dígitos.',
      pinMismatch: 'Los dos PIN no coinciden.',
      notUnlocked: 'La billetera no está desbloqueada.',
      noAccounts: 'La billetera no tiene cuenta.',
      noCsrf: 'No se pudo iniciar la sesión. Intenta de nuevo.',
      authFailed: 'La firma fue rechazada. Intenta de nuevo.',
      unknownError: 'Algo salió mal. Intenta de nuevo.',
      address: 'Dirección',
      deleteWallet: 'Borrar billetera',
    },
  }), [lang])

  // Al cerrar, el flujo vuelve a empezar: sin esto el modal reabría en la
  // pantalla de la frase de recuperación (el operador lo reportó el 2026-09-15)
  // y parecía que no se podía desbloquear la billetera recién creada.
  useEffect(() => {
    if (open) return
    setMode('create')
    setPin('')
    setConfirm('')
    setMnemonic('')
    setRecovery(null)
    setLocalError(null)
    setBusy(false)
  }, [open])

  const translateError = useCallback((raw: unknown) => {
    const code = raw instanceof Error ? raw.message : String(raw)
    if (code === 'no-accounts') return t('noAccounts')
    if (code === 'no-csrf') return t('noCsrf')
    if (code === 'auth-failed') return t('authFailed')
    return code || t('unknownError')
  }, [t])

  const signIn = useCallback(async () => {
    setLocalError(null)
    setBusy(true)
    try {
      const provider = getProvider()
      if (!provider) throw new Error(t('notUnlocked'))
      await signInWithInAppWallet(provider)
      onOpenChange(false)
      // NextAuth lee la cookie de sesión al montar (mismo patrón que
      // ConnectWalletButton: `update()` no es fiable tras el callback).
      window.location.reload()
    } catch (e) {
      setLocalError(translateError(e))
      setBusy(false)
    }
  }, [getProvider, onOpenChange, t, translateError])

  const handleCreate = useCallback(async () => {
    setLocalError(null)
    if (pin.length < MIN_PIN) { setLocalError(t('pinTooShort')); return }
    if (pin !== confirm) { setLocalError(t('pinMismatch')); return }
    setBusy(true)
    try {
      const result = await create(pin)
      setRecovery(result.mnemonic)
      setPin('')
      setConfirm('')
    } catch (e) {
      setLocalError(translateError(e))
    } finally {
      setBusy(false)
    }
  }, [confirm, create, pin, t, translateError])

  const handleImport = useCallback(async () => {
    setLocalError(null)
    if (pin.length < MIN_PIN) { setLocalError(t('pinTooShort')); return }
    setBusy(true)
    try {
      await importExisting({ pin, mnemonic: mnemonic.trim() })
      await signIn()
    } catch (e) {
      setLocalError(translateError(e))
      setBusy(false)
    }
  }, [importExisting, mnemonic, pin, signIn, t, translateError])

  const handleUnlock = useCallback(async () => {
    setLocalError(null)
    if (pin.length < MIN_PIN) { setLocalError(t('pinTooShort')); return }
    setBusy(true)
    try {
      await unlock(pin)
      await signIn()
    } catch (e) {
      setLocalError(translateError(e))
      setBusy(false)
    }
  }, [pin, signIn, t, translateError, unlock])

  const handleDelete = useCallback(async () => {
    setLocalError(null)
    setBusy(true)
    try {
      await remove()
      localStorage.removeItem('learn.tg.sessionAddress')
      onOpenChange(false)
    } catch (e) {
      setLocalError(translateError(e))
    } finally {
      setBusy(false)
    }
  }, [onOpenChange, remove, translateError])

  const handleCopy = useCallback(async () => {
    if (!recovery) return
    try {
      await navigator.clipboard?.writeText(recovery)
    } catch {
      // el portapapeles puede estar bloqueado; el usuario copia a mano
    }
  }, [recovery])

  const showRecovery = recovery !== null
  const showUnlock = !showRecovery && status === 'locked'
  const message = localError ?? error

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="wallet-dialog">
        <DialogHeader>
          <DialogTitle>
            {showRecovery
              ? t('recoveryTitle')
              : showUnlock
                ? t('lockedTitle')
                : mode === 'create' ? t('createTitle') : t('importTitle')}
          </DialogTitle>
          <DialogDescription>
            {showRecovery
              ? t('recoveryDescription')
              : showUnlock
                ? t('lockedDescription')
                : mode === 'create' ? t('createDescription') : t('importDescription')}
          </DialogDescription>
        </DialogHeader>

        {showRecovery ? (
          <div className="py-4 space-y-3">
            <ol
              data-testid="wallet-recovery-words"
              className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm bg-gray-50 border rounded p-3"
            >
              {recovery.split(' ').map((word, index) => (
                <li key={`${index}-${word}`} className="flex gap-2">
                  <span className="text-gray-500">{index + 1}.</span>
                  <span className="font-mono">{word}</span>
                </li>
              ))}
            </ol>
            <Button variant="outline" onClick={() => { void handleCopy() }} data-testid="wallet-copy-recovery">
              {t('copy')}
            </Button>
          </div>
        ) : (
          <div className="py-4 space-y-3">
            {!showUnlock && (
              <div role="group" className="flex gap-2">
                <Button
                  variant={mode === 'create' ? 'default' : 'outline'}
                  data-testid="wallet-mode-create"
                  onClick={() => setMode('create')}
                >
                  {t('create')}
                </Button>
                <Button
                  variant={mode === 'import' ? 'default' : 'outline'}
                  data-testid="wallet-mode-import"
                  onClick={() => setMode('import')}
                >
                  {t('import')}
                </Button>
              </div>
            )}

            {!showUnlock && mode === 'import' && (
              <label className="block space-y-1">
                <span className="text-sm font-medium">{t('mnemonic')}</span>
                <Input
                  data-testid="wallet-mnemonic"
                  value={mnemonic}
                  onChange={(event) => setMnemonic(event.target.value)}
                />
              </label>
            )}

            <label className="block space-y-1">
              <span className="text-sm font-medium">{t('pin')}</span>
              <Input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                data-testid="wallet-pin"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
              />
            </label>

            {!showUnlock && mode === 'create' && (
              <label className="block space-y-1">
                <span className="text-sm font-medium">{t('pinConfirm')}</span>
                <Input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  data-testid="wallet-pin-confirm"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </label>
            )}

            {walletInfo?.address && (
              <p className="text-sm text-gray-600" data-testid="wallet-address">
                {t('address')}: <span className="font-mono">{walletInfo.address}</span>
              </p>
            )}

            {!showUnlock && walletInfo?.address && (
              <Button
                variant="outline"
                size="sm"
                data-testid="wallet-delete"
                onClick={() => { void handleDelete() }}
                disabled={busy}
              >
                {t('deleteWallet')}
              </Button>
            )}
          </div>
        )}

        {message && (
          <p role="alert" data-testid="wallet-dialog-error" className="text-sm text-red-700">
            {message}
          </p>
        )}

        <DialogFooter>
          {showRecovery ? (
            <Button data-testid="wallet-signin" onClick={() => { void signIn() }} disabled={busy}>
              {busy ? t('signingIn') : t('recoveryConfirm')}
            </Button>
          ) : showUnlock ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('close')}
              </Button>
              <Button data-testid="wallet-unlock" onClick={() => { void handleUnlock() }} disabled={busy}>
                {busy ? t('signingIn') : t('unlock')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('close')}
              </Button>
              {mode === 'create' ? (
                <Button data-testid="wallet-create" onClick={() => { void handleCreate() }} disabled={busy}>
                  {busy ? '...' : t('create')}
                </Button>
              ) : (
                <Button data-testid="wallet-import" onClick={() => { void handleImport() }} disabled={busy || !mnemonic.trim()}>
                  {busy ? t('signingIn') : t('import')}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
