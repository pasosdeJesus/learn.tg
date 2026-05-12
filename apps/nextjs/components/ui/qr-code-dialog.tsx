'use client'

import * as React from 'react'
import { useMemo, useEffect, useRef } from 'react'
import { SelfQRcodeWrapper } from '@selfxyz/qrcode'
import { getUniversalLink } from '@selfxyz/core'
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
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : ''
  const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)
  // Detección de wallet browsers: nombre en user-agent, inyección de ethereum, o WebView
  const isWalletBrowser = typeof window !== 'undefined' && (
    ['okx', 'onekey', 'metamask', 'trust wallet'].some(p => ua.includes(p)) ||
    (window as any).ethereum?.isOneKey === true ||
    (window as any).ethereum?.isOkxWallet === true ||
    (window as any).ethereum?.isMetaMask === true ||
    // WebView en Android, pero excluir Brave (funciona con deep link)
    (!ua.includes('brave') && ua.includes('; wv'))
  )

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
      openSelf: 'Open Self App',
      walletDesc: 'Copy the link to the clipboard, then open the Self app, tap the paste icon to load the link and continue the verification there.',
      copyLink: 'Copy deferred link',
      linkCopied: 'Link copied!',
      cancel: 'Cancel',
      verificationFailed: 'Verification failed',
    },
    es: {
      verifyWithSelf: 'Verificar con Self',
      openSelf: 'Abrir App Self',
      walletDesc: 'Copia el enlace al portapapeles, luego abre la aplicación Self, toca el icono de pegar para cargar el enlace y continuar la verificación allí.',
      copyLink: 'Copiar enlace',
      linkCopied: '¡Enlace copiado!',
      cancel: 'Cancelar',
      verificationFailed: 'Falló la verificación',
    },
  }), [lang])

  const [linkCopied, setLinkCopied] = React.useState(false)
  const handleOpenSelf = () => {
    if (!selfApp) return
    const link = getUniversalLink(selfApp)
    logger.info('Opening Self deeplink: ' + link, 'SelfVerify')
    window.location.href = link
  }
  const handleCopyLink = () => {
    if (!selfApp) return
    const link = getUniversalLink(selfApp)
    navigator.clipboard.writeText(link).then(() => {
      setLinkCopied(true)
      logger.info('Self link copied to clipboard', 'SelfVerify')
      setTimeout(() => setLinkCopied(false), 3000)
    }).catch((err) => {
      logger.error('Failed to copy link: ' + err, 'SelfVerify')
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('verifyWithSelf')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-6">
          {selfApp ? (
            <div className="w-full max-w-sm space-y-4">
              {!isMobile && (
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
              )}
              {isMobile && !isWalletBrowser && (
                <Button onClick={handleOpenSelf} type="button" className="w-full" size="lg">
                  {t('openSelf')}
                </Button>
              )}
              {isMobile && isWalletBrowser && (
                <div className="space-y-3">
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
                  <p className="text-sm text-muted-foreground text-center">
                    {t('walletDesc')}
                  </p>
                  <Button
                    onClick={handleCopyLink}
                    type="button"
                    className="w-full"
                    size="lg"
                    variant="outline"
                  >
                    {linkCopied ? t('linkCopied') + ' ✓' : t('copyLink')}
                  </Button>
                </div>
              )}
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
