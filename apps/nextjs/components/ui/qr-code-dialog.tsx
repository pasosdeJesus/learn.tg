'use client'

import * as React from 'react'
import { useMemo, useEffect, useRef } from 'react'
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
  lang?: string
}

export function QRCodeDialog({
  open,
  onOpenChange,
  selfApp,
  onSuccess,
  onError,
  lang = 'en',
}: QRCodeDialogProps) {
  const prevOpenRef = useRef(open)

  useEffect(() => {
    if (open !== prevOpenRef.current) {
      logger.info('QR dialog open state changed: ' + open, 'SelfVerify')
      if (open) {
        logger.info('selfApp configured: ' + !!selfApp, 'SelfVerify')
        logger.info('endpoint: ' + (selfApp?.endpoint || 'unknown'), 'SelfVerify')
      }
      prevOpenRef.current = open
    }
  }, [open, selfApp])

  const handleCancel = () => {
    logger.info('QR dialog cancelled by user', 'SelfVerify')
    onOpenChange(false)
  }

  const t = useMemo(() => createComponentT(lang, {
    en: {
      verifyWithSelf: 'Verify with Self',
      desc: 'Open the Self application on your phone and scan the QR code, or tap the link on mobile to verify your identity.',
      cancel: 'Cancel',
      verificationFailed: 'Verification failed',
    },
    es: {
      verifyWithSelf: 'Verificar con Self',
      desc: 'Abre la aplicación Self en tu teléfono y escanea el código QR, o toca el enlace en tu móvil para verificar tu identidad.',
      cancel: 'Cancelar',
      verificationFailed: 'Falló la verificación',
    },
  }), [lang])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('verifyWithSelf')}
          </DialogTitle>
          <DialogDescription>
            {t('desc')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-6">
          {selfApp ? (
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
                    onError(finalError)
                  }}
                />
              </React.Suspense>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              Configuring verification...
            </div>
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
