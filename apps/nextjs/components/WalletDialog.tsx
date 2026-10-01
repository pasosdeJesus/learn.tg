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
import { detectPlatformSupport, isUserCancelledError } from '@learn-tg/pdj-wallet'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { PasswordInput } from '@/components/PasswordInput'
import { signInWithInAppWallet } from '@/lib/in-app-siwe'
import { getRpcUrl } from '@/lib/rpc-url'
import { markBackupConfirmed, pickVerifyPositions, verifyWords } from '@/lib/wallet-backup'
import { clearRestrictedCourseCopies } from '@/lib/offline-course-db'

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
  const [privateKey, setPrivateKey] = useState('')
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
  // R-#254: durante la creación la clave se conserva sólo hasta confirmar el respaldo,
  // para sellar la billetera sin volver a pedirla (nunca se pinta ni se guarda en
  // disco).
  const createPasswordRef = useRef('')
  /**
   * Elección explícita tras teclear la clave (reporte del operador, 2026-09-28): antes
   * era una casilla dentro del paso de las 12 palabras y se pasaba por alto. Mientras el
   * paso está abierto no se muestran ni las palabras ni el formulario.
   */
  const [protectStep, setProtectStep] = useState(false)
  /** Por omisión el gesto: es el método habitual cuando el dispositivo lo soporta. */
  const [protectChoice, setProtectChoice] = useState<'gesture' | 'password'>('gesture')
  /** `true` cuando el paso viene de una importación (al terminar hay que firmar). */
  const [protectSignsIn, setProtectSignsIn] = useState(false)
  // R-#254: antes de crear la billetera el hook no conoce el soporte del
  // dispositivo (lo calcula cuando encuentra una billetera), así que la creación lo
  // sondea aquí. Sin esto la huella nunca se ofrecía al crear (reportado el
  // 2026-09-21 desde un Android).
  const [deviceCanVerify, setDeviceCanVerify] = useState(false)
  const [biometricNotice, setBiometricNotice] = useState<string | null>(null)
  const autoGestureTried = useRef(false)
  const [busy, setBusy] = useState(false)

  const t = useMemo(() => createComponentT(lang, {
    en: {
      title: 'In-app wallet',
      checking: 'Checking your wallet…',
      createTitle: 'Create a wallet',
      createDescription: 'It is created on this device and protected with a password. No wallet app is needed.',
      importTitle: 'Import a wallet',
      importDescription: 'Use the recovery phrase (12 words) or the private key of a wallet you already have. Just one of the two.',
      lockedTitle: 'Unlock your in-app wallet',
      lockedDescription: 'Enter your password to sign in.',
      biometricUnlock: 'Unlock with fingerprint',
      biometricEnable: 'Unlock with fingerprint next time',
      biometricHint: 'Uses the fingerprint or Face ID of this device. Your password is the backup.',
      biometricOn: 'Fingerprint unlock is on',
      biometricOff: 'Turn off fingerprint unlock',
      biometricCreateFailed: 'The fingerprint could not be saved. Your password still works; you can turn the gesture on later from the wallet.',
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
      passwordShow: 'Show the password',
      passwordHide: 'Hide the password',
      importOffer: 'Already have a wallet? Import your recovery phrase or private key and keep the same address, history and scholarships.',
      importSecurity: 'Your recovery phrase or private key never leaves this device. learn.tg never sees it.',
      migrationGuide: 'Step-by-step guide (MetaMask, Rabby, OKX, OneKey, Brave)',
      protectTitle: 'How do you want to unlock this wallet?',
      protectHint: 'The password is always the backup. If this device can check your fingerprint or face, you can leave the gesture as the usual way in.',
      protectGesture: 'With my fingerprint or Face ID (recommended)',
      protectPassword: 'Only with the password',
      protectContinue: 'Continue',
      mnemonic: 'Recovery phrase (12 words)',
      privateKey: 'Private key (0x…)',
      importNeedsOne: 'Enter the recovery phrase or the private key.',
      importBoth: 'Use either the recovery phrase or the private key, not both.',
      create: 'Create wallet',
      import: 'Import wallet',
      unlock: 'Unlock',
      back: 'Back',
      close: 'Close',
      signIn: 'Sign in',
      signingIn: 'Signing in...',
      recoveryTitle: 'Write down these 12 words on paper',
      recoveryDescription: 'They are the only way to recover your wallet on another device. Write them on paper, in order, and keep that paper somewhere safe: whoever has these 12 words owns the funds of this wallet. Do not share them and do not keep them as a screenshot or a digital note.',
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
      importDescription: 'Usa la frase de recuperación (12 palabras) o la clave privada de una billetera que ya tengas. Solo una de las dos.',
      lockedTitle: 'Desbloquea tu billetera',
      lockedDescription: 'Escribe tu clave para ingresar.',
      biometricUnlock: 'Desbloquear con huella',
      biometricEnable: 'Desbloquear con huella la próxima vez',
      biometricHint: 'Usa la huella o Face ID de este dispositivo. Tu clave es el respaldo.',
      biometricOn: 'Desbloqueo con huella activado',
      biometricOff: 'Desactivar el desbloqueo con huella',
      biometricCreateFailed: 'No se pudo guardar la huella. Tu clave sigue funcionando y puedes activar el gesto después desde la billetera.',
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
      passwordShow: 'Mostrar la clave',
      passwordHide: 'Ocultar la clave',
      importOffer: '¿Ya tienes billetera? Importa tu frase de recuperación o tu clave privada y conserva la misma dirección, tu historial y tus becas.',
      importSecurity: 'Tu frase de recuperación o clave privada nunca sale de este dispositivo. learn.tg no las ve.',
      migrationGuide: 'Guía paso a paso (MetaMask, Rabby, OKX, OneKey, Brave)',
      protectTitle: '¿Cómo quieres desbloquear esta billetera?',
      protectHint: 'La clave siempre queda de respaldo. Si este dispositivo puede verificar tu huella o tu rostro, puedes dejar el gesto como la forma habitual de entrar.',
      protectGesture: 'Con mi huella o Face ID (recomendado)',
      protectPassword: 'Solo con la clave',
      protectContinue: 'Continuar',
      mnemonic: 'Frase de recuperación (12 palabras)',
      privateKey: 'Clave privada (0x…)',
      importNeedsOne: 'Escribe la frase de recuperación o la clave privada.',
      importBoth: 'Usa la frase de recuperación o la clave privada, no las dos.',
      create: 'Crear billetera',
      import: 'Importar billetera',
      unlock: 'Desbloquear',
      back: 'Volver',
      close: 'Cerrar',
      signIn: 'Ingresar',
      signingIn: 'Ingresando...',
      recoveryTitle: 'Anota estas 12 palabras en papel',
      recoveryDescription: 'Son la única forma de recuperar tu billetera en otro dispositivo. Escríbelas en papel, en orden, y guarda ese papel en un lugar seguro: quien tenga estas 12 palabras tiene los fondos de esta billetera. No las compartas ni las guardes como captura de pantalla o nota digital.',
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
    createPasswordRef.current = ''
    setProtectStep(false)
    setProtectChoice('gesture')
    setProtectSignsIn(false)
    setBiometricNotice(null)
    autoGestureTried.current = false
    setBusy(false)
  }, [open])

  // R-#254: sondeo del soporte del dispositivo para poder ofrecer la huella en la
  // creación, cuando el hook todavía no tiene billetera que inspeccionar.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void detectPlatformSupport()
      .then((support) => {
        if (!cancelled) setDeviceCanVerify(!!support.userVerifying && support.prf !== false)
      })
      .catch(() => {
        if (!cancelled) setDeviceCanVerify(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  // En la creación manda el sondeo propio; ya con billetera, lo que diga el hook.
  const canOfferBiometric = biometricAvailable || deviceCanVerify

  const translateError = useCallback((raw: unknown) => {
    const code = raw instanceof Error ? raw.message : String(raw)
    if (code === 'no-accounts') return t('noAccounts')
    if (code === 'no-csrf') return t('noCsrf')
    if (code === 'auth-failed') return t('authFailed')
    if (code === 'no-webauthn') return t('noWebauthn')
    if (code === 'no-prf') return t('noPrf')
    if (code === 'no-biometric') return t('noBiometric')
    // R-#246 §14 item 4: `AbortError`/"cancel" también son cancelaciones, no sólo
    // `NotAllowedError`.
    if (code === 'NotAllowedError' || isUserCancelledError(raw)) return t('biometricCancelled')
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
      createPasswordRef.current = password
      setRecovery(result.mnemonic)
      setVerifyPositions(pickVerifyPositions(result.mnemonic.trim().split(' ').length))
      setVerifyInputs({})
      setVerifyError(false)
      setShowWords(true)
      setPassword('')
      setConfirm('')
      // R-#269/2026-09-28: con el dispositivo capaz de verificar al usuario, el paso
      // siguiente es elegir cómo desbloquear (gesto por omisión o sólo la clave).
      setProtectChoice('gesture')
      setProtectSignsIn(false)
      setProtectStep(canOfferBiometric && !biometricEnabled)
    } catch (e) {
      setLocalError(translateError(e))
    } finally {
      setBusy(false)
    }
  }, [biometricEnabled, canOfferBiometric, confirm, create, password, t, translateError])

  const handleImport = useCallback(async () => {
    setLocalError(null)
    const phrase = mnemonic.trim()
    const key = privateKey.trim()
    if (!phrase && !key) { setLocalError(t('importNeedsOne')); return }
    if (phrase && key) { setLocalError(t('importBoth')); return }
    if (!isValidPassword(password)) { setLocalError(t('passwordTooShort')); return }
    setBusy(true)
    try {
      await importExisting({
        password,
        ...(phrase ? { mnemonic: phrase } : {}),
        ...(key ? { privateKey: key as `0x${string}` } : {}),
      })
      createPasswordRef.current = password
      // La misma elección que al crear: importar también deja la clave en memoria.
      setProtectChoice('gesture')
      setProtectSignsIn(true)
      if (canOfferBiometric && !biometricEnabled) {
        setBusy(false)
        setProtectStep(true)
        return
      }
      await signIn()
    } catch (e) {
      setLocalError(translateError(e))
      setBusy(false)
    }
  }, [biometricEnabled, canOfferBiometric, importExisting, mnemonic, privateKey, password, signIn, t, translateError])

  /**
   * Cierra el paso de protección: sella la billetera con el gesto cuando se eligió
   * (la clave sigue en memoria del formulario, no se pide otra vez) y continúa el flujo
   * (las 12 palabras al crear, la firma al importar). Si el gesto falla, se avisa y el
   * paso se queda abierto para poder seguir sólo con la clave.
   */
  const handleProtect = useCallback(async () => {
    setLocalError(null)
    setBiometricNotice(null)
    const passwordForBiometric = createPasswordRef.current || password
    if (protectChoice === 'gesture' && passwordForBiometric) {
      setBusy(true)
      try {
        await enableBiometric(passwordForBiometric)
      } catch {
        setBiometricNotice(t('biometricCreateFailed'))
        setBusy(false)
        return
      }
      setBusy(false)
    }
    createPasswordRef.current = ''
    setProtectStep(false)
    if (protectSignsIn) {
      setProtectSignsIn(false)
      await signIn()
    }
  }, [enableBiometric, password, protectChoice, protectSignsIn, signIn, t])

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
      // Decisión del operador (2026-09-25): una cancelación no debe silenciar el gesto
      // en las próximas aperturas; sólo se ofrece la clave como respaldo inmediato.
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
  // respaldo como confirmado y se firma. El gesto ya se eligió y selló en el paso de
  // protección (reporte del operador, 2026-09-28), así que aquí la clave ya no se
  // necesita.
  const handleVerifyBackup = useCallback(async () => {
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
    createPasswordRef.current = ''
    void signIn()
  }, [recovery, signIn, verifyInputs])

  const handleDelete = useCallback(async () => {
    setLocalError(null)
    setBusy(true)
    try {
      await remove()
      localStorage.removeItem('learn.tg.sessionAddress')
      // R-#256 §3.5/§3.6b: sin billetera no quedan copias de cursos de pago ni
      // de contenido sensible en el dispositivo.
      await clearRestrictedCourseCopies().catch(() => {})
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
  // Decisión del operador (2026-09-25): el gesto se pide siempre al abrir; si se
  // cancela, o si el dispositivo no tiene huella guardada, la clave queda de respaldo.
  // Sólo apagar el desbloqueo con huella (que borra la passkey) lo evita.
  useEffect(() => {
    if (!open || !showUnlock || !biometricEnabled) return
    if (autoGestureTried.current) return
    autoGestureTried.current = true
    void handleUnlockWithBiometric()
  }, [open, showUnlock, biometricEnabled, handleUnlockWithBiometric])
  // El error del hook también se traduce: los códigos del camino biométrico
  // (`NotAllowedError`, `no-prf`…) no son texto para el usuario.
  const message = localError ?? (error ? translateError(error) : null)
  // R-#270 §3.3.2: la guía servida por idioma (el diálogo no adivina la ruta).
  const migrationHref = lang === 'es' ? '/es/migracion-billetera-app' : '/en/migration-in-app-wallet'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="wallet-dialog">
        <DialogHeader>
          <DialogTitle>
            {protectStep
              ? t('protectTitle')
              : showRecovery
                ? t('recoveryTitle')
                : booting
                  ? t('title')
                  : showUnlock
                    ? t('lockedTitle')
                    : mode === 'create' ? t('createTitle') : t('importTitle')}
          </DialogTitle>
          <DialogDescription>
            {protectStep
              ? t('protectHint')
              : showRecovery
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

        {protectStep ? (
          // R-#269/2026-09-28: elección explícita justo después de la clave. El gesto
          // (passkey/PRF) queda por omisión cuando el dispositivo puede verificar al
          // usuario; "sólo la clave" sigue disponible y la clave es siempre el respaldo.
          <div className="py-4 space-y-3" data-testid="wallet-protect">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="wallet-protect"
                data-testid="wallet-protect-gesture"
                checked={protectChoice === 'gesture'}
                onChange={() => setProtectChoice('gesture')}
              />
              {t('protectGesture')}
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="wallet-protect"
                data-testid="wallet-protect-password"
                checked={protectChoice === 'password'}
                onChange={() => setProtectChoice('password')}
              />
              {t('protectPassword')}
            </label>
            {biometricNotice && (
              <p className="text-xs text-amber-700" data-testid="wallet-protect-notice">
                {biometricNotice}
              </p>
            )}
            <Button
              data-testid="wallet-protect-continue"
              onClick={() => { void handleProtect() }}
              disabled={busy}
            >
              {t('protectContinue')}
            </Button>
          </div>
        ) : showRecovery ? (
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

            {!showUnlock && !hasWallet && mode === 'create' && (
              <p className="text-xs text-gray-600" data-testid="wallet-import-offer">
                {t('importOffer')}{' '}
                <button
                  type="button"
                  className="underline font-medium text-blue-600"
                  data-testid="wallet-switch-import"
                  onClick={() => setMode('import')}
                >
                  {t('import')}
                </button>
              </p>
            )}

            {!showUnlock && !hasWallet && mode === 'import' && (
              <p className="text-xs text-gray-600" data-testid="wallet-import-security">
                {t('importSecurity')}{' '}
                <a href={migrationHref} className="underline text-blue-600" data-testid="wallet-migration-guide">
                  {t('migrationGuide')}
                </a>
              </p>
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

            {!showUnlock && !hasWallet && mode === 'import' && (
              <label className="block space-y-1">
                <span className="text-sm font-medium">{t('privateKey')}</span>
                <Input
                  data-testid="wallet-private-key"
                  placeholder="0x…"
                  value={privateKey}
                  onChange={(event) => setPrivateKey(event.target.value)}
                />
              </label>
            )}

            {/* El password se pide para desbloquear una billetera existente o para crear
                una nueva; nunca cuando el gesto reemplaza al password. */}
            {!gestureOnly && (!hasWallet || showUnlock) && (
              <label className="block space-y-1">
                <span className="text-sm font-medium">{t('password')}</span>
                <PasswordInput
                  inputMode="text"
                  autoComplete="off"
                  data-testid="wallet-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  showLabel={t('passwordShow')}
                  hideLabel={t('passwordHide')}
                />
              </label>
            )}

            {!showUnlock && !hasWallet && mode === 'create' && (
              <label className="block space-y-1">
                <span className="text-sm font-medium">{t('passwordConfirm')}</span>
                <PasswordInput
                  inputMode="text"
                  autoComplete="off"
                  data-testid="wallet-password-confirm"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  showLabel={t('passwordShow')}
                  hideLabel={t('passwordHide')}
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
                <PasswordInput
                  inputMode="text"
                  autoComplete="off"
                  data-testid="wallet-biometric-password"
                  value={biometricPassword}
                  onChange={(event) => setBiometricPassword(event.target.value)}
                  showLabel={t('passwordShow')}
                  hideLabel={t('passwordHide')}
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
              <Button data-testid="wallet-verify" onClick={() => { void handleVerifyBackup() }} disabled={busy}>
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
                <Button data-testid="wallet-import" onClick={() => { void handleImport() }} disabled={busy || (!mnemonic.trim() && !privateKey.trim())}>
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
