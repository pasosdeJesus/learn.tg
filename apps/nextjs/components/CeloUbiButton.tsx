'use client'

import { useState } from 'react'
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

  const [claimState, setClaimState] = useState<ClaimStatus>('idle')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null)

  const t = (key: string, params?: { amount?: string }) => {
    const translations: { [key: string]: { [lang: string]: string } } = {
      claimButton: { es: 'Reclamar Learn.tg-IBU', en: 'Claim Learn.tg-UBI' },
      loading: { es: 'Cargando...', en: 'Loading...' },
      claiming: { es: 'Reclamando...', en: 'Claiming...' },
      mustLogin: { es: 'Debes iniciar sesión para reclamar', en: 'You must be logged in to claim' },
      error: { es: 'Error', en: 'Error' },
      close: { es: 'Cerrar', en: 'Close' },
      successTitle: { es: 'Reclamo Exitoso', en: 'Claim Successful' },
      claimErrorTitle: { es: 'Error en el Reclamo', en: 'Claim Error' },
      viewTransaction: { es: 'Ver transacción', en: 'View Transaction' },
      successMessage: {
        es: `¡Reclamo exitoso! Has recibido {amount} Celo de Learn.tg-IBU.`,
        en: `Claim successful! You have received {amount} Celo of Learn.tg-UBI.`,
      },
    }
    let message = translations[key]?.[lang] || key;
    if (params?.amount) {
      message = message.replace('{amount}', params.amount);
    }
    return message;
  }

  const handleClaimClick = async () => {
    if (!session?.address) {
      setClaimResult({ message: t('mustLogin') })
      setClaimState('error')
      setDialogOpen(true)
      return
    }

    setClaimState('loading')
    setDialogOpen(true)
    setClaimResult(null)

    try {
      const csrfToken = await getCsrfToken()
      const response = await axios.post('/api/claim-celo-ubi', {
        walletAddress: session.address,
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
