export type Lang = 'en' | 'es'

const MESSAGES = {
  en: {
    createTitle: 'Create an in-app wallet',
    importTitle: 'Import an existing wallet',
    pin: 'PIN (6 digits)',
    pinConfirm: 'Confirm PIN',
    pinMismatch: 'The PINs do not match',
    pinTooShort: 'The PIN must have at least 6 digits',
    create: 'Create wallet',
    import: 'Import wallet',
    mnemonic: 'Recovery phrase',
    privateKey: 'Private key (0x…)',
    warning: 'Write down your recovery phrase. If you lose it, you lose access to your funds.',
    copy: 'Copy',
    copied: 'Copied',
    done: 'Continue',
    unlockTitle: 'Unlock your in-app wallet',
    unlock: 'Unlock',
    wrongPin: 'Wrong PIN',
    useInAppWallet: 'Use in-app wallet',
  },
  es: {
    createTitle: 'Crear billetera en la aplicación',
    importTitle: 'Importar una billetera existente',
    pin: 'PIN (6 dígitos)',
    pinConfirm: 'Confirmar PIN',
    pinMismatch: 'Los PIN no coinciden',
    pinTooShort: 'El PIN debe tener al menos 6 dígitos',
    create: 'Crear billetera',
    import: 'Importar billetera',
    mnemonic: 'Frase de recuperación',
    privateKey: 'Clave privada (0x…)',
    warning: 'Escribe tu frase de recuperación. Si la pierdes, pierdes acceso a tus fondos.',
    copy: 'Copiar',
    copied: 'Copiado',
    done: 'Continuar',
    unlockTitle: 'Desbloquea tu billetera de la aplicación',
    unlock: 'Desbloquear',
    wrongPin: 'PIN incorrecto',
    useInAppWallet: 'Usar billetera de la aplicación',
  },
} as const

export type MessageKey = keyof (typeof MESSAGES)['en']

export function t(lang: Lang, key: MessageKey): string {
  return MESSAGES[lang]?.[key] ?? MESSAGES.en[key]
}
