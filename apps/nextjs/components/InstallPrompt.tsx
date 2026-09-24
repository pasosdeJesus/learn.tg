'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'learn.tg.installPromptDismissedAt'
const DISMISS_DAYS = 7

/**
 * iOS/Safari nunca dispara `beforeinstallprompt`: para que el estudiante de iPhone
 * vea que la app se puede instalar, se le dan las instrucciones del menú Compartir
 * (reporte del operador, 2026-09-23: "en un iPhone con Safari no veo botón para
 * instalar"). Se excluyen los navegadores de iOS que no son Safari (Chrome, Firefox,
 * Edge, Opera) porque no ofrecen "Añadir a pantalla de inicio".
 */
export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
  const ua = navigator.userAgent
  // iPadOS 13+ se presenta como Macintosh, pero con pantalla táctil.
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document)
  if (!ios) return false
  if (/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return false
  const standalone = (navigator as any).standalone === true ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
  return !standalone
}

interface InstallPromptProps {
  lang?: string
}

/**
 * Offers to install learn.tg as an app (R-#243). Chrome/Android fire
 * `beforeinstallprompt`; the banner is only shown when the browser says the app
 * is installable, and it stays hidden while the user keeps dismissing it.
 */
export function InstallPrompt({ lang = 'en' }: InstallPromptProps) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [iosHint, setIosHint] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const t = useMemo(() => createComponentT(lang, {
    en: {
      text: 'Install Learn.tg on your home screen',
      install: 'Install',
      later: 'Not now',
      iosText: 'To install Learn.tg on your iPhone: tap Share and then "Add to Home Screen".',
    },
    es: {
      text: 'Instala Learn.tg en tu pantalla de inicio',
      install: 'Instalar',
      later: 'Ahora no',
      iosText: 'Para instalar Learn.tg en tu iPhone: toca Compartir y luego "AÃ±adir a pantalla de inicio".',
    },
  }), [lang])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0)
    const recent = dismissedAt > 0 &&
      Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000
    if (recent) {
      setDismissed(true)
      return
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setDeferred(null)
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    if (isIosSafari()) setIosHint(true)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!deferred) return
    await deferred.prompt()
    const choice = await deferred.userChoice
    setDeferred(null)
    if (choice.outcome !== 'accepted') {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
      setDismissed(true)
    }
  }, [deferred])

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setDismissed(true)
  }, [])

  if (dismissed) return null
  // iOS: instrucciones (no hay evento que disparar); el resto: el evento del navegador.
  if (!deferred && !iosHint) return null

  return (
    <div
      data-testid="install-prompt"
      role="status"
      className="bg-emerald-50 text-emerald-900 text-sm px-3 py-2 flex flex-wrap items-center justify-center gap-3"
    >
      <span>{iosHint && !deferred ? t('iosText') : t('text')}</span>
      {!iosHint && (
        <button
          type="button"
          data-testid="install-accept"
          onClick={() => { void install() }}
          className="px-3 py-1 rounded bg-emerald-700 text-white"
        >
          {t('install')}
        </button>
      )}
      <button
        type="button"
        data-testid="install-dismiss"
        onClick={dismiss}
        className="underline"
      >
        {t('later')}
      </button>
    </div>
  )
}
