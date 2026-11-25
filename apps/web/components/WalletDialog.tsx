'use client'

import { useCallback } from 'react'
import {
  WalletDialog as SharedWalletDialog,
  type WalletReactMessages,
} from '@pasosdejesus/m/wallet/next'
import type { Eip1193Provider } from '@pasosdejesus/m/wallet'
import { logger } from '@pasosdejesus/m/debug'
import { signInWithInAppWallet } from '@/lib/in-app-siwe'
import { getRpcUrl } from '@/lib/rpc-url'
import { clearRestrictedCourseCopies } from '@/lib/offline-course-db'

/**
 * Clave **heredada** del respaldo confirmado (R-#249). No cambiarla: quien ya
 * respondió las tres palabras no debe volver a ver el aviso.
 */
const BACKUP_CONFIRMED_KEY = 'learn.tg.wallet.backupConfirmed'

/** Fallback de sesión fría (NextAuth #5719); no es un secreto. */
const SESSION_ADDRESS_KEY = 'learn.tg.sessionAddress'

interface WalletDialogProps {
  lang?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Dirección de la cookie de sesión: si ya es esta billetera, no se re-firma. */
  sessionAddress?: string
}

/**
 * Envoltorio de learn.tg sobre el diálogo graduado de `@pasosdejesus/m/wallet/next`
 * (https://gitlab.com/pasosdeJesus/m/-/work_items/75, F2).
 *
 * El flujo completo (crear, importar, protección con gesto, respaldo con
 * cuestionario, desbloquear, biometría y borrar) vive en el paquete y se prueba
 * allí. Aquí quedan sólo las decisiones de esta aplicación: la firma SIWE con
 * invitaciones (R-#265), el RPC de la cadena actual, la guía de migración, la
 * clave de respaldo heredada y la limpieza de copias del dispositivo (R-#256).
 * El diálogo lo cierra este envoltorio al terminar la firma o el borrado.
 */
export function WalletDialog({ lang = 'en', open, onOpenChange, sessionAddress }: WalletDialogProps) {
  const locale = lang === 'es' ? 'es' : 'en'
  const migrationHref = locale === 'es' ? '/es/migracion-billetera-app' : '/en/migration-in-app-wallet'

  const messages: Partial<WalletReactMessages> = {
    importSecurity:
      locale === 'es'
        ? 'Tu frase de recuperación o clave privada nunca sale de este dispositivo. learn.tg nunca la ve.'
        : 'Your recovery phrase or private key never leaves this device. learn.tg never sees it.',
  }

  const signIn = useCallback(
    async (provider: Eip1193Provider) => {
      await signInWithInAppWallet(provider, { lang: locale })
      onOpenChange(false)
    },
    [locale, onOpenChange],
  )

  const handleWalletRemoved = useCallback(async () => {
    localStorage.removeItem(SESSION_ADDRESS_KEY)
    // R-#256 §3.5/§3.6b: sin billetera no quedan copias de cursos de pago ni de
    // contenido sensible en el dispositivo.
    await clearRestrictedCourseCopies().catch(() => {})
    onOpenChange(false)
  }, [onOpenChange])

  return (
    <SharedWalletDialog
      open={open}
      onOpenChange={onOpenChange}
      lang={locale}
      messages={messages}
      appName="learn.tg"
      migrationHref={migrationHref}
      rpcUrl={getRpcUrl()}
      sessionAddress={sessionAddress}
      signIn={signIn}
      onWalletRemoved={handleWalletRemoved}
      backup={{ storageKey: BACKUP_CONFIRMED_KEY }}
      logger={logger}
    />
  )
}
