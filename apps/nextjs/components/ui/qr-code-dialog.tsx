'use client'

import * as React from 'react'
import { useMemo, useEffect, useRef, useState } from 'react'
import { SelfQRcodeWrapper } from '@selfxyz/qrcode'
import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { logger } from '@pasosdejesus/m/debug'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@pasosdejesus/m/shadcn-components/ui/dialog'

interface QRCodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selfApp: any | null
  onSuccess: () => void
  onError: (error: string) => void
  isMobile?: boolean
  onMobileVerify?: () => void
  lang?: string
}

export function QRCodeDialog({
  open,
  onOpenChange,
  selfApp,
  onSuccess,
  onError,
  isMobile = false,
  onMobileVerify,
  lang = 'en',
}: QRCodeDialogProps) {
  const prevOpenRef = useRef(open)
  const [selfError, setSelfError] = useState<string | null>(null)

  const isWalletBrowser = typeof navigator !== 'undefined' &&
    ['okx', 'onekey', 'metamask', 'trust wallet'].some(p =>
      navigator.userAgent.toLowerCase().includes(p))

  useEffect(() => {
    if (open !== prevOpenRef.current) {
      logger.info('QR dialog open state changed: ' + open, 'SelfVerify')
      if (open) {
        logger.info('isMobile: ' + isMobile + ', isWalletBrowser: ' + isWalletBrowser, 'SelfVerify')
        logger.info('selfApp configured: ' + !!selfApp, 'SelfVerify')
        logger.info('endpoint: ' + (selfApp?.endpoint || 'unknown'), 'SelfVerify')
      }
      prevOpenRef.current = open
    }
  }, [open, isMobile, isWalletBrowser, selfApp])

  // Detectar cuando el usuario vuelve de la app Self (focus gain)
  // En mobile sin SelfQRcodeWrapper, el onSuccess no se dispara automáticamente
  const focusReturnRef = useRef(false)
  useEffect(() => {
    if (!open) return
    focusReturnRef.current = false
    const onFocus = () => {
      logger.info('Window regained focus - user may have returned from Self app', 'SelfVerify')
      // En mobile path (sin SelfQRcodeWrapper), asumimos que Self completó
      // y llamamos onSuccess para cerrar el diálogo y recargar perfil
      if (isMobile && !isWalletBrowser && !focusReturnRef.current) {
        focusReturnRef.current = true
        logger.info('Mobile path: calling onSuccess after focus return', 'SelfVerify')
        onSuccess()
      }
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [open, isMobile, isWalletBrowser, onSuccess])

  const handleCancel = () => {
    logger.info('QR dialog cancelled by user', 'SelfVerify')
    onOpenChange(false)
  }

  // Translation helper
  const t = useMemo(() => createComponentT(lang, {
    en: {
      verifyWithSelf: 'Verify with Self',
      mobileDesc: 'Tap the button below to open the Self application and complete verification.',
      desktopDesc: 'Open the Self application on your phone and scan this QR code to verify your identity.',
      walletBrowserDesc: 'Self app cannot open from within a wallet browser. Please use Safari/Chrome or scan the QR code below to complete verification.',
      ensureInstalled: 'Make sure you have the Self app installed on your device.',
      openSelf: 'Open Self App',
      cancel: 'Cancel',
      mobileVerificationFailed: 'Mobile verification failed: {{0}}',
      verificationFailed: 'Verification failed',
    },
    es: {
      verifyWithSelf: 'Verificar con Self',
      mobileDesc: 'Toca el botón de abajo para abrir la aplicación Self y completar la verificación.',
      desktopDesc: 'Abre la aplicación Self en tu teléfono y escanea este código QR para verificar tu identidad.',
      walletBrowserDesc: 'La aplicación Self no puede abrirse desde un navegador de billetera. Usa Safari/Chrome o escanea el código QR para completar la verificación.',
      ensureInstalled: 'Asegúrate de tener la aplicación Self instalada en tu dispositivo.',
      openSelf: 'Abrir App Self',
      cancel: 'Cancelar',
      mobileVerificationFailed: 'Falló la verificación móvil: {{0}}',
      verificationFailed: 'Falló la verificación',
    },
  }), [lang])

  const handleMobileVerify = async () => {
    if (onMobileVerify) {
      try {
        logger.info('onMobileVerify called - opening Self app via deep link', 'SelfVerify')
        onMobileVerify()
      } catch (error) {
        const message = t('mobileVerificationFailed', String(error))
        console.error('Error opening Self app:', message)
        alert(message)
        throw error
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('verifyWithSelf')}
          </DialogTitle>
          <DialogDescription>
            {isWalletBrowser
              ? t('walletBrowserDesc')
              : isMobile
                ? t('mobileDesc')
                : t('desktopDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-6">
          {isMobile && !isWalletBrowser ? (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                {t('ensureInstalled')}
              </p>
              <Button
                onClick={handleMobileVerify}
                type="button"
                className="w-full"
                size="lg"
              >
                {t('openSelf')}
              </Button>
            </div>
          ) : (
            selfApp && !selfError ? (
              <div className="w-full max-w-sm">
                <React.Suspense fallback={<div className="text-center py-4 text-muted-foreground">Loading QR code...</div>}>
                  <SelfQRcodeWrapper
                    selfApp={selfApp}
                    onSuccess={() => {
                      logger.info('SelfQRcodeWrapper onSuccess fired - verification completed', 'SelfVerify')
                      onSuccess()
                    }}
                    onError={(error: any) => {
                      const errorStr = error?.message || error?.reason || (error ? String(error) : null)
                      const finalError = errorStr || t('verificationFailed')
                      logger.error('SelfQRcodeWrapper error: ' + finalError, 'SelfVerify')
                      if (finalError.includes('slice') || error?.stack?.includes('slice')) {
                        logger.error('d.slice error detected in Self SDK - possible data format mismatch', 'SelfVerify')
                      }
                      onError(finalError)
                    }}
                  />
                </React.Suspense>
              </div>
            ) : selfError ? (
              <div className="text-center py-4 text-red-500">
                <p>Verification error: {selfError}</p>
              </div>
            ) : null
          )}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="w-full sm:w-auto"
          >
            {t('cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
