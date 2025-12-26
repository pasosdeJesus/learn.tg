'use client'

import { useSession } from 'next-auth/react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

export interface CeloSupportStreamButtonProps {
  /** Current language ('en' or 'es') for button text */
  lang?: string
}

export function CeloSupportStreamButton({
  lang = 'en',
}: CeloSupportStreamButtonProps) {
  const { data: session } = useSession()
  const [isClaiming, setIsClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleClaim = async () => {
    if (!session) {
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

    try {
      const response = await fetch('/api/claim-celo-ubi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || (lang === 'es' ? 'Ocurrió un error' : 'An error occurred'))
      }

      setSuccess(data.message || (lang === 'es' ? 'Reclamo exitoso!' : 'Claim successful!'))
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : JSON.stringify(err, null, 2)
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

export default CeloSupportStreamButton
