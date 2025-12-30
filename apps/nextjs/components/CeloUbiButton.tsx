'use client'

import axios from 'axios'
import { getCsrfToken, useSession } from 'next-auth/react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

export interface CeloUbiButtonProps {
  /** Current language (\'en\' or \'es\') for button text */
  lang?: string
}

export function CeloUbiButton({
  lang = 'en',
}: CeloUbiButtonProps) {
  const { data: session } = useSession()
  const [isClaiming, setIsClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  const handleClaim = async () => {
    if (!session?.address) {
      setError(
        lang === 'es'
          ? 'Debes iniciar sesión para reclamar'
          : 'You must be logged in to claim',
      )
      return
    }

    setIsClaiming(true)
    setError(null)
    setSuccess(null)
    setTxHash(null)

    try {
      const csrfToken = await getCsrfToken()
      const url = '/api/claim-celo-ubi'
      const response = await axios.post(
        url,
        {
          walletAddress: session.address,
          token: csrfToken,
        },
      )

      const data = response.data

      setSuccess(data.message || (lang === 'es' ? 'Reclamo exitoso!' : 'Claim successful!'))
      if (data.txHash) {
        setTxHash(data.txHash)
      }
    } catch (err) {
      let errorMessage = lang === 'es' ? 'Ocurrió un error' : 'An error occurred';
      if (axios.isAxiosError(err) && err.response) {
        errorMessage = err.response.data.message || err.message;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage)
    } finally {
      setIsClaiming(false)
    }
  }

  const buttonText = lang === 'es' ? 'Reclamar Apoyo de Celo' : 'Claim Celo Support'

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <Button
        onClick={handleClaim}
        size="lg"
        disabled={isClaiming || !session}
        data-testid="celo-ubi-button"
      >
        {isClaiming
          ? lang === 'es'
            ? 'Reclamando...'
            : 'Claiming...'
          : buttonText}
      </Button>
      {error && (
        <div className="text-sm text-red-600 mt-2 text-center">{error}</div>
      )}
      {success && (
        <div className="text-sm text-green-600 mt-2 text-center">{success}</div>
      )}
      {txHash && (
        <div className="text-sm text-gray-500 mt-2 text-center">
          <p>{lang === 'es' ? 'Transacción:' : 'Transaction:'}</p>
          <a
            href={`${process.env.NEXT_PUBLIC_EXPLORER_TX}/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {txHash}
          </a>
        </div>
      )}
      {!session && (
        <div className="text-sm text-gray-500 mt-2 text-center">
          {lang === 'es'
            ? 'Inicia sesión para reclamar'
            : 'Log in to claim'}
        </div>
      )}
    </div>
  )
}

export default CeloUbiButton
