'use client'

import * as React from 'react'
import { useMemo } from 'react'
import { SelfQRcodeWrapper } from '@selfxyz/qrcode'
import { Button } from '@/components/ui/button'
import { createComponentT } from '@/lib/hooks/useTranslation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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
  const handleCancel = () => {
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

  const isWalletBrowser = typeof navigator !== 'undefined' &&
    ['okx', 'onekey', 'metamask', 'trust wallet'].some(p =>
      navigator.userAgent.toLowerCase().includes(p))

  const handleMobileVerify = async () => {
    if (onMobileVerify) {
      try {
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
            {t('Verify with Self', 'Verificar con Self')}
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
            selfApp && (
              <div className="w-full max-w-sm">
                <SelfQRcodeWrapper
                  selfApp={selfApp}
                  onSuccess={onSuccess}
                  onError={(error) => {
                    console.error('QR code verification error:', error)
                    const errorMessage =
                      error?.reason ||
                      t('Verification failed', 'Falló la verificación')
                    onError(errorMessage)
                  }}
                />
              </div>
            )
          )}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="w-full sm:w-auto"
          >
            {t('Cancel', 'Cancelar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
