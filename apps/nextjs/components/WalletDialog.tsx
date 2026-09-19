'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  /**
   * Dirección de la cookie de sesión, si ya hay una. Cuando coincide con la
   * billetera de la aplicación no hace falta volver a firmar el SIWE.
   */
  sessionAddress?: string
}

const MIN_PIN = 6

/**
 * Modal que crea, importa o desbloquea la billetera de la aplicación y firma el
 * SIWE (R-#244). Vive fuera de la cabecera a propósito: el flujo completo
 * (PIN, frase de recuperación, ingreso) no cabe ahí y el usuario necesita leer
 * las 12 palabras con calma antes de continuar.
 */
export function WalletDialog({ lang = 'en', open, onOpenChange, sessionAddress }: WalletDialogProps) {
  const {
    status,
    walletInfo,
    error,
    create,
    importExisting,
    unlock,
    unlockWithBiometric,
    enableBiometric,
    disableBiometric,
    biometricAvailable,
    biometricEnabled,
    remove,
    getProvider,
  } = useInAppWallet()
  const [mode, setMode] = useState<'create' | 'import'>('create')
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [mnemonic, setMnemonic] = useState('')
  const [recovery, setRecovery] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [biometricPin, setBiometricPin] = useState('')
  const [pinFallback, setPinFallback] = useState(false)
  const autoGestureTried = useRef(false)
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
      biometricUnlock: 'Unlock with fingerprint',
      biometricEnable: 'Unlock with fingerprint next time',
      biometricHint: 'Uses the fingerprint or Face ID of this device. The PIN keeps working.',
      biometricOn: 'Fingerprint unlock is on',
      biometricOff: 'Turn off fingerprint unlock',
      noWebauthn: 'This device cannot verify your fingerprint or Face ID.',
      noPrf: 'This device cannot store the biometric unlock. Use your PIN.',
      noBiometric: 'There is no fingerprint unlock saved on this device.',
      biometricCancelled: 'The fingerprint or Face ID prompt was cancelled.',
      invalidMnemonic: 'That recovery phrase is not valid. Check the words and their order.',
      biometricRetry: 'Try the fingerprint again',
      usePin: 'Use the PIN',
      unlockWithPinOnly: 'Use the PIN only',
      lockedDescriptionGesture: 'Confirm with your fingerprint or Face ID to sign in. No PIN to type.',
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
      biometricUnlock: 'Desbloquear con huella',
      biometricEnable: 'Desbloquear con huella la próxima vez',
      biometricHint: 'Usa la huella o Face ID de este dispositivo. El PIN sigue funcionando.',
      biometricOn: 'Desbloqueo con huella activado',
      biometricOff: 'Desactivar el desbloqueo con huella',
      noWebauthn: 'Este dispositivo no puede verificar tu huella o Face ID.',
      noPrf: 'Este dispositivo no puede guardar el desbloqueo por huella. Usa tu PIN.',
      noBiometric: 'No hay un desbloqueo por huella guardado en este dispositivo.',
      biometricCancelled: 'Se canceló la huella o Face ID.',
      invalidMnemonic: 'Esa frase de recuperación no es válida. Revisa las palabras y su orden.',
      biometricRetry: 'Reintentar huella',
      usePin: 'Usar el PIN',
      unlockWithPinOnly: 'Seguir usando solo el PIN',
      lockedDescriptionGesture: 'Confirma con tu huella o Face ID para ingresar. No hay que escribir el PIN.',
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
    setPinFallback(false)
    autoGestureTried.current = false
    setBusy(false)
  }, [open])

  const translateError = useCallback((raw: unknown) => {
    const code = raw instanceof Error ? raw.message : String(raw)
    if (code === 'no-accounts') return t('noAccounts')
    if (code === 'no-csrf') return t('noCsrf')
    if (code === 'auth-failed') return t('authFailed')
    if (code === 'no-webauthn') return t('noWebauthn')
    if (code === 'no-prf') return t('noPrf')
    if (code === 'no-biometric') return t('noBiometric')
    if (code === 'NotAllowedError') return t('biometricCancelled')
    // R-#251: `importWallet` valida BIP39 antes de derivar; una frase con un error
    // de dedo derivaría otra billetera (vacía) sin este aviso.
    if (code === 'invalid-mnemonic') return t('invalidMnemonic')
    return code || t('unknownError')
  }, [t])

  const signIn = useCallback(async () => {
    setLocalError(null)
    setBusy(true)
    try {
      const provider = getProvider()
      if (!provider) throw new Error(t('notUnlocked'))
      // Si la cookie de sesión ya es de esta billetera, firmar de nuevo solo
      // recarga la página y la clave vuelve a salir de memoria: el usuario
      // quedaba en un ciclo desbloquear → recargar → bloqueada y no podía donar
      // ni comprar (reportado el 2026-09-16).
      const sameSession = !!sessionAddress && !!walletInfo?.address
        && sessionAddress.toLowerCase() === walletInfo.address.toLowerCase()
      if (sameSession) {
        setBusy(false)
        onOpenChange(false)
        return
      }
      await signInWithInAppWallet(provider)
      onOpenChange(false)
      // NextAuth lee la cookie de sesión al montar (mismo patrón que
      // ConnectWalletButton: `update()` no es fiable tras el callback).
      window.location.reload()
    } catch (e) {
      setLocalError(translateError(e))
      setBusy(false)
    }
  }, [getProvider, onOpenChange, sessionAddress, t, translateError, walletInfo])

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

  // R-#246: un gesto reemplaza al PIN cuando la clave quedó sellada con el
  // secreto PRF de la passkey. Si el gesto falla o se cancela, el PIN queda a un
  // toque de distancia (`pinFallback`).
  const handleUnlockWithBiometric = useCallback(async () => {
    setLocalError(null)
    setBusy(true)
    try {
      await unlockWithBiometric()
      await signIn()
    } catch (e) {
      setLocalError(translateError(e))
      setPinFallback(true)
      setBusy(false)
    }
  }, [signIn, translateError, unlockWithBiometric])

  // Mismo PIN, un paso extra: además de desbloquear, recuerda el gesto para la
  // próxima vez. `enableBiometric` deja la billetera desbloqueada.
  const handleUnlockAndEnableBiometric = useCallback(async () => {
    setLocalError(null)
    if (pin.length < MIN_PIN) { setLocalError(t('pinTooShort')); return }
    setBusy(true)
    try {
      await enableBiometric(pin)
      await signIn()
    } catch (e) {
      setLocalError(translateError(e))
      setBusy(false)
    }
  }, [enableBiometric, pin, signIn, t, translateError])

  const handleDisableBiometric = useCallback(async () => {
    setLocalError(null)
    setBusy(true)
    try {
      await disableBiometric()
    } catch (e) {
      setLocalError(translateError(e))
    } finally {
      setBusy(false)
    }
  }, [disableBiometric, translateError])

  // Desde el estado ya desbloqueado (billetera recién creada): activar el gesto
  // pide el PIN otra vez porque no se guarda en memoria.
  const handleEnableBiometric = useCallback(async () => {
    setLocalError(null)
    if (biometricPin.length < MIN_PIN) { setLocalError(t('pinTooShort')); return }
    setBusy(true)
    try {
      await enableBiometric(biometricPin)
      setBiometricPin('')
    } catch (e) {
      setLocalError(translateError(e))
    } finally {
      setBusy(false)
    }
  }, [biometricPin, enableBiometric, t, translateError])

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
  // Con la passkey registrada el gesto es el camino principal: el PIN solo
  // aparece si el usuario lo pide o si el gesto falla (R-#246).
  const gestureOnly = showUnlock && biometricEnabled && !pinFallback
  // Al abrir con una passkey registrada se pide el gesto directamente, en lugar
  // de mostrar un campo de PIN que invita a escribir cuando un toque bastaba.
  useEffect(() => {
    if (!open || !showUnlock || !biometricEnabled) return
    if (autoGestureTried.current) return
    autoGestureTried.current = true
    void handleUnlockWithBiometric()
  }, [open, showUnlock, biometricEnabled, handleUnlockWithBiometric])
  // El error del hook también se traduce: los códigos del camino biométrico
  // (`NotAllowedError`, `no-prf`…) no son texto para el usuario.
  const message = localError ?? (error ? translateError(error) : null)

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
                ? gestureOnly ? t('lockedDescriptionGesture') : t('lockedDescription')
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

            {!gestureOnly && (
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
            )}

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

            {!showUnlock && biometricEnabled && (
              <div className="space-y-1">
                <p className="text-sm text-gray-600" data-testid="wallet-biometric-status">
                  {t('biometricOn')}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="wallet-disable-biometric"
                  onClick={() => { void handleDisableBiometric() }}
                  disabled={busy}
                >
                  {t('biometricOff')}
                </Button>
              </div>
            )}

            {/* Recién creada o importada: la billetera está desbloqueada y el PIN
                sigue en memoria del usuario, así que es el momento de activar el
                gesto sin volver a pedirlo más tarde. */}
            {!showUnlock && walletInfo?.address && biometricAvailable && !biometricEnabled && (
              <div className="space-y-1">
                <p className="text-xs text-gray-500" data-testid="wallet-biometric-hint">
                  {t('biometricHint')}
                </p>
                <Input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  data-testid="wallet-biometric-pin"
                  value={biometricPin}
                  onChange={(event) => setBiometricPin(event.target.value)}
                />
                <Button
                  variant="default"
                  size="sm"
                  data-testid="wallet-enable-biometric"
                  onClick={() => { void handleEnableBiometric() }}
                  disabled={busy || biometricPin.length < MIN_PIN}
                >
                  {t('biometricEnable')}
                </Button>
              </div>
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
              {biometricEnabled ? (
                <>
                  {gestureOnly ? (
                    <>
                      <Button
                        variant="outline"
                        data-testid="wallet-use-pin"
                        onClick={() => setPinFallback(true)}
                        disabled={busy}
                      >
                        {t('usePin')}
                      </Button>
                      <Button
                        data-testid="wallet-unlock-biometric"
                        onClick={() => { void handleUnlockWithBiometric() }}
                        disabled={busy}
                      >
                        {busy ? t('signingIn') : t('biometricUnlock')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        data-testid="wallet-unlock-biometric"
                        onClick={() => { void handleUnlockWithBiometric() }}
                        disabled={busy}
                      >
                        {busy ? t('signingIn') : t('biometricRetry')}
                      </Button>
                      <Button data-testid="wallet-unlock" onClick={() => { void handleUnlock() }} disabled={busy}>
                        {busy ? t('signingIn') : t('unlock')}
                      </Button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <Button
                    variant={biometricAvailable ? 'outline' : 'default'}
                    data-testid="wallet-unlock"
                    onClick={() => { void handleUnlock() }}
                    disabled={busy}
                  >
                    {busy ? t('signingIn') : biometricAvailable ? t('unlockWithPinOnly') : t('unlock')}
                  </Button>
                  {biometricAvailable && (
                    <Button
                      data-testid="wallet-enable-biometric"
                      onClick={() => { void handleUnlockAndEnableBiometric() }}
                      disabled={busy || pin.length < MIN_PIN}
                    >
                      {busy ? t('signingIn') : t('biometricUnlock')}
                    </Button>
                  )}
                </>
              )}
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
