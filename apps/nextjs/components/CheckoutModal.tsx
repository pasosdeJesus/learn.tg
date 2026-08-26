'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import axios from 'axios'
import { getCsrfToken } from 'next-auth/react'
import { type Address } from 'viem'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { usePublicClient, useWalletClient } from '@/lib/hooks/useWallet'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { useContractPayment } from '@/lib/hooks/useContractPayment'
import { useGasEstimation } from '@/lib/hooks/useGasEstimation'
import { erc20Abi, formatDisplay } from '@learn-tg/rewards/src/lib/donate-utils'
import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import { useToast } from '@pasosdejesus/m/shadcn-components/ui/use-toast'

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
      cancel: 'Cancel',
      processing: 'Processing...',
      success: 'Course purchased',
      copyError: 'Copy error',
      error: 'Error',
      resultTitle: '🎉 Course purchased!',
      resultTx: 'View transaction',
      resultOk: 'OK',
      insufficient: 'You need to add USDT to your wallet to buy this course. Complete crosswords and claim your daily UBI to help gather the funds.',
      needMoreUsdt: 'You need {{0}} more USDT to complete the purchase.',
      yourCelo: 'Your CELO (gas)',
      enoughGas: 'Enough gas estimated',
      noGas: 'Not enough gas for transaction',
      noGasHint: 'From guide 3 of the Web3 & UBI course you can request Learn.tg-UBI paid in CELO to cover gas costs.',
      gasWarn: 'Gas estimation failed, proceed at your own risk',
      estimating: 'estimating...',
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
      cancel: 'Cancelar',
      processing: 'Procesando...',
      success: 'Curso comprado',
      copyError: 'Copiar error',
      error: 'Error',
      resultTitle: '🎉 ¡Curso comprado!',
      resultTx: 'Ver transacción',
      resultOk: 'OK',
      insufficient: 'Necesitas poner USDT en tu billetera para comprar este curso. Completa crucigramas y reclama tu UBI diario para ayudar a reunir los fondos.',
      needMoreUsdt: 'Necesitas {{0}} USDT más para completar la compra.',
      yourCelo: 'Tu CELO (gas)',
      enoughGas: 'Gas suficiente estimado',
      noGas: 'Gas insuficiente para la transaccion',
      noGasHint: 'Desde la guia 3 del curso Web3 & UBI puedes pedir Learn.tg-UBI que se paga en CELO y te permite cubrir costos de gas.',
      gasWarn: 'Fallo al estimar gas, continue bajo su propio riesgo',
      estimating: 'estimando...',
    },
  }), [lang])

  const { address: rawAddress } = useAuthAddress()
  const address = rawAddress as Address | undefined
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { toast } = useToast()

  const [priceUSDT, setPriceUSDT] = useState<number | null>(null)
  const [priceSLEARN, setPriceSLEARN] = useState<number | null>(null)
  const [slearnPct, setSlearnPct] = useState(100) // 0-100, % paid with SLEARN (default: all SLEARN)
  const [usdtBalance, setUsdtBalance] = useState(0n)
  const [slearnBalance, setSlearnBalance] = useState(0n)
  const [celoBalance, setCeloBalance] = useState(0n)

  const usdtAddress = process.env.NEXT_PUBLIC_USDT_ADDRESS as Address | undefined
  const slearnAddress = process.env.NEXT_PUBLIC_SLEARN_ADDRESS as Address | undefined
  const backendWalletAddress = process.env.NEXT_PUBLIC_ADDRESS as Address | undefined

  // Fetch price + balances when opened
  useEffect(() => {
    if (!isOpen || !address || !publicClient || !usdtAddress) return
    let cancelled = false
    ;(async () => {
      try {
        const token = localStorage.getItem('learn.tg.authToken') || await getCsrfToken()
        const url = `/api/courses/premium/price?courseId=${courseId}&walletAddress=${address}&token=${token}`
        const res = await axios.get(url)
        if (cancelled) return
        setPriceUSDT(Number(res.data.priceUSDT))
        setPriceSLEARN(Number(res.data.priceSLEARN))

        const [usdtBal, slearnBal, celoBal] = await Promise.all([
          publicClient.readContract({ address: usdtAddress, abi: erc20Abi, functionName: 'balanceOf', args: [address] }) as Promise<bigint>,
          slearnAddress
            ? publicClient.readContract({ address: slearnAddress, abi: erc20Abi, functionName: 'balanceOf', args: [address] }) as Promise<bigint>
            : Promise.resolve(0n),
          publicClient.getBalance({ address }) as Promise<bigint>,
        ])
        if (!cancelled) {
          setUsdtBalance(usdtBal)
          setSlearnBalance(slearnBal)
          setCeloBalance(celoBal)
          // Default the split to as much SLEARN as the wallet can cover (up to 100%).
          const sDecimal = Number(slearnBal) / 10 ** SLEARN_DECIMALS
          const pSlearn = Number(res.data.priceSLEARN)
          if (pSlearn > 0) {
            setSlearnPct(Math.min(100, Math.floor((sDecimal / pSlearn) * 100)))
          }
        }
      } catch {
        if (!cancelled) {
          toast({ title: lang === 'es' ? 'No se pudo cargar el precio' : 'Could not load price', variant: 'destructive' })
        }
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

  const { gasState, estimating } = useGasEstimation({
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
  })

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
    const { data } = await axios.post('/api/courses/premium/purchase', {
      walletAddress: params.walletAddress,
      token: params.token,
      courseId: params.courseId,
      usdtHash: params.usdtHash || undefined,
      slearnHash: params.slearnHash || undefined,
    })
    return { increment: 0, ...data }
  }, [])

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

  if (!isOpen) return null

  const busy = paymentState === 'paying' || paymentState === 'confirming'
  const hasAmount = priceUSDT != null && priceSLEARN != null
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

        {paymentError && (
          <div className="mt-4 rounded border border-red-300 bg-red-50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-red-700">{t('error')}</span>
              <button type="button" onClick={copyError} className="text-xs font-medium text-red-700 underline">
                {t('copyError')}
              </button>
            </div>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-red-800">{paymentError}</pre>
          </div>
        )}

        {!busy && priceUSDT != null && priceSLEARN != null && !canPay && (
          <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            {t('insufficient')}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>{t('cancel')}</Button>
          <Button onClick={executePayment} disabled={purchaseDisabled}>
            {busy ? t('processing') : t('purchase')}
          </Button>
        </div>
          </>
        )}
      </div>
    </div>
  )
}
