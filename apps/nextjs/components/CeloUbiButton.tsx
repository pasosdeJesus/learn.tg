'use client'

import { useState, useMemo } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'
import axios from 'axios'
import { getCsrfToken, useSession } from 'next-auth/react'
import Link from 'next/link'

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
      profileTitle: 'Complete your profile to claim UBI',
      profileBody: 'To claim Learn.tg-UBI you need a profile score of at least 50. Complete and verify your profile:',
      profilePassport: 'If you have a passport: verify your identity with self.xyz from your profile.',
      profileSierraLeone: 'If you are in Sierra Leone: schedule a verification appointment and a verifier will confirm your data.',
      profileButton: 'Go to my profile',
      profileHint: 'You reach the score by completing your data and getting it verified.',
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
      profileTitle: 'Completa tu perfil para reclamar IBU',
      profileBody: 'Para reclamar Learn.tg-IBU necesitas un puntaje de perfil de al menos 50. Completa y verifica tu perfil:',
      profilePassport: 'Si tienes pasaporte: verifica tu identidad con self.xyz desde tu perfil.',
      profileSierraLeone: 'Si estás en Sierra Leona: agenda una cita de verificación y un verificador confirmará tus datos.',
      profileButton: 'Ir a mi perfil',
      profileHint: 'Alcanzas el puntaje completando tus datos y verificándolos.',
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
      const csrfToken = localStorage.getItem("learn.tg.authToken") || await getCsrfToken()
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
        // Error específico de puntaje de perfil → guía amigable (como
        // GasInsufficientPanel): completar perfil (self.xyz) o agendar
        // verificación (Sierra Leona).
        if ((claimResult.message || '').includes('Profile score must be at least')) {
          return (
            <div className="text-center py-2">
              <div className="text-4xl mb-3">🎓</div>
              <h3 className="text-xl font-semibold mb-2">{t('profileTitle')}</h3>
              <p className="text-sm text-gray-700 mb-4">{t('profileBody')}</p>
              <div className="space-y-2 text-left text-sm mb-5">
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                  🛂 {t('profilePassport')}
                </div>
                <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                  🇸🇱 {t('profileSierraLeone')}
                </div>
              </div>
              <Link
                href={`/${lang}/profile`}
                className="inline-block rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                {t('profileButton')}
              </Link>
              <p className="text-xs text-gray-500 mt-4">💡 {t('profileHint')}</p>
            </div>
          )
        }
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
      <Button onClick={handleClaimClick} disabled={claimState === 'loading' || !sessionAddress} size="lg">
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
