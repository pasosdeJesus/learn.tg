'use client'

import { ClaimSDK, useIdentitySDK } from '@goodsdks/citizen-sdk'
import { useSession } from 'next-auth/react'
import { useState } from 'react'
import { usePublicClient, useWalletClient } from 'wagmi'
import { useAccount } from 'wagmi'

import { Button } from '@/components/ui/button'
import { IS_PRODUCTION } from '@/lib/config'

export interface GoodDollarClaimButtonProps {
  /** Current language ('en' or 'es') for button text */
  lang?: string
  /** Text to display on the button */
  buttonText?: string
}

export function GoodDollarClaimButton({
  lang = 'en',
  buttonText,
}: GoodDollarClaimButtonProps) {
  const { address } = useAccount()
  const { data: session } = useSession()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const [isClaiming, setIsClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // RULE OF HOOKS: Hooks must be called unconditionally at the top level.
  const identitySDK = useIdentitySDK('production')

  const handleClaim = async () => {
    // Conditional logic based on environment should be inside handlers or effects.
    if (!IS_PRODUCTION) {
      setError(
        lang === 'es'
          ? 'Funciona solo en mainnet con billetera conectada'
          : 'Works only in mainnet with wallet connected',
      )
      return
    }

    if (
      !session ||
      !address ||
      session.address !== address ||
      !publicClient ||
      !walletClient ||
      !identitySDK
    ) {
      setError(
        lang === 'es'
          ? 'Se requiere sesión y billetera conectada'
          : 'Session and connected wallet are required',
      )
      return
    }

    setIsClaiming(true)
    setError(null)

    const claimSDK = new ClaimSDK({
      account: session.address,
      publicClient,
      walletClient,
      identitySDK,
      env: 'production',
    })

    try {
      const result = await claimSDK.claim()
      console.log('Claim successful', result)

      if (session.user && (session.user as any).token) {
        fetch('/api/register-gooddollar-claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: address,
            token: (session.user as any).token,
            tx: (result as any)?.blockHash ?? '',
          }),
        }).catch((e) => console.error("Couldn't register g$c claim", e))
      }

      alert(lang === 'es' ? 'Reclamo exitoso' : 'Claim successful')
    } catch (err) {
      console.error('Claim failed:', err)
      const errorMessage =
        err instanceof Error ? err.message : JSON.stringify(err, null, 2)
      setError(
        `${lang === 'es' ? 'Reclamo fallido:' : 'Claim failed:'} ${errorMessage}`,
      )
      alert(
        `${lang === 'es' ? 'Reclamo fallido:' : 'Claim failed:'} ${errorMessage}`,
      )
    } finally {
      setIsClaiming(false)
    }
  }

  const defaultButtonText =
    lang === 'es'
      ? 'Regístrate con GoodDollar o reclama UBI'
      : 'Sign up with GoodDollar or Claim UBI'
  const finalButtonText = buttonText || defaultButtonText

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <Button
        onClick={handleClaim}
        size="lg"
        disabled={isClaiming || !session || !address}
      >
        {isClaiming
          ? lang === 'es'
            ? 'Reclamando...'
            : 'Claiming...'
          : finalButtonText}
      </Button>
      {error && (
        <div className="text-sm text-red-600 mt-2 text-center">{error}</div>
      )}
      {(!session || !address) && (
        <div className="text-sm text-gray-500 mt-2 text-center">
          {lang === 'es'
            ? 'Conecta tu billetera para reclamar'
            : 'Connect your wallet to claim'}
        </div>
      )}
    </div>
  )
}

export default GoodDollarClaimButton
