'use client'

import { useState, useMemo } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'
import axios from 'axios'
import { getCsrfToken, useSession } from 'next-auth/react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export interface CeloUbiButtonProps {
  lang?: string
}

type ClaimStatus = 'idle' | 'loading' | 'success' | 'error'

interface ClaimResult {
  message: string;
  txHash?: string;
  amount?: string;
}

export function CeloUbiButton({ lang = 'en' }: CeloUbiButtonProps) {
  const { data: session } = useSession()
  const sessionAddress = session?.address || (typeof window !== "undefined" ? localStorage.getItem("learn.tg.sessionAddress") : null)

  const [claimState, setClaimState] = useState<ClaimStatus>('idle')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null)

  const t = useMemo(() => createComponentT(lang, {
    en: {
      claimButton: 'Claim Learn.tg-UBI',
      loading: 'Loading...',
      claiming: 'Claiming...',
      mustLogin: 'You must be logged in to claim',
      error: 'Error',
      close: 'Close',
      successTitle: 'Claim Successful',
      claimErrorTitle: 'Claim Error',
      viewTransaction: 'View Transaction',
      successMessage: 'Claim successful! You have received {{0}} Celo of Learn.tg-UBI.',
    },
    es: {
      claimButton: 'Reclamar Learn.tg-IBU',
      loading: 'Cargando...',
      claiming: 'Reclamando...',
      mustLogin: 'Debes iniciar sesión para reclamar',
      error: 'Error',
      close: 'Cerrar',
      successTitle: 'Reclamo Exitoso',
      claimErrorTitle: 'Error en el Reclamo',
      viewTransaction: 'Ver transacción',
      successMessage: '¡Reclamo exitoso! Has recibido {{0}} Celo de Learn.tg-IBU.',
    },
  }), [lang])

  const handleClaimClick = async () => {
    if (!sessionAddress) {
      setClaimResult({ message: t('mustLogin') })
      setClaimState('error')
      setDialogOpen(true)
      return
    }

    setClaimState('loading')
    setDialogOpen(true)
    setClaimResult(null)

    try {
      const csrfToken = await getCsrfToken() || localStorage.getItem("learn.tg.authToken")
      const response = await axios.post('/api/claim-celo-ubi', {
        walletAddress: sessionAddress,
        token: csrfToken,
      })
      
      setClaimResult(response.data)
      setClaimState('success')
    } catch (err: any) {
      let errorMessage = t('claimErrorTitle');
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      setClaimResult({ message: errorMessage })
      setClaimState('error')
    }
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setTimeout(() => {
        setClaimState('idle')
        setClaimResult(null)
    }, 300)
  }
  
  const renderDialogContent = () => {
    if (claimState === 'loading' || !claimResult) {
        return <div className="py-4">{t('loading')}</div>
    }

    switch (claimState) {
      case 'success':
        return (
          <DialogHeader>
            <DialogTitle>{t('successTitle')}</DialogTitle>
            <DialogDescription className="py-4">
              {claimResult.message}
              {claimResult.txHash && (
                <div className="mt-4">
                  <a
                    href={`${process.env.NEXT_PUBLIC_EXPLORER_TX}/${claimResult.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {t('viewTransaction')}
                  </a>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
        )
      case 'error':
        return (
          <DialogHeader>
            <DialogTitle>{t('claimErrorTitle')}</DialogTitle>
            <DialogDescription className="py-4 text-red-600">{claimResult.message}</DialogDescription>
          </DialogHeader>
        )
      default:
        return null
    }
  }

  return (
    <>
      <Button onClick={handleClaimClick} disabled={claimState === 'loading' || !session} size="lg">
        {claimState === 'loading' ? t('claiming') : t('claimButton')}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-[425px]">
          {renderDialogContent()}
          <DialogFooter>
            <Button onClick={closeDialog} disabled={claimState === 'loading'}>{t('close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default CeloUbiButton
