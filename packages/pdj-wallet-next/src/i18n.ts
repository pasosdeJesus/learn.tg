export type Lang = 'en' | 'es'

const MESSAGES = {
  en: {
    createTitle: 'Create an in-app wallet',
    importTitle: 'Import an existing wallet',
    password: 'Password (8+ characters)',
    passwordConfirm: 'Repeat the password',
    passwordMismatch: 'The passwords do not match',
    passwordTooShort: 'The password must have at least 8 characters',
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
    wrongPassword: 'Wrong password',
    useInAppWallet: 'Use in-app wallet',
  },
  es: {
    createTitle: 'Crear billetera en la aplicación',
    importTitle: 'Importar una billetera existente',
    password: 'Clave (8+ caracteres)',
    passwordConfirm: 'Repite la clave',
    passwordMismatch: 'Las claves no coinciden',
    passwordTooShort: 'La clave debe tener al menos 8 caracteres',
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
    wrongPassword: 'Clave incorrecta',
    useInAppWallet: 'Usar billetera de la aplicación',
  },
} as const

export type MessageKey = keyof (typeof MESSAGES)['en']

export function t(lang: Lang, key: MessageKey): string {
  return MESSAGES[lang]?.[key] ?? MESSAGES.en[key]
}
