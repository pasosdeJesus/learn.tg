'use client'

// Reference implementation: https://github.com/GoodDollar/GoodWallet
// (local clone /var/www/adJ-ia/GoodWallet; analysis in
// https://github.com/pasosdeJesus/learn.tg/issues/275)
//   src/gooddollar/stores/identityStore.ts                  -> getWhitelistedRoot / getWhitelistedOnChainId
//   src/gooddollar/methods/goodid.ts                        -> FV_IDENTIFIER_MSG2 + GoodID redirect
//   src/gooddollar/stores/ubiStore.ts                       -> checkEntitlement + claim()
//   src/sections/GoodDollar/components/Claim/ClaimView.tsx  -> the return + syncWhitelist
//
// The claim does NOT use @goodsdks/citizen-sdk: the SDK enforces its own
// verification-freshness policy that blocks a whitelisted, entitled address
// (measured 2026-10-01, https://github.com/pasosdeJesus/learn.tg/issues/275 §2). We read
// IdentityV2 / UBIScheme and claim directly, as GoodWallet does.

import { useSession } from 'next-auth/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { zeroAddress } from 'viem'
import { useInAppWallet } from '@learn-tg/pdj-wallet-next'
import { usePublicClient, useWalletClient } from '@/lib/hooks/useWallet'
import { useWriteContract } from '@/lib/hooks/useWriteContract'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { openInAppWalletDialog } from '@/lib/in-app-wallet-dialog'
import { getAppChain } from '@/lib/app-chain'
import { isGoodDollarReady, resolveGoodDollarReason } from '@/lib/gooddollar-reason'
import {
  GOODDOLLAR_ADDRESSES,
  GOODDOLLAR_CHAIN_ID,
  GOODDOLLAR_ERC20_ABI,
  GOODDOLLAR_IDENTITY_ABI,
  GOODDOLLAR_SERVICES,
  GOODDOLLAR_UBI_ABI,
  buildGoodIdVerificationUrl,
  detectProtocolChange,
  goodDollarFvMessage,
  parseGoodIdReturn,
  resolveGoodDollarAction,
  type GoodDollarAction,
} from '@/lib/gooddollar-protocol'

import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import { useToast } from '@pasosdejesus/m/shadcn-components/ui/use-toast'
import { createComponentT } from '@/lib/hooks/useTranslation'

export interface GoodDollarClaimButtonProps {
  lang?: string
  buttonText?: string
}

type ButtonAction = GoodDollarAction | 'idle'

export default function GoodDollarClaimButton({
  lang = 'en',
  buttonText,
}: GoodDollarClaimButtonProps) {
  const { address } = useAuthAddress()
  const { data: session } = useSession()
  const { status: inAppStatus, biometricEnabled } = useInAppWallet()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { writeContract } = useWriteContract()
  const { toast } = useToast()

  const [isClaiming, setIsClaiming] = useState(false)
  const [action, setAction] = useState<ButtonAction>('idle')
  const [notice, setNotice] = useState<string | null>(null)

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
      nothingToday: 'You already claimed today. Come back tomorrow.',
      verifyNeeded: 'GoodDollar needs a one-time face verification. We will open GoodID and come back here.',
      verifyFailed: 'GoodDollar could not verify you: {{0}}',
      verifyReturned: 'Verification complete. Press the button to claim.',
      syncingWhitelist: 'Finishing the verification with GoodDollar...',
      protocolChanged: 'GoodDollar changed something on its side ({{0}}). We stopped instead of failing silently.',
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
      nothingToday: 'Ya reclamaste hoy. Vuelve mañana.',
      verifyNeeded: 'GoodDollar pide una verificación facial única. Abrimos GoodID y volvemos aquí.',
      verifyFailed: 'GoodDollar no pudo verificarte: {{0}}',
      verifyReturned: 'Verificación completa. Pulsa el botón para reclamar.',
      syncingWhitelist: 'Terminando la verificación con GoodDollar...',
      protocolChanged: 'GoodDollar cambió algo de su lado ({{0}}). Nos detuvimos en vez de fallar en silencio.',
    },
  }), [lang])

  const reason = resolveGoodDollarReason({
    hasAddress: !!(session?.address && address),
    hasWalletClient: !!walletClient,
    inAppStatus,
    chainId: getAppChain().id,
  })

  // The GoodID return: verified=true → sync the whitelist before reading; verified=false →
  // show the reason and stop. The only state that must survive the redirect is the URL.
  useEffect(() => {
    if (typeof window === 'undefined' || !address) return
    const params = new URL(window.location.href).searchParams
    if (!params.has('verified')) return
    const ret = parseGoodIdReturn(window.location.href)
    if (!ret.verified) {
      setNotice(t('verifyFailed', ret.reason ?? ''))
      return
    }
    setNotice(t('syncingWhitelist'))
    fetch(`${GOODDOLLAR_SERVICES.backend}/syncWhitelist/${address}`)
      .then(() => {
        setNotice(t('verifyReturned'))
        window.history.replaceState({}, '', window.location.pathname)
      })
      .catch(() => setNotice(t('verifyReturned')))
  }, [address, t])

  // Read the protocol (facts, whitelist, entitlement) and decide the action.
  useEffect(() => {
    if (!isGoodDollarReady(reason) || !address || !publicClient) {
      setAction(reason === 'network-unsupported' ? 'unsupported-chain' : 'idle')
      return
    }
    let cancelled = false
    const chainId = getAppChain().id
    ;(async () => {
      try {
        const [identityCode, ubiCode, ubiPaused, gDecimals] = await Promise.all([
          publicClient.getCode({ address: GOODDOLLAR_ADDRESSES.identity }),
          publicClient.getCode({ address: GOODDOLLAR_ADDRESSES.ubi }),
          publicClient
            .readContract({
              address: GOODDOLLAR_ADDRESSES.ubi,
              abi: GOODDOLLAR_UBI_ABI,
              functionName: 'paused',
            })
            .catch(() => null),
          publicClient
            .readContract({
              address: GOODDOLLAR_ADDRESSES.gDollar,
              abi: GOODDOLLAR_ERC20_ABI,
              functionName: 'decimals',
            })
            .catch(() => null),
        ])
        const changes = detectProtocolChange({
          chainId,
          identityHasCode: !!identityCode,
          ubiHasCode: !!ubiCode,
          ubiPaused: ubiPaused as boolean | null,
          gDecimals: gDecimals as number | null,
        })
        if (changes.length) {
          if (!cancelled) setNotice(t('protocolChanged', changes.join('; ')))
          return
        }

        const root = (await publicClient.readContract({
          address: GOODDOLLAR_ADDRESSES.identity,
          abi: GOODDOLLAR_IDENTITY_ABI,
          functionName: 'getWhitelistedRoot',
          args: [address as `0x${string}`],
        })) as `0x${string}`
        const whitelisted = root !== zeroAddress
        let entitlement = 0n
        if (whitelisted) {
          entitlement = (await publicClient.readContract({
            address: GOODDOLLAR_ADDRESSES.ubi,
            abi: GOODDOLLAR_UBI_ABI,
            functionName: 'checkEntitlement',
            args: [root],
          })) as bigint
        }
        if (cancelled) return
        setAction(resolveGoodDollarAction({ chainId, whitelisted, entitlement }))
      } catch {
        if (!cancelled) setNotice(t('sdkUnavailable'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reason, address, publicClient, t])

  const handleClaim = useCallback(async () => {
    if (reason === 'locked') {
      openInAppWalletDialog()
      return
    }
    if (!isGoodDollarReady(reason) || !session?.address || !address) return
    if (action !== 'direct-claim' && action !== 'verify') return

    setIsClaiming(true)
    try {
      if (action === 'direct-claim') {
        await writeContract({
          address: GOODDOLLAR_ADDRESSES.ubi,
          abi: GOODDOLLAR_UBI_ABI,
          functionName: 'claim',
        })
        toast({ title: t('claimSuccess') })
        setAction('nothing-today')
        return
      }

      // verify: sign the fixed FV message and let GoodID run FaceTec, then return here.
      // learn.tg carries no profile first name at this point; GoodWallet sends the
      // profile name, we send the account (https://github.com/pasosdeJesus/learn.tg/issues/275 §5).
      if (!walletClient) return
      const fvsig = await walletClient.signMessage({
        account: address as `0x${string}`,
        message: goodDollarFvMessage(address),
      })
      window.location.assign(
        buildGoodIdVerificationUrl({
          account: address,
          chainId: GOODDOLLAR_CHAIN_ID,
          fvsig,
          firstname: address,
          returnUrl: window.location.href,
        }),
      )
    } catch (e: any) {
      console.error('GoodDollar claim error:', e)
      toast({ title: t('claimFailed', e?.message || 'Unknown error'), variant: 'destructive' })
    } finally {
      setIsClaiming(false)
    }
  }, [reason, action, session?.address, address, walletClient, writeContract, toast, t])

  const reasonHint =
    reason === 'no-wallet'
      ? t('connectPrompt')
      : reason === 'provider-unsupported'
        ? t('providerUnsupported')
        : reason === 'network-unsupported'
          ? t('networkUnsupported')
          : reason === 'sdk-error'
            ? t('sdkUnavailable')
            : ''

  const hintText =
    reasonHint ||
    notice ||
    (action === 'verify' ? t('verifyNeeded') : '')

  const disabled =
    isClaiming ||
    (!isGoodDollarReady(reason) && reason !== 'locked') ||
    action === 'nothing-today' ||
    action === 'unsupported-chain'

  const label =
    reason === 'locked'
      ? biometricEnabled
        ? t('unlockInAppGesture')
        : t('unlockInApp')
      : isClaiming
        ? t('claiming')
        : action === 'nothing-today'
          ? t('nothingToday')
          : buttonText || t('signUp')

  return (
    <Button
      onClick={handleClaim}
      disabled={disabled}
      variant="default"
      size="sm"
      data-testid="gooddollar-claim-button"
      data-reason={reason}
      data-action={action}
    >
      {label}
      {hintText && (
        <span className="block text-xs text-gray-500 mt-1">{hintText}</span>
      )}
    </Button>
  )
}
