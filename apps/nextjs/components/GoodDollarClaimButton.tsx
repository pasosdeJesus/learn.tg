'use client'

import { ClaimSDK } from '@goodsdks/citizen-sdk'
import { useIdentitySDK } from '@goodsdks/react-hooks'
import { useSession } from 'next-auth/react'
import { useState, useMemo } from 'react'
import { usePublicClient, useWalletClient } from 'wagmi'
import { useAccount } from 'wagmi'

import { Button } from '@/components/ui/button'
import { IS_PRODUCTION } from '@/lib/config'
import { createComponentT } from '@/lib/hooks/useTranslation'

export interface GoodDollarClaimButtonProps {
  lang?: string
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

  const sdkEnv = IS_PRODUCTION ? 'production' : 'development'
  const identitySDK = useIdentitySDK(sdkEnv)

  const t = useMemo(() => createComponentT(lang, {
    en: {
      sessionRequired: 'Session and connected wallet are required',
      sdkInitError: 'Failed to initialize GoodDollar SDK',
      claimSuccess: 'Claim successful. Claim number {{0}}',
      claimFailed: 'Claim failed: {{0}}',
      signUp: 'Sign up with GoodDollar or Claim UBI',
      claiming: 'Claiming...',
      connectPrompt: 'Connect your wallet to claim',
    },
    es: {
      sessionRequired: 'Se requiere sesión y billetera conectada',
      sdkInitError: 'Error al inicializar el SDK de GoodDollar',
      claimSuccess: 'Reclamo exitoso. Reclamo número {{0}}',
      claimFailed: 'Reclamo fallido: {{0}}',
      signUp: 'Regístrate con GoodDollar o reclama UBI',
      claiming: 'Reclamando...',
      connectPrompt: 'Conecta tu billetera para reclamar',
    },
  }), [lang])

  const handleClaim = async () => {
    if (!session || !address || session.address !== address || !publicClient || !walletClient || !identitySDK) {
      setError(t('sessionRequired'))
      return
    }

    setIsClaiming(true)
    setError(null)

    if (!identitySDK.sdk) {
      setError(t('sdkInitError'))
      setIsClaiming(false)
      return
    }

    const claimSDK = new ClaimSDK({
      account: session.address,
      publicClient,
      walletClient,
      identitySDK: identitySDK.sdk,
      env: sdkEnv,
    })

    try {
      const result = await claimSDK.claim()
      const txHash = (result as any)?.transactionHash ?? ''

      if (session?.address && (session.user as any)?.token) {
        const regResponse = await fetch('/api/register-gooddollar-claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: session.address,
            token: (session.user as any).token,
            txHash,
          }),
        })
        const regData = await regResponse.json()
        const claimNum = regData.claimNumber || ''
        alert(t('claimSuccess', claimNum))
      } else {
        alert(t('claimSuccess', ''))
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : JSON.stringify(err, null, 2)
      setError(t('claimFailed', errorMessage))
      alert(t('claimFailed', errorMessage))
    } finally {
      setIsClaiming(false)
    }
  }

  const defaultButtonText = t('signUp')
  const finalButtonText = buttonText || defaultButtonText

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <Button
        onClick={handleClaim}
        size="lg"
        disabled={isClaiming || !session || !address}
      >
        {isClaiming ? t('claiming') : finalButtonText}
      </Button>
      {error && (
        <div className="text-sm text-red-600 mt-2 text-center">{error}</div>
      )}
      {(!session || !address) && (
        <div className="text-sm text-gray-500 mt-2 text-center">
          {t('connectPrompt')}
        </div>
      )}
    </div>
  )
}

export default GoodDollarClaimButton
