'use client'

import { ClaimSDK, IdentitySDK } from '@goodsdks/citizen-sdk'
import { useSession } from 'next-auth/react'
import { useState, useMemo } from 'react'
import { useInAppWallet } from '@learn-tg/pdj-wallet-next'
import { usePublicClient, useWalletClient } from '@/lib/hooks/useWallet'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { openInAppWalletDialog } from '@/lib/in-app-wallet-dialog'
import { getAppChain } from '@/lib/app-chain'
import { isGoodDollarReady, resolveGoodDollarReason } from '@/lib/gooddollar-reason'

import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import { useToast } from '@pasosdejesus/m/shadcn-components/ui/use-toast'
import { IS_PRODUCTION } from '@learn-tg/rewards/lib/config'
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
  const { status: inAppStatus, biometricEnabled } = useInAppWallet()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { toast } = useToast()
  const [isClaiming, setIsClaiming] = useState(false)

  const sdkEnv = IS_PRODUCTION ? 'production' : 'development'

  const { identitySDK, sdkError } = useMemo(() => {
    if (typeof window === 'undefined' || !publicClient || !walletClient || !address) {
      return { identitySDK: null, sdkError: null }
    }
    try {
      const sdk = new IdentitySDK({
        account: address as `0x${string}`,
        publicClient: publicClient as any,
        walletClient: walletClient as any,
        env: sdkEnv as any,
      })
      return { identitySDK: sdk, sdkError: null }
    } catch (error) {
      return { identitySDK: null, sdkError: error }
    }
  }, [publicClient, walletClient, address, sdkEnv])

  const t = useMemo(() => createComponentT(lang, {
    en: {
      claimSuccess: 'Claim successful',
      claimFailed: 'Claim failed: {{0}}',
      signUp: 'Sign up with GoodDollar or Claim UBI',
      claiming: 'Claiming...',
      connectPrompt: 'Connect your wallet to claim',
      inAppLocked: 'Your in-app wallet is locked. Unlock it with your password to verify with GoodDollar.',
      inAppLockedGesture: 'Your in-app wallet is locked. Confirm with your fingerprint or Face ID to verify with GoodDollar.',
      unlockInApp: 'Unlock your in-app wallet',
      unlockInAppGesture: 'Unlock with fingerprint or Face ID',
      providerUnsupported: 'This wallet cannot sign the GoodDollar verification here. Try an external wallet (MetaMask, Rabby).',
      networkUnsupported: 'GoodDollar UBI is only on Celo mainnet (and Fuse/XDC). On this network use learn.tg-UBI (CELO).',
      sdkUnavailable: 'GoodDollar is not available right now. Try again later.',
    },
    es: {
      claimSuccess: 'Reclamo exitoso',
      claimFailed: 'Reclamo fallido: {{0}}',
      signUp: 'Regístrate con GoodDollar o reclama UBI',
      claiming: 'Reclamando...',
      connectPrompt: 'Conecta tu billetera para reclamar',
      inAppLocked: 'Tu billetera in-app está bloqueada. Desbloquéala con tu contraseña para verificar con GoodDollar.',
      inAppLockedGesture: 'Tu billetera in-app está bloqueada. Confirma con tu huella o Face ID para verificar con GoodDollar.',
      unlockInApp: 'Desbloquear tu billetera',
      unlockInAppGesture: 'Desbloquear con huella o Face ID',
      providerUnsupported: 'Esta billetera no puede firmar la verificación de GoodDollar aquí. Prueba una billetera externa (MetaMask, Rabby).',
      networkUnsupported: 'El UBI de GoodDollar es solo en la red principal de Celo (y Fuse/XDC). En esta red usa learn.tg-UBI (CELO).',
      sdkUnavailable: 'GoodDollar no está disponible en este momento. Inténtalo más tarde.',
    },
  }), [lang])

  const reason = resolveGoodDollarReason({
    hasAddress: !!(session?.address && address),
    hasWalletClient: !!walletClient,
    inAppStatus,
    hasIdentitySDK: !!identitySDK,
    sdkError,
    chainId: getAppChain().id,
  })

  const handleClaim = async () => {
    if (reason === 'locked') {
      openInAppWalletDialog()
      return
    }
    if (!isGoodDollarReady(reason) || !session?.address || !publicClient || !walletClient || !identitySDK) {
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
        rdu: typeof window !== 'undefined' ? window.location.href : undefined,
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

  const hintText =
    reason === 'no-wallet'
      ? t('connectPrompt')
      : reason === 'provider-unsupported'
        ? t('providerUnsupported')
        : reason === 'network-unsupported'
          ? t('networkUnsupported')
          : reason === 'sdk-error'
            ? t('sdkUnavailable')
            : ''

  const label =
    reason === 'locked'
      ? biometricEnabled
        ? t('unlockInAppGesture')
        : t('unlockInApp')
      : isClaiming
        ? t('claiming')
        : buttonText || t('signUp')

  return (
    <Button
      onClick={handleClaim}
      disabled={isClaiming || (!isGoodDollarReady(reason) && reason !== 'locked')}
      variant="default"
      size="sm"
      data-testid="gooddollar-claim-button"
      data-reason={reason}
    >
      {label}
      {hintText && (
        <span className="block text-xs text-gray-500 mt-1">{hintText}</span>
      )}
    </Button>
  )
}
