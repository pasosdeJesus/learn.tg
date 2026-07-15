'use client'

import { ClaimSDK, IdentitySDK } from '@goodsdks/citizen-sdk'
import { useSession } from 'next-auth/react'
import { useState, useMemo } from 'react'
import { usePublicClient, useWalletClient } from '@/lib/hooks/useWallet'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'

import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import { useToast } from '@pasosdejesus/m/shadcn-components/ui/use-toast'
import { IS_PRODUCTION } from '@/lib/config'
import { createComponentT } from '@/lib/hooks/useTranslation'

export interface GoodDollarClaimButtonProps {
  lang?: string
  buttonText?: string
}

export default function GoodDollarClaimButton({
  lang = 'en',
  buttonText,
}: GoodDollarClaimButtonProps) {
  const { address } = useAuthAddress()
  const { data: session } = useSession()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { toast } = useToast()
  const [isClaiming, setIsClaiming] = useState(false)

  const sdkEnv = IS_PRODUCTION ? 'production' : 'development'

  const identitySDK = useMemo(() => {
    if (typeof window === 'undefined' || !publicClient || !walletClient || !address) return null
    try {
      return new IdentitySDK({
        publicClient: publicClient as any,
        walletClient: walletClient as any,
        env: sdkEnv as any,
      })
    } catch {
      return null
    }
  }, [publicClient, walletClient, address, sdkEnv])

  const t = useMemo(() => createComponentT(lang, {
    en: {
      claimSuccess: 'Claim successful',
      claimFailed: 'Claim failed: {{0}}',
      signUp: 'Sign up with GoodDollar or Claim UBI',
      claiming: 'Claiming...',
      connectPrompt: 'Connect your wallet to claim',
    },
    es: {
      claimSuccess: 'Reclamo exitoso',
      claimFailed: 'Reclamo fallido: {{0}}',
      signUp: 'Regístrate con GoodDollar o reclama UBI',
      claiming: 'Reclamando...',
      connectPrompt: 'Conecta tu billetera para reclamar',
    },
  }), [lang])

  const handleClaim = async () => {
    if (!session?.address || !publicClient || !walletClient || !identitySDK) {
      toast({ title: t('connectPrompt'), variant: 'destructive' })
      return
    }

    setIsClaiming(true)
    try {
      const claimSDK = new ClaimSDK({
        account: session.address as `0x${string}`,
        publicClient: publicClient as any,
        walletClient: walletClient as any,
        identitySDK,
        env: sdkEnv,
      })

      await (claimSDK as any).claim()
      toast({ title: t('claimSuccess') })
    } catch (e: any) {
      console.error('GoodDollar claim error:', e)
      toast({ title: t('claimFailed', e?.message || 'Unknown error'), variant: 'destructive' })
    } finally {
      setIsClaiming(false)
    }
  }

  const hasWallet = !!(session && address && identitySDK)

  return (
    <Button
      onClick={handleClaim}
      disabled={isClaiming || !hasWallet}
      variant="default"
      size="sm"
    >
      {isClaiming ? t('claiming') : buttonText || t('signUp')}
      {!hasWallet && (
        <span className="block text-xs text-gray-500 mt-1">{t('connectPrompt')}</span>
      )}
    </Button>
  )
}
