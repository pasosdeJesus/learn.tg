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
  // Brave se detecta primero porque su wallet inyecta isMetaMask=true por compatibilidad
  const isBrave = ua.includes('brave') || typeof (navigator as any).brave !== 'undefined'
  const isWalletBrowser = !isBrave && typeof window !== 'undefined' && (
    ['okx', 'onekey', 'metamask', 'trust wallet'].some(p => ua.includes(p)) ||
    (window as any).ethereum?.isOneKey === true ||
    (window as any).ethereum?.isOkxWallet === true ||
    (window as any).ethereum?.isMetaMask === true ||
    ua.includes('; wv')
  )

  useEffect(() => {
    if (open !== prevOpenRef.current) {
      logger.info('QR dialog open state changed: ' + open, 'SelfVerify')
      if (open) {
        logger.info('selfApp configured: ' + !!selfApp, 'SelfVerify')
        logger.info('endpoint: ' + (selfApp?.endpoint || 'unknown'), 'SelfVerify')
        // Diagnóstico de detección
        logger.info('DIAG: isMobile=' + isMobile + ' ua="' + ua + '"', 'SelfVerify')
        logger.info('DIAG: uaIncludesBrave=' + ua.includes('brave') + ' navigator.brave=' + typeof (navigator as any).brave, 'SelfVerify')
        logger.info('DIAG: uaIncludesWv=' + ua.includes('; wv') + ' uaIncludesMetaMask=' + ua.includes('metamask') + ' uaIncludesOneKey=' + ua.includes('onekey') + ' uaIncludesOKX=' + ua.includes('okx'), 'SelfVerify')
        logger.info('DIAG: ethereum.isMetaMask=' + ((window as any).ethereum?.isMetaMask) + ' ethereum.isOneKey=' + ((window as any).ethereum?.isOneKey) + ' ethereum.isOkxWallet=' + ((window as any).ethereum?.isOkxWallet), 'SelfVerify')
        logger.info('DIAG: isWalletBrowser=' + isWalletBrowser, 'SelfVerify')
      }
      prevOpenRef.current = open
    }
  }, [open, selfApp, isMobile, isWalletBrowser, ua])

  const handleCancel = () => {
    logger.info('QR dialog cancelled by user', 'SelfVerify')
    onOpenChange(false)
  }

  const t = useMemo(() => createComponentT(lang, {
    en: {
      verifyWithSelf: 'Verify with Self',
      openSelf: 'Open Self App',
      walletDesc: 'Scan the QR code with another device\'s camera to verify, or copy the link to open in a browser.',
      copyLink: 'Copy link',
      linkCopied: 'Copied!',
      cancel: 'Cancel',
      verificationFailed: 'Verification failed',
    },
    es: {
      verifyWithSelf: 'Verificar con Self',
      openSelf: 'Abrir App Self',
      walletDesc: 'Escanea el código QR con la cámara de otro dispositivo para verificar, o copia el enlace para abrirlo en un navegador.',
      copyLink: 'Copiar enlace',
      linkCopied: '¡Copiado!',
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
    // Intentar clipboard API moderna
    navigator.clipboard.writeText(link).then(() => {
      setLinkCopied(true)
      logger.info('Self link copied to clipboard', 'SelfVerify')
      setTimeout(() => setLinkCopied(false), 3000)
    }).catch(() => {
      // Fallback: textarea oculto + execCommand (funciona en más WebViews)
      const ta = document.createElement('textarea')
      ta.value = link
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
        setLinkCopied(true)
        logger.info('Self link copied via fallback', 'SelfVerify')
        setTimeout(() => setLinkCopied(false), 3000)
      } catch {
        logger.error('Failed to copy link', 'SelfVerify')
        alert('Could not copy. Long-press the QR code and open the link in your browser.')
      }
      document.body.removeChild(ta)
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
