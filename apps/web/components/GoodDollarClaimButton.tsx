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
import { getAddress, zeroAddress } from 'viem'
import { useInAppWallet } from '@pasosdejesus/m/wallet/next'
import { usePublicClient, useWalletClient } from '@/lib/hooks/useWallet'
import { useWriteContract } from '@/lib/hooks/useWriteContract'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { useWalletProvider } from '@/lib/hooks/useWalletProvider'
import { ensureWalletChain, WrongChainError } from '@/lib/ensure-chain'
import { openInAppWalletDialog } from '@/lib/in-app-wallet-dialog'
import { getAppChain } from '@/lib/app-chain'
import { explorerTxUrl } from '@/lib/wallet-amounts'
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
import { logger } from '@pasosdejesus/m/debug'
import { createComponentT } from '@/lib/hooks/useTranslation'

export interface GoodDollarClaimButtonProps {
  lang?: string
  buttonText?: string
}

/**
 * Resumen de un error (viem incluido) para el diagnóstico en consola: `message`
 * suele ser genérico ("Invalid params"); `shortMessage`, `details` y `cause`
 * dicen qué falló y por qué.
 */
function describeError(error: unknown): string {
  const err = error as
    | {
        name?: string
        shortMessage?: string
        details?: string
        message?: string
        cause?: { message?: string } | string
      }
    | null
  const cause = typeof err?.cause === 'string' ? err.cause : err?.cause?.message
  return JSON.stringify({
    name: err?.name,
    shortMessage: err?.shortMessage,
    details: err?.details,
    message: err?.message,
    cause,
  })
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
  const { provider: walletProvider } = useWalletProvider()
  const { writeContract } = useWriteContract()
  const { toast } = useToast()

  const [isClaiming, setIsClaiming] = useState(false)
  const [action, setAction] = useState<ButtonAction>('idle')
  const [notice, setNotice] = useState<string | null>(null)

  const t = useMemo(() => createComponentT(lang, {
    en: {
      claimSuccess: 'Claim successful',
      claimFailed: 'Claim failed: {{0}}',
      viewTx: 'View transaction',
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
      wrongChain: 'Your wallet is on another network. Switch it to Celo and try again.',
      wrongChainInApp: 'We could not switch your in-app wallet to the Celo network. Try again, or use a wallet on the Celo network.',
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
      viewTx: 'Ver transacción',
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
      wrongChain: 'Tu billetera está en otra red. Cámbiala a Celo e inténtalo de nuevo.',
      wrongChainInApp: 'No pudimos cambiar tu billetera de la app a la red Celo. Inténtalo de nuevo, o usa una billetera en la red Celo.',
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
        const resolved = resolveGoodDollarAction({ chainId, whitelisted, entitlement })
        logger.info(
          `action=${resolved} chain=${chainId} whitelisted=${whitelisted} entitlement=${entitlement.toString()} root=${root}`,
          'gooddollar',
        )
        setAction(resolved)
      } catch (error) {
        if (!cancelled) {
          logger.error(
            `read failed: address=${address} chain=${getAppChain().id} ${describeError(error)}`,
            'gooddollar',
          )
          setNotice(t('sdkUnavailable'))
        }
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
      // R-#266: la billetera puede estar en la otra red (p. ej. una billetera in-app
      // creada en el sitio de desarrollo): se cambia antes de firmar o se dice por qué
      // no se pudo, en vez de dejar caer el ChainMismatchError de viem.
      await ensureWalletChain(walletClient as never, getAppChain(), walletProvider)

      if (action === 'direct-claim') {
        const hash = await writeContract({
          address: GOODDOLLAR_ADDRESSES.ubi,
          abi: GOODDOLLAR_UBI_ABI,
          functionName: 'claim',
        })
        logger.info(`claim sent: ${String(hash)}`, 'gooddollar')
        // El reclamo de GoodDollar solo existe en Celo mainnet (42220), así que el
        // enlace apunta siempre al Blockscout de mainnet, no al de la red de la app.
        toast({
          title: t('claimSuccess'),
          // Queda abierto hasta que el usuario lo cierre (Radix no arranca el
          // temporizador con `duration: Infinity`), para que alcance a tocar el
          // enlace de la transacción en el teléfono.
          duration: Infinity,
          description: (
            <a
              href={explorerTxUrl(String(hash), 'celo')}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              data-testid="gooddollar-claim-tx-link"
            >
              {t('viewTx')}
            </a>
          ),
        })
        setAction('nothing-today')
        return
      }

      // verify: sign the fixed FV message and let GoodID run FaceTec, then return here.
      // learn.tg carries no profile first name at this point; GoodWallet sends the
      // profile name, we send the account (https://github.com/pasosdeJesus/learn.tg/issues/275 §5).
      if (!walletClient) return
      // El mensaje DEBE llevar la dirección en su forma EIP-55 (checksummed): con la
      // dirección en minúsculas GoodID responde "Login information is missing" (medido
      // 2026-10-02). `useAuthAddress()` entrega minúsculas, así que se normaliza aquí;
      // GoodWallet firma igual (`signer.address`, que viem ya da checksummed).
      const account = getAddress(address)
      const fvsig = await walletClient.signMessage({
        account: account as `0x${string}`,
        message: goodDollarFvMessage(account),
      })
      window.location.assign(
        buildGoodIdVerificationUrl({
          account,
          chainId: GOODDOLLAR_CHAIN_ID,
          fvsig,
          firstname: account,
          returnUrl: window.location.href,
        }),
      )
    } catch (e: any) {
      if (e instanceof WrongChainError) {
        logger.error(
          `wrong chain: address=${address} current=${e.currentChainId} target=${e.targetChainId} inApp=${e.isInApp}`,
          'gooddollar',
        )
        toast({
          title: e.isInApp ? t('wrongChainInApp') : t('wrongChain'),
          variant: 'destructive',
        })
        return
      }
      logger.error(
        `claim failed: action=${action} address=${address} chain=${getAppChain().id} ${describeError(e)}`,
        'gooddollar',
      )
      toast({
        title: t('claimFailed', e?.shortMessage || e?.message || 'Unknown error'),
        variant: 'destructive',
      })
    } finally {
      setIsClaiming(false)
    }
  }, [reason, action, session?.address, address, walletClient, walletProvider, writeContract, toast, t])

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
