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
import { isValidPassword, useInAppWallet } from '@learn-tg/pdj-wallet-next'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { signInWithInAppWallet } from '@/lib/in-app-siwe'
import { getRpcUrl } from '@/lib/rpc-url'
import { markBackupConfirmed, pickVerifyPositions, verifyWords } from '@/lib/wallet-backup'

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

// Secreto aceptado: password de 6+ dígitos o clave de 8+ caracteres (R-#251).
// La validación real vive en el paquete (`isValidPassword`); aquí sólo se usa para
// habilitar el botón y dar el mensaje.

/**
 * Modal que crea, importa o desbloquea la billetera de la aplicación y firma el
 * SIWE (R-#244). Vive fuera de la cabecera a propósito: el flujo completo
 * (password, frase de recuperación, ingreso) no cabe ahí y el usuario necesita leer
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
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [mnemonic, setMnemonic] = useState('')
  const [recovery, setRecovery] = useState<string | null>(null)
  // R-#249: verificación de 3 palabras del respaldo (antes sólo se pulsaba
  // "ya las guardé", que no probaba nada).
  const [verifyPositions, setVerifyPositions] = useState<number[]>([])
  const [verifyInputs, setVerifyInputs] = useState<Record<number, string>>({})
  const [verifyError, setVerifyError] = useState(false)
  const [showWords, setShowWords] = useState(true)
  const [localError, setLocalError] = useState<string | null>(null)
  const [biometricPassword, setBiometricPassword] = useState('')
  const [passwordFallback, setPasswordFallback] = useState(false)
  const autoGestureTried = useRef(false)
  const [busy, setBusy] = useState(false)

  const t = useMemo(() => createComponentT(lang, {
    en: {
      title: 'In-app wallet',
      checking: 'Checking your wallet…',
      createTitle: 'Create a wallet',
      createDescription: 'It is created on this device and protected with a password. No wallet app is needed.',
      importTitle: 'Import a wallet',
      importDescription: 'Use the 12 words or the private key of a wallet you already have.',
      lockedTitle: 'Unlock your in-app wallet',
      lockedDescription: 'Enter your password to sign in.',
      biometricUnlock: 'Unlock with fingerprint',
      biometricEnable: 'Unlock with fingerprint next time',
      biometricHint: 'Uses the fingerprint or Face ID of this device. Your password is the backup.',
      biometricOn: 'Fingerprint unlock is on',
      biometricOff: 'Turn off fingerprint unlock',
      noWebauthn: 'This device cannot verify your fingerprint or Face ID.',
      noPrf: 'This device cannot store the biometric unlock. Use your password.',
      noBiometric: 'There is no fingerprint unlock saved on this device.',
      biometricCancelled: 'The fingerprint or Face ID prompt was cancelled.',
      invalidMnemonic: 'That recovery phrase is not valid. Check the words and their order.',
      biometricRetry: 'Try the fingerprint again',
      usePassword: 'Use the password',
      unlockWithPasswordOnly: 'Use the password only',
      lockedDescriptionGesture: 'Confirm with your fingerprint or Face ID to sign in. No password to type.',
      password: 'Password (8+ characters)',
      passwordConfirm: 'Repeat the password',
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
      wordsDone: 'I have them written down',
      verifyTitle: 'Confirm your backup',
      verifyHint: 'Type these three words of your phrase to confirm you saved it:',
      verifyWord: 'Word #{{0}}',
      verifyWrong: 'Those words do not match the phrase. Check them and try again.',
      verifySubmit: 'Confirm and sign in',
      peekWords: 'Show the words again',
      passwordTooShort: 'The password must have at least 8 characters.',
      passwordMismatch: 'The passwords do not match.',
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
      checking: 'Comprobando tu billetera…',
      createTitle: 'Crear una billetera',
      createDescription: 'Se crea en este dispositivo y se protege con una clave. No necesitas una aplicación de billetera.',
      importTitle: 'Importar una billetera',
      importDescription: 'Usa las 12 palabras o la clave privada de una billetera que ya tengas.',
      lockedTitle: 'Desbloquea tu billetera',
      lockedDescription: 'Escribe tu clave para ingresar.',
      biometricUnlock: 'Desbloquear con huella',
      biometricEnable: 'Desbloquear con huella la próxima vez',
      biometricHint: 'Usa la huella o Face ID de este dispositivo. Tu clave es el respaldo.',
      biometricOn: 'Desbloqueo con huella activado',
      biometricOff: 'Desactivar el desbloqueo con huella',
      noWebauthn: 'Este dispositivo no puede verificar tu huella o Face ID.',
      noPrf: 'Este dispositivo no puede guardar el desbloqueo por huella. Usa tu clave.',
      noBiometric: 'No hay un desbloqueo por huella guardado en este dispositivo.',
      biometricCancelled: 'Se canceló la huella o Face ID.',
      invalidMnemonic: 'Esa frase de recuperación no es válida. Revisa las palabras y su orden.',
      biometricRetry: 'Reintentar huella',
      usePassword: 'Usar la clave',
      unlockWithPasswordOnly: 'Seguir usando solo la clave',
      lockedDescriptionGesture: 'Confirma con tu huella o Face ID para ingresar. No hay que escribir la clave.',
      password: 'Clave (8+ caracteres)',
      passwordConfirm: 'Repite la clave',
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
      wordsDone: 'Ya las anoté',
      verifyTitle: 'Confirma tu respaldo',
      verifyHint: 'Escribe estas tres palabras de tu frase para confirmar que la guardaste:',
      verifyWord: 'Palabra #{{0}}',
      verifyWrong: 'Esas palabras no coinciden con la frase. Revísalas e intenta de nuevo.',
      verifySubmit: 'Confirmar e ingresar',
      peekWords: 'Ver las palabras otra vez',
      passwordTooShort: 'La clave debe tener al menos 8 caracteres.',
      passwordMismatch: 'Las claves no coinciden.',
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
    setPassword('')
    setConfirm('')
    setMnemonic('')
    setRecovery(null)
    setVerifyPositions([])
    setVerifyInputs({})
    setVerifyError(false)
    setShowWords(true)
    setLocalError(null)
    setPasswordFallback(false)
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
      const provider = getProvider(getRpcUrl())
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
    if (!isValidPassword(password)) { setLocalError(t('passwordTooShort')); return }
    if (password !== confirm) { setLocalError(t('passwordMismatch')); return }
    setBusy(true)
    try {
      const result = await create(password)
      setRecovery(result.mnemonic)
      setVerifyPositions(pickVerifyPositions(result.mnemonic.trim().split(' ').length))
      setVerifyInputs({})
      setVerifyError(false)
      setShowWords(true)
      setPassword('')
      setConfirm('')
    } catch (e) {
      setLocalError(translateError(e))
    } finally {
      setBusy(false)
    }
  }, [confirm, create, password, t, translateError])

  const handleImport = useCallback(async () => {
    setLocalError(null)
    if (!isValidPassword(password)) { setLocalError(t('passwordTooShort')); return }
    setBusy(true)
    try {
      await importExisting({ password, mnemonic: mnemonic.trim() })
      await signIn()
    } catch (e) {
      setLocalError(translateError(e))
      setBusy(false)
    }
  }, [importExisting, mnemonic, password, signIn, t, translateError])

  const handleUnlock = useCallback(async () => {
    setLocalError(null)
    if (!isValidPassword(password)) { setLocalError(t('passwordTooShort')); return }
    setBusy(true)
    try {
      await unlock(password)
      await signIn()
    } catch (e) {
      setLocalError(translateError(e))
      setBusy(false)
    }
  }, [password, signIn, t, translateError, unlock])

  // R-#246: un gesto reemplaza al password cuando la clave quedó sellada con el
  // secreto PRF de la passkey. Si el gesto falla o se cancela, el password queda a un
  // toque de distancia (`passwordFallback`).
  const handleUnlockWithBiometric = useCallback(async () => {
    setLocalError(null)
    setBusy(true)
    try {
      await unlockWithBiometric()
      await signIn()
    } catch (e) {
      setLocalError(translateError(e))
      setPasswordFallback(true)
      setBusy(false)
    }
  }, [signIn, translateError, unlockWithBiometric])

  // Mismo password, un paso extra: además de desbloquear, recuerda el gesto para la
  // próxima vez. `enableBiometric` deja la billetera desbloqueada.
  const handleUnlockAndEnableBiometric = useCallback(async () => {
    setLocalError(null)
    if (!isValidPassword(password)) { setLocalError(t('passwordTooShort')); return }
    setBusy(true)
    try {
      await enableBiometric(password)
      await signIn()
    } catch (e) {
      setLocalError(translateError(e))
      setBusy(false)
    }
  }, [enableBiometric, password, signIn, t, translateError])

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
  // pide el password otra vez porque no se guarda en memoria.
  const handleEnableBiometric = useCallback(async () => {
    setLocalError(null)
    if (!isValidPassword(biometricPassword)) { setLocalError(t('passwordTooShort')); return }
    setBusy(true)
    try {
      await enableBiometric(biometricPassword)
      setBiometricPassword('')
    } catch (e) {
      setLocalError(translateError(e))
    } finally {
      setBusy(false)
    }
  }, [biometricPassword, enableBiometric, t, translateError])

  // R-#249: las 3 palabras deben coincidir con la frase; sólo entonces se marca el
  // respaldo como confirmado y se firma. `signIn` ya cierra el diálogo.
  const handleVerifyBackup = useCallback(() => {
    if (!recovery) return
    setLocalError(null)
    const result = verifyWords(recovery.trim().split(' '), verifyInputs)
    if (!result.ok) {
      setVerifyError(true)
      setShowWords(false)
      return
    }
    setVerifyError(false)
    markBackupConfirmed()
    void signIn()
  }, [recovery, signIn, verifyInputs])

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
  // Mientras el hook resuelve IndexedDB/sesión el diálogo no sabe si hay billetera:
  // mostrar el formulario de crear hacía pensar que la billetera se había perdido.
  const booting = status === 'loading'
  // Hay billetera en este dispositivo (bloqueada o desbloqueada): el diálogo muestra
  // la billetera, no el formulario de crear o importar.
  const hasWallet = status === 'locked' || status === 'unlocked'
  // Con la passkey registrada el gesto es el camino principal: el password solo
  // aparece si el usuario lo pide o si el gesto falla (R-#246).
  const gestureOnly = showUnlock && biometricEnabled && !passwordFallback
  // Al abrir con una passkey registrada se pide el gesto directamente, en lugar
  // de mostrar un campo de password que invita a escribir cuando un toque bastaba.
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
              : booting
                ? t('title')
                : showUnlock
                  ? t('lockedTitle')
                  : mode === 'create' ? t('createTitle') : t('importTitle')}
          </DialogTitle>
          <DialogDescription>
            {showRecovery
              ? t('recoveryDescription')
              : booting
                ? t('checking')
                : showUnlock
                  ? gestureOnly ? t('lockedDescriptionGesture') : t('lockedDescription')
                  : mode === 'create' ? t('createDescription') : t('importDescription')}
          </DialogDescription>
        </DialogHeader>

        {booting && (
          // Mientras el hook lee IndexedDB y resuelve la sesión el formulario no
          // debe mostrarse: el operador abrió el diálogo tras desbloquear y vio el
          // formulario de "crear billetera" (reportado el 2026-09-19).
          <div className="py-6 text-center text-sm text-gray-500" data-testid="wallet-loading">
            {t('checking')}
          </div>
        )}

        {showRecovery ? (
          <div className="py-4 space-y-3">
            {showWords ? (
              <>
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
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { void handleCopy() }} data-testid="wallet-copy-recovery">
                    {t('copy')}
                  </Button>
                  <Button data-testid="wallet-words-done" onClick={() => setShowWords(false)}>
                    {t('wordsDone')}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">{t('verifyTitle')}</p>
                <p className="text-sm text-gray-600">{t('verifyHint')}</p>
                {verifyPositions.map((position) => (
                  <label key={position} className="block space-y-1">
                    <span className="text-sm text-gray-500">{t('verifyWord', String(position))}</span>
                    <Input
                      data-testid={`wallet-verify-${position}`}
                      autoComplete="off"
                      value={verifyInputs[position] || ''}
                      onChange={(event) =>
                        setVerifyInputs((current) => ({ ...current, [position]: event.target.value }))
                      }
                    />
                  </label>
                ))}
                {verifyError && (
                  <p role="alert" className="text-sm text-red-700" data-testid="wallet-verify-error">
                    {t('verifyWrong')}
                  </p>
                )}
                <Button
                  variant="outline"
                  data-testid="wallet-words-peek"
                  onClick={() => setShowWords(true)}
                >
                  {t('peekWords')}
                </Button>
              </>
            )}
          </div>
        ) : booting ? null : (
          <div className="py-4 space-y-3">
            {/* Con una billetera existente (bloqueada o desbloqueada) NO se muestra el
                formulario de crear/importar: el operador abrió el diálogo esperando su
                billetera y veía "crear billetera" (reportado el 2026-09-19). Ese
                formulario sólo tiene sentido cuando no hay billetera. */}
            {!showUnlock && !hasWallet && (
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

            {!showUnlock && !hasWallet && mode === 'import' && (
              <label className="block space-y-1">
                <span className="text-sm font-medium">{t('mnemonic')}</span>
                <Input
                  data-testid="wallet-mnemonic"
                  value={mnemonic}
                  onChange={(event) => setMnemonic(event.target.value)}
                />
              </label>
            )}

            {/* El password se pide para desbloquear una billetera existente o para crear
                una nueva; nunca cuando el gesto reemplaza al password. */}
            {!gestureOnly && (!hasWallet || showUnlock) && (
              <label className="block space-y-1">
                <span className="text-sm font-medium">{t('password')}</span>
                <Input
                  type="password"
                  inputMode="text"
                  autoComplete="off"
                  data-testid="wallet-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
            )}

            {!showUnlock && !hasWallet && mode === 'create' && (
              <label className="block space-y-1">
                <span className="text-sm font-medium">{t('passwordConfirm')}</span>
                <Input
                  type="password"
                  inputMode="text"
                  autoComplete="off"
                  data-testid="wallet-password-confirm"
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

            {/* Recién creada o importada: la billetera está desbloqueada y el password
                sigue en memoria del usuario, así que es el momento de activar el
                gesto sin volver a pedirlo más tarde. */}
            {!showUnlock && walletInfo?.address && biometricAvailable && !biometricEnabled && (
              <div className="space-y-1">
                <p className="text-xs text-gray-500" data-testid="wallet-biometric-hint">
                  {t('biometricHint')}
                </p>
                <Input
                  type="password"
                  inputMode="text"
                  autoComplete="off"
                  data-testid="wallet-biometric-password"
                  value={biometricPassword}
                  onChange={(event) => setBiometricPassword(event.target.value)}
                />
                <Button
                  variant="default"
                  size="sm"
                  data-testid="wallet-enable-biometric"
                  onClick={() => { void handleEnableBiometric() }}
                  disabled={busy || !isValidPassword(biometricPassword)}
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
          {booting ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('close')}
            </Button>
          ) : showRecovery ? (
            showWords ? (
              <Button data-testid="wallet-words-done-footer" onClick={() => setShowWords(false)} disabled={busy}>
                {t('wordsDone')}
              </Button>
            ) : (
              <Button data-testid="wallet-verify" onClick={handleVerifyBackup} disabled={busy}>
                {busy ? t('signingIn') : t('verifySubmit')}
              </Button>
            )
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
                        data-testid="wallet-use-password"
                        onClick={() => setPasswordFallback(true)}
                        disabled={busy}
                      >
                        {t('usePassword')}
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
                    {busy ? t('signingIn') : biometricAvailable ? t('unlockWithPasswordOnly') : t('unlock')}
                  </Button>
                  {biometricAvailable && (
                    <Button
                      data-testid="wallet-enable-biometric"
                      onClick={() => { void handleUnlockAndEnableBiometric() }}
                      disabled={busy || !isValidPassword(password)}
                    >
                      {busy ? t('signingIn') : t('biometricUnlock')}
                    </Button>
                  )}
                </>
              )}
            </>
          ) : hasWallet ? (
            // Con billetera existente y desbloqueada sólo se cierra (o se desbloquea,
            // que es el caso de `showUnlock` de arriba): crear o importar otra
            // billetera encima de la que hay no es una acción normal.
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('close')}
            </Button>
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
