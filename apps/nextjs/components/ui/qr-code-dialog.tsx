'use client'

import * as React from 'react'
import { SelfQRcodeWrapper } from '@selfxyz/qrcode'
import { Button } from '@/components/ui/button'
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
  const t = (en: string, es: string) => (lang === 'es' ? es : en)

  const handleMobileVerify = async () => {
    if (onMobileVerify) {
      try {
        onMobileVerify()
      } catch (error) {
        const message = t(
          `Mobile verification failed: ${error}`,
          `Falló la verificación móvil: ${error}`,
        )
        console.error('Error opening Self app:', message)
        alert(message)
        throw error // Re-throw to be caught by dialog error handler
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
            {isMobile
              ? t(
                  'Tap the button below to open the Self application and complete verification.',
                  'Toca el botón de abajo para abrir la aplicación Self y completar la verificación.',
                )
              : t(
                  'Open the Self application on your phone and scan this QR code to verify your identity.',
                  'Abre la aplicación Self en tu teléfono y escanea este código QR para verificar tu identidad.',
                )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-6">
          {isMobile ? (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                {t(
                  'Make sure you have the Self app installed on your device.',
                  'Asegúrate de tener la aplicación Self instalada en tu dispositivo.',
                )}
              </p>
              <Button
                onClick={handleMobileVerify}
                type="button"
                className="w-full"
                size="lg"
              >
                {t('Open Self App', 'Abrir App Self')}
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
