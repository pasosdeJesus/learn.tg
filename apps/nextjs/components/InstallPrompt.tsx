'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'learn.tg.installPromptDismissedAt'
const DISMISS_DAYS = 7

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
  const [dismissed, setDismissed] = useState(false)

  const t = useMemo(() => createComponentT(lang, {
    en: {
      text: 'Install Learn.tg on your home screen',
      install: 'Install',
      later: 'Not now',
    },
    es: {
      text: 'Instala Learn.tg en tu pantalla de inicio',
      install: 'Instalar',
      later: 'Ahora no',
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

  if (!deferred || dismissed) return null

  return (
    <div
      data-testid="install-prompt"
      role="status"
      className="bg-emerald-50 text-emerald-900 text-sm px-3 py-2 flex flex-wrap items-center justify-center gap-3"
    >
      <span>{t('text')}</span>
      <button
        type="button"
        data-testid="install-accept"
        onClick={() => { void install() }}
        className="px-3 py-1 rounded bg-emerald-700 text-white"
      >
        {t('install')}
      </button>
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
