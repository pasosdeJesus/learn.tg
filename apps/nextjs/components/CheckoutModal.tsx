'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { type Address } from 'viem'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { usePublicClient, useWalletClient } from '@/lib/hooks/useWallet'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { useAuthedApi } from '@/lib/hooks/useAuthedApi'
import { useContractPayment } from '@/lib/hooks/useContractPayment'
import { ensureWalletChain, WrongChainError } from '@/lib/ensure-chain'
import { getAppChain } from '@/lib/app-chain'
import { useWalletProvider } from '@/lib/hooks/useWalletProvider'
import { useGasEstimation } from '@/lib/hooks/useGasEstimation'
import { erc20Abi, formatDisplay } from '@learn-tg/rewards/lib/donate-utils'
import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import { GasInsufficientPanel } from '@/components/GasInsufficientPanel'
import { useToast } from '@pasosdejesus/m/shadcn-components/ui/use-toast'
import { useInAppWallet } from '@learn-tg/pdj-wallet-next'
import { openInAppWalletDialog } from '@/lib/in-app-wallet-dialog'
import { useExternalProvider } from '@/lib/external-provider'

const SLEARN_DECIMALS = 2

// Human-readable destination labels for the distribution breakdown shown in
// the result screen (keys match the purchase route's clean distribution).
const DIST_LABELS: Record<string, [string, string]> = {
  country_fund: ['Country fund', 'Fondo del país'],
  cluster: ['Cluster fund', 'Fondo del clúster'],
  pdJ: ['pdJ', 'pdJ'],
  cashback: ['Reward (cashback)', 'Recompensa (cashback)'],
  missional: ['Missional', 'Misional'],
  ubi: ['UBI', 'IUB'],
  referral: ['Referrals', 'Referidos'],
  churches: ['Churches', 'Iglesias'],
  course_vault: ['Course vault', 'Bóveda del curso'],
}

interface CheckoutModalProps {
  courseId: number
  lang: string
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function CheckoutModal({ courseId, lang, isOpen, onClose, onSuccess }: CheckoutModalProps) {
  const t = useMemo(() => createComponentT(lang, {
    en: {
      title: 'Purchase course',
      priceUsdt: 'Price (USDT)',
      priceSlearn: 'Or pay in SLEARN (10% off)',
      split: 'Percentage to pay with SLEARN',
      slearnPct: 'SLEARN',
      usdtPct: 'USDT',
      yourBalance: 'Balance',
      purchase: 'Purchase',
      inAppLocked: 'Your in-app wallet is locked. Unlock it with your password to purchase.',
      inAppLockedGesture: 'Your in-app wallet is locked. Confirm with your fingerprint or Face ID to purchase.',
      unlockInApp: 'Unlock your in-app wallet',
      unlockInAppGesture: 'Unlock with fingerprint or Face ID',
      cancel: 'Cancel',
      processing: 'Processing...',
      success: 'Course purchased',
      copyError: 'Copy error',
      error: 'Error',
      resultTitle: '🎉 Course purchased!',
      resultTx: 'View transaction',
      resultOk: 'OK',
      insufficient: 'You need to add USDT to your wallet to buy this course. Complete crosswords and claim your daily UBI to help gather the funds.',
      createInApp: 'Create or import an in-app wallet',
      createInAppHint: 'You need a wallet to buy. Create one inside learn.tg: it lives on this device and you unlock it with a password.',
      orExternal: 'or connect your external wallet from the top menu',
      needMoreUsdt: 'You need {{0}} more USDT to complete the purchase.',
      yourCelo: 'Your CELO (gas)',
      enoughGas: 'Enough gas estimated',
      noGas: 'Not enough gas for transaction',
      noGasHint: 'From guide 3 of the Web3 & UBI course you can request Learn.tg-UBI paid in CELO to cover gas costs.',
      gasWarn: 'Gas estimation failed, proceed at your own risk',
      estimating: 'estimating...',
      wrongChain: 'Your wallet is on another network. Switch it to Celo and try again.',
      wrongChainInApp: 'We could not switch your in-app wallet to the Celo network. Try again, or pay with an external wallet on the Celo network.',
    },
    es: {
      title: 'Comprar curso',
      priceUsdt: 'Precio (USDT)',
      priceSlearn: 'O paga en SLEARN (10% descuento)',
      split: 'Porcentaje a pagar con SLEARN',
      slearnPct: 'SLEARN',
      usdtPct: 'USDT',
      yourBalance: 'Saldo',
      purchase: 'Comprar',
      inAppLocked: 'Tu billetera de la aplicación está bloqueada. Desbloquéala con tu password para comprar.',
      inAppLockedGesture: 'Tu billetera está bloqueada. Confirma con tu huella o Face ID para comprar.',
      unlockInApp: 'Desbloquear tu billetera',
      unlockInAppGesture: 'Desbloquear con huella o Face ID',
      cancel: 'Cancelar',
      processing: 'Procesando...',
      success: 'Curso comprado',
      copyError: 'Copiar error',
      error: 'Error',
      resultTitle: '🎉 ¡Curso comprado!',
      resultTx: 'Ver transacción',
      resultOk: 'OK',
      insufficient: 'Necesitas poner USDT en tu billetera para comprar este curso. Completa crucigramas y reclama tu UBI diario para ayudar a reunir los fondos.',
      createInApp: 'Crear o importar la billetera de la aplicación',
      createInAppHint: 'Para comprar necesitas una billetera. Créala dentro de learn.tg: vive en este dispositivo y la desbloqueas con una clave.',
      orExternal: 'o conecta tu billetera externa desde el menú de arriba',
      needMoreUsdt: 'Necesitas {{0}} USDT más para completar la compra.',
      yourCelo: 'Tu CELO (gas)',
      enoughGas: 'Gas suficiente estimado',
      noGas: 'Gas insuficiente para la transaccion',
      noGasHint: 'Desde la guia 3 del curso Web3 & UBI puedes pedir Learn.tg-UBI que se paga en CELO y te permite cubrir costos de gas.',
      gasWarn: 'Fallo al estimar gas, continue bajo su propio riesgo',
      estimating: 'estimando...',
      wrongChain: 'Tu billetera está en otra red. Cámbiala a Celo e inténtalo de nuevo.',
      wrongChainInApp: 'No pudimos cambiar tu billetera de la app a la red Celo. Inténtalo de nuevo, o paga con una billetera externa en la red Celo.',
    },
  }), [lang])

  const { address: rawAddress } = useAuthAddress()
  const address = rawAddress as Address | undefined
  // R-#244: la billetera in-app queda bloqueada al cargar la página (la clave vive
  // en memoria), así que sin desbloquearla no hay wallet client y el botón de
  // compra nunca se habilita. Antes no se explicaba nada.
  const { status: inAppStatus, biometricEnabled, biometricAvailable } = useInAppWallet()
  const { authedGet, authedPost } = useAuthedApi()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { provider: walletProvider } = useWalletProvider()
  const { available: externalAvailable } = useExternalProvider()
  // Mensaje del pre-flight de red (distinto del error del pago).
  const [chainError, setChainError] = useState<string | null>(null)
  const { toast } = useToast()

  // R-#246 (2026-09-19): con la huella registrada el gesto se pide al abrir el
  // modal en vez de un aviso que obliga a pulsar "desbloquear" y después la huella.
  const autoUnlockTried = useRef(false)
  useEffect(() => {
    if (!isOpen || !biometricEnabled || autoUnlockTried.current) return
    if (inAppStatus !== 'locked' || walletClient) return
    autoUnlockTried.current = true
    openInAppWalletDialog()
  }, [isOpen, biometricEnabled, inAppStatus, walletClient])

  const [priceUSDT, setPriceUSDT] = useState<number | null>(null)
  const [priceSLEARN, setPriceSLEARN] = useState<number | null>(null)
  const [slearnPct, setSlearnPct] = useState(100) // 0-100, % paid with SLEARN (default: all SLEARN)
  const [usdtBalance, setUsdtBalance] = useState(0n)
  const [slearnBalance, setSlearnBalance] = useState(0n)
  const [celoBalance, setCeloBalance] = useState(0n)
  const [dataLoaded, setDataLoaded] = useState(false)

  const usdtAddress = process.env.NEXT_PUBLIC_USDT_ADDRESS as Address | undefined
  const slearnAddress = process.env.NEXT_PUBLIC_SLEARN_ADDRESS as Address | undefined
  const backendWalletAddress = process.env.NEXT_PUBLIC_ADDRESS as Address | undefined

  // Fetch price + balances when opened
  useEffect(() => {
    if (!isOpen || !address || !publicClient || !usdtAddress) return
    let cancelled = false
    // forno falla intermitentemente (igual que eth_estimateGas): reintentar una
    // vez y cargar saldos parciales (allSettled) — un fallo de getBalance no
    // debe tumbar la carga ni provocar un falso "no-gas" (celo=0 sin cargar).
    const load = async () => {
      const res = await authedGet<any>(`/api/courses/premium/price?courseId=${courseId}`)
      if (cancelled) return
      setPriceUSDT(Number(res.data.priceUSDT))
      setPriceSLEARN(Number(res.data.priceSLEARN))

      const [usdtBal, slearnBal, celoBal] = await Promise.allSettled([
        publicClient.readContract({ address: usdtAddress, abi: erc20Abi, functionName: 'balanceOf', args: [address] }) as Promise<bigint>,
        slearnAddress
          ? publicClient.readContract({ address: slearnAddress, abi: erc20Abi, functionName: 'balanceOf', args: [address] }) as Promise<bigint>
          : Promise.resolve(0n),
        publicClient.getBalance({ address }) as Promise<bigint>,
      ])
      if (cancelled) return
      if (usdtBal.status === 'fulfilled') setUsdtBalance(usdtBal.value)
      if (slearnBal.status === 'fulfilled') setSlearnBalance(slearnBal.value)
      if (celoBal.status === 'fulfilled') {
        setCeloBalance(celoBal.value)
        setDataLoaded(true)
        // Default the split to as much SLEARN as the wallet can cover (up to 100%).
        const sDecimal = Number(slearnBal.status === 'fulfilled' ? slearnBal.value : 0n) / 10 ** SLEARN_DECIMALS
        const pSlearn = Number(res.data.priceSLEARN)
        if (pSlearn > 0) {
          setSlearnPct(Math.min(100, Math.floor((sDecimal / pSlearn) * 100)))
        }
      }
    }
    ;(async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await load()
          return
        } catch {
          if (cancelled) return
          if (attempt === 0) await new Promise((r) => setTimeout(r, 600))
        }
      }
      if (!cancelled) {
        toast({ title: lang === 'es' ? 'No se pudo cargar el precio' : 'Could not load price', variant: 'destructive' })
      }
    })()
    return () => { cancelled = true }
  }, [isOpen, address, publicClient, usdtAddress, slearnAddress, courseId, lang, toast])

  // Mixed payment split: slearnPct% with SLEARN, the rest with USDT.
  //   slearnAmount = priceSLEARN * pct/100  (already has the 10% discount)
  //   usdtAmount   = priceUSDT * (100-pct)/100
  const slearnAmount = priceSLEARN != null ? ((priceSLEARN * slearnPct) / 100).toFixed(2) : '0'
  const usdtAmount = priceUSDT != null ? ((priceUSDT * (100 - slearnPct)) / 100).toFixed(2) : '0'
  const usdtPct = 100 - slearnPct

  const usdtDecimals = +(process.env.NEXT_PUBLIC_USDT_DECIMALS || 6)
  const slearnBalanceDecimal = Number(slearnBalance) / 10 ** SLEARN_DECIMALS
  const usdtBalanceDecimal = Number(usdtBalance) / 10 ** usdtDecimals
  // The wallet can pay if the fractions of the price covered by SLEARN and
  // USDT together reach 100%.
  const canPay =
    priceSLEARN != null && priceUSDT != null && priceSLEARN > 0 && priceUSDT > 0
      ? slearnBalanceDecimal / priceSLEARN + usdtBalanceDecimal / priceUSDT >= 1
      : false

  // The slider is free (0-100% SLEARN). The wallet's balances only drive the
  // default position and the "needs X more USDT" hint when it cannot cover
  // the selected split.
  const sliderMin = 0
  const sliderMax = 100

  // USDT still missing after using the full SLEARN balance (shown only when
  // the wallet cannot cover the price).
  const missingUsdt = (() => {
    if (canPay) return 0
    if (priceUSDT == null || priceSLEARN == null || priceSLEARN <= 0) return 0
    const covered = usdtBalanceDecimal + (slearnBalanceDecimal / priceSLEARN) * priceUSDT
    return Math.max(0, Math.ceil((priceUSDT - covered) * 100) / 100)
  })()

  const { gasState, estimating, diag } = useGasEstimation({
    amount: usdtAmount,
    slearnAmount,
    usdtDecimals,
    address,
    walletClient,
    publicClient,
    backendWalletAddress,
    usdtAddress,
    slearnAddress,
    courseId,
    celoBalance,
    balanceLoaded: dataLoaded,
  })
  // Diagnóstico de gas visible en el panel con ?diag=1 (depuración dev site)
  const gasDiagMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('diag')

  const [showResult, setShowResult] = useState(false)
  const [resultTxHash, setResultTxHash] = useState<string | null>(null)
  const [resultProcessPaymentHash, setResultProcessPaymentHash] = useState<string | null>(null)
  const [resultDistribution, setResultDistribution] = useState<any[]>([])

  const handleSuccess = useCallback((data: any) => {
    if (data?.slearnHash) setResultTxHash(data.slearnHash)
    else if (data?.usdtHash) setResultTxHash(data.usdtHash)
    if (data?.processPaymentHash) setResultProcessPaymentHash(data.processPaymentHash)
    if (data?.distribution) setResultDistribution(data.distribution)
    setShowResult(true)
  }, [])

  const handleResultOk = useCallback(() => {
    onSuccess?.()
    onClose()
  }, [onSuccess, onClose])

  const onBackendCallback = useCallback(async (params: {
    walletAddress: string
    token: string
    courseId: number | null
    usdtHash: string
    slearnHash: string
  }) => {
    const { data } = await authedPost<any>('/api/courses/premium/purchase', {
      courseId: params.courseId,
      usdtHash: params.usdtHash || undefined,
      slearnHash: params.slearnHash || undefined,
    })
    return { increment: 0, ...data }
  }, [authedPost])

  const {
    state: paymentState,
    error: paymentError,
    execute: executePayment,
  } = useContractPayment({
    amount: usdtAmount,
    slearnAmount,
    usdtDecimals: +(process.env.NEXT_PUBLIC_USDT_DECIMALS || 6),
    slearnDecimals: SLEARN_DECIMALS,
    address,
    walletClient,
    publicClient,
    backendWalletAddress,
    usdtAddress,
    slearnAddress,
    courseId,
    usdtBalance,
    slearnBalance,
    lang,
    onBackendCallback,
    onSuccess: handleSuccess,
  })

  const copyError = useCallback(async () => {
    if (paymentError) {
      try {
        await navigator.clipboard.writeText(paymentError)
        toast({ title: lang === 'es' ? 'Error copiado' : 'Error copied' })
      } catch {
        /* ignore */
      }
    }
  }, [paymentError, lang, toast])

  // Pre-flight de red antes de pagar (reporte del operador, 2026-09-27): con la billetera
  // en otra red viem lanzaba "The current chain of the wallet (id: 11142220) does not match
  // the target chain for the transaction (id: 42220 – Celo)", que no dice qué hacer. Se
  // intenta cambiar la red (la billetera in-app también puede: la misma llave sirve en
  // Celo y en Celo Sepolia) y sólo si el cambio no se aplica se explica al estudiante.
  //
  // Debe declararse **antes** del `if (!isOpen) return null`: un hook después de esa salida
  // temprana cambia el número de hooks entre renders.
  const handlePay = useCallback(async () => {
    setChainError(null)
    try {
      await ensureWalletChain(walletClient as never, getAppChain(), walletProvider)
    } catch (error) {
      setChainError(error instanceof WrongChainError && error.isInApp ? t('wrongChainInApp') : t('wrongChain'))
      return
    }
    await executePayment()
  }, [executePayment, t, walletClient, walletProvider])

  if (!isOpen) return null

  const busy = paymentState === 'paying' || paymentState === 'confirming'
  const hasAmount = priceUSDT != null && priceSLEARN != null
  // Sin CELO (menos de 0.01): el modal muestra la guía de inmediato
  const noCelo = celoBalance < 10_000_000_000_000_000n
  const purchaseDisabled = busy || priceUSDT == null || !canPay || (hasAmount && gasState === 'no-gas')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg text-gray-800">
        {showResult ? (
          <div className="text-center py-6">
            <h3 className="text-lg font-bold mb-4">{t('resultTitle')}</h3>
            {resultDistribution.length > 0 && (
              <div className="text-left text-sm space-y-1 mb-4 bg-gray-50 rounded-lg p-3">
                {resultDistribution.map((item, i) => {
                  const label = DIST_LABELS[item.destination]?.[lang === 'es' ? 1 : 0] || item.destination
                  return (
                    <div key={i} className="flex justify-between">
                      <span className="text-gray-700">{label}</span>
                      <span className="font-mono font-medium">{Number(item.amount).toFixed?.(2) ?? item.amount} {item.crypto?.toUpperCase?.() || ''}</span>
                    </div>
                  )
                })}
              </div>
            )}
            {(() => {
              const tx = resultProcessPaymentHash || resultTxHash
              if (!tx) return null
              const explorerBase = process.env.NEXT_PUBLIC_NETWORK === 'celo' ? 'https://celo.blockscout.com' : 'https://celo-sepolia.blockscout.com'
              return (
                <a href={`${explorerBase}/tx/${tx}`} target="_blank" rel="noopener noreferrer"
                  className="inline-block text-sm text-blue-600 underline break-all mb-6">
                  {t('resultTx')}
                </a>
              )
            })()}
            <button onClick={handleResultOk}
              className="mt-4 w-full rounded px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
              {t('resultOk')}
            </button>
          </div>
        ) : address && walletClient && dataLoaded && (gasState === 'no-gas' || noCelo) ? (
          <GasInsufficientPanel lang={lang} onClose={onClose} diag={gasDiagMode ? diag : null} />
        ) : (
          <>
            <h3 className="text-lg font-bold mb-4">{t('title')}</h3>

        <div className="space-y-4 text-sm">
          <p>
            {t('priceUsdt')}: <strong>{priceUSDT != null ? `$${priceUSDT.toFixed(2)}` : '…'}</strong>
          </p>
          <p>
            {t('priceSlearn')}: <strong>{priceSLEARN != null ? `${priceSLEARN.toFixed(2)} SLEARN` : '…'}</strong>
          </p>

          <div>
            <label className="block mb-1 font-medium">{t('split')}</label>
            <input
              type="range"
              min={sliderMin}
              max={sliderMax}
              step="1"
              value={slearnPct}
              onChange={(e) => setSlearnPct(Number(e.target.value))}
              className="w-full"
            />
            {!canPay && missingUsdt > 0 && (
              <p className="mt-1 text-xs text-amber-600">{t('needMoreUsdt', missingUsdt.toFixed(2))}</p>
            )}
            <div className="mt-2 grid grid-cols-2 gap-4">
              <div className="rounded border border-gray-200 p-3">
                <div className="text-xs text-gray-500">{t('usdtPct')} ({usdtPct}%)</div>
                <div className="text-base font-semibold">${usdtAmount}</div>
                <div className="text-xs text-gray-500">{t('yourBalance')}: {formatDisplay(usdtBalance, +(process.env.NEXT_PUBLIC_USDT_DECIMALS || 6))} USDT</div>
              </div>
              <div className="rounded border border-gray-200 p-3">
                <div className="text-xs text-gray-500">{t('slearnPct')} ({slearnPct}%)</div>
                <div className="text-base font-semibold">{slearnAmount} SLEARN</div>
                <div className="text-xs text-gray-500">{t('yourBalance')}: {formatDisplay(slearnBalance, SLEARN_DECIMALS)} SLEARN</div>
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-500">
            {t('yourCelo')}: {formatDisplay(celoBalance, 18)} CELO
          </div>
          {hasAmount && (
            <>
              <div className={gasState === 'ok' ? 'text-green-600' : gasState === 'no-gas' ? 'text-red-600' : gasState === 'warn' ? 'text-yellow-600' : 'text-gray-500'}>
                {gasState === 'ok' && t('enoughGas')}
                {gasState === 'no-gas' && t('noGas')}
                {gasState === 'warn' && t('gasWarn')}
                {estimating && <span className="ml-2 animate-pulse">{t('estimating')}</span>}
              </div>
              {gasState === 'no-gas' && (
                <div className="mt-2 text-xs bg-blue-50 border border-blue-200 rounded p-2">
                  {t('noGasHint')}
                </div>
              )}
            </>
          )}
        </div>

        {(paymentError || chainError) && (
          <div className="mt-4 rounded border border-red-300 bg-red-50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-red-700">{t('error')}</span>
              <button type="button" onClick={copyError} className="text-xs font-medium text-red-700 underline">
                {t('copyError')}
              </button>
            </div>
            <pre
              className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-red-800"
              data-testid="checkout-error"
            >{paymentError || chainError}</pre>
          </div>
        )}

        {!busy && priceUSDT != null && priceSLEARN != null && !canPay && (
          <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            {t('insufficient')}
          </div>
        )}

        {!walletClient && inAppStatus === 'locked' && (
          <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            {biometricEnabled ? t('inAppLockedGesture') : t('inAppLocked')}
            <button
              type="button"
              data-testid="wallet-unlock-request"
              onClick={openInAppWalletDialog}
              className="ml-2 underline font-medium"
            >
              {biometricEnabled ? t('unlockInAppGesture') : t('unlockInApp')}
            </button>
          </div>
        )}

        {(!address || !walletClient) && inAppStatus !== 'locked' && (
          <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800" data-testid="wallet-missing">
            {t('createInAppHint')}
            <button
              type="button"
              data-testid="wallet-create-request"
              onClick={openInAppWalletDialog}
              className="ml-2 underline font-medium"
            >
              {t('createInApp')}
            </button>
            {externalAvailable && <span className="block text-xs mt-1">{t('orExternal')}</span>}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>{t('cancel')}</Button>
          <Button onClick={() => { void handlePay() }} disabled={purchaseDisabled}>
            {busy ? t('processing') : t('purchase')}
          </Button>
        </div>
          </>
        )}
      </div>
    </div>
  )
}
