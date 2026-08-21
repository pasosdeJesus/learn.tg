'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { usePublicClient, useWalletClient } from '@/lib/hooks/useWallet'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { type Address, formatUnits } from 'viem'
import axios from 'axios'
import { erc20Abi, parseUserAmountSafe, formatDisplay, safeParseFloat } from '@/lib/donate-utils'
import { useGasEstimation } from '@/lib/hooks/useGasEstimation'
import { useContractPayment } from '@/lib/hooks/useContractPayment'
import { TransactionStatus } from '@/components/ui/TransactionStatus'
import {
  type PaymentTarget,
  type CourseDonation,
  type DistributionItem,
  getTargetCopy,
  getTargetRecipient,
  getTargetEndpoint,
  getDistributionFromResponse,
} from '@/lib/donation-target'

const SLEARN_DECIMALS = 2
const SLEARN_RATE = 22 // 1 USDT = 22 SLEARN

export interface DonateModalProps {
  courseId?: number | null
  target?: PaymentTarget
  isOpen: boolean
  onClose: () => void
  onSuccess?: (data: { increment?: number; usdtHash?: string; slearnHash?: string }) => void
  lang?: string
}

export function DonateModal({ courseId, target, isOpen, onClose, onSuccess, lang }: DonateModalProps) {
  // Derive effective target: explicit target or wrap legacy courseId
  const effectiveTarget: PaymentTarget | null = target || (courseId != null && courseId > 0
    ? { type: 'course-donation', courseId } as CourseDonation
    : null)

  const tCopy = effectiveTarget ? getTargetCopy(lang || 'en', effectiveTarget) : null
  const rewardPct = tCopy?.rewardPct ?? 0
  const recipientAddress = (effectiveTarget
    ? getTargetRecipient(effectiveTarget)
    : process.env.NEXT_PUBLIC_ADDRESS || '') as Address | undefined

  const { address: rawAddress } = useAuthAddress()
  const address = rawAddress as Address | undefined
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const [usdtDecimals, setUsdtDecimals] = useState<number>(+(process.env.NEXT_PUBLIC_USDT_DECIMALS || 6))
  const [usdtBalance, setUsdtBalance] = useState<bigint>(0n)
  const [slearnBalance, setSlearnBalance] = useState<bigint>(0n)
  const [celoBalance, setCeloBalance] = useState<bigint>(0n)
  const [amount, setAmount] = useState('')
  const [slearnAmount, setSlearnAmount] = useState('')
  const [showResult, setShowResult] = useState(false)
  const [resultTxHash, setResultTxHash] = useState<string | null>(null)
  const [resultCashback, setResultCashback] = useState(0)
  const [resultDistribution, setResultDistribution] = useState<DistributionItem[]>([])

  const usdtAddress = (process.env.NEXT_PUBLIC_USDT_ADDRESS as Address) || undefined
  const slearnAddress = (process.env.NEXT_PUBLIC_SLEARN_ADDRESS as Address) || undefined
  const cId = effectiveTarget?.type === 'course-donation' ? effectiveTarget.courseId : null

  const usdtNum = safeParseFloat(amount)
  const slearnNum = safeParseFloat(slearnAmount)
  const totalUSDTValue = usdtNum + (slearnNum / SLEARN_RATE)
  const estimatedReward = totalUSDTValue * (rewardPct / 100) * SLEARN_RATE

  const { gasState, estimating } = useGasEstimation({
    amount, slearnAmount, usdtDecimals,
    address, walletClient, publicClient,
    backendWalletAddress: recipientAddress, usdtAddress, slearnAddress,
    courseId: cId, celoBalance,
  })

  const {
    state: paymentState,
    error: paymentError,
    needsApproval,
    execute: executePayment,
    reset: resetPayment,
  } = useContractPayment({
    amount, slearnAmount, usdtDecimals, slearnDecimals: SLEARN_DECIMALS,
    address, walletClient, publicClient,
    backendWalletAddress: recipientAddress, usdtAddress, slearnAddress,
    courseId: cId, usdtBalance, slearnBalance, lang,
    onBackendCallback: async (params) => {
      const endpoint = effectiveTarget ? getTargetEndpoint(effectiveTarget) : '/api/add-donation'
      const payload: Record<string, unknown> = {
        walletAddress: params.walletAddress, token: params.token,
        donationAmountUSD: params.donationAmountUSD,
        slearnDonationAmount: params.slearnDonationAmount,
        usdtHash: params.usdtHash, slearnHash: params.slearnHash,
      }
      if (effectiveTarget?.type === 'course-donation') {
        payload.courseId = params.courseId
      }
      if (effectiveTarget?.type === 'cluster-donation') {
        payload.clusterWallet = effectiveTarget.clusterWallet
      }
      if (effectiveTarget?.type === 'country-donation') {
        payload.countryCode = effectiveTarget.countryCode
      }
      const { data } = await axios.post(endpoint, payload)
      return data
    },
    onSuccess: (data) => {
      if (data?.slearnHash) setResultTxHash(data.slearnHash)
      else if (data?.usdtHash) setResultTxHash(data.usdtHash)
      if (data?.increment && data.increment > 0) setResultCashback(data.increment)
      if (data?.distribution) {
        setResultDistribution(getDistributionFromResponse(data, lang || 'en'))
      }
      setShowResult(true)
    },
  })

  const reset = useCallback(() => {
    setAmount('')
    setSlearnAmount('')
    setShowResult(false)
    setResultTxHash(null)
    setResultCashback(0)
    resetPayment()
  }, [resetPayment])

  // On success → show result screen instead of toast
  const handleResultOk = useCallback(() => {
    onSuccess?.({ increment: resultCashback, usdtHash: resultTxHash || undefined, slearnHash: resultTxHash || undefined })
    reset()
    onClose()
  }, [onSuccess, resultCashback, resultTxHash, reset, onClose])

  const closeAll = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  const loadData = useCallback(async () => {
    if (!isOpen || !address || !publicClient || !usdtAddress || !recipientAddress) return
    try {
      const promises: Promise<any>[] = [
        publicClient.readContract({ address: usdtAddress, abi: erc20Abi, functionName: 'decimals' }).catch(() => BigInt(usdtDecimals)),
        publicClient.readContract({ address: usdtAddress, abi: erc20Abi, functionName: 'balanceOf', args: [address] }) as Promise<bigint>,
        publicClient.getBalance({ address }),
      ]
      if (slearnAddress) {
        promises.push(
          publicClient.readContract({ address: slearnAddress, abi: erc20Abi, functionName: 'balanceOf', args: [address] }) as Promise<bigint>,
        )
      }
      const results = await Promise.all(promises)
      setUsdtDecimals(Number(results[0]))
      setUsdtBalance(results[1])
      setCeloBalance(results[2])
      if (slearnAddress && results.length >= 4) {
        setSlearnBalance(results[3])
      }
    } catch (e: any) {
    console.error('[DonateModal] Backend verification failed:', e?.message || String(e))
      // Silently fail; balances will show as 0
    }
  }, [isOpen, address, publicClient, usdtAddress, recipientAddress, usdtDecimals, slearnAddress])

  useEffect(() => { loadData() }, [loadData])

  if (!isOpen || !effectiveTarget) return null

  const t = createComponentT(lang || 'en', {
    en: {
      connectSign: 'Connect and sign with your wallet to donate',
      yourBalance: 'Your USDT Balance',
      yourSlearnBalance: 'Your SLEARN Balance',
      yourCelo: 'Your CELO (gas)',
      enoughGas: 'Enough gas estimated',
      noGas: 'Not enough gas for transaction',
      noGasHint: 'From guide 3 of the Web3 & UBI course you can request Learn.tg-UBI paid in CELO to cover gas costs.',
      gasWarn: 'Gas estimation failed, proceed at your own risk',
      estimating: 'estimating...',
      amountLabel: 'Amount (USDT)',
      slearnAmountLabel: 'Amount (SLEARN)',
      enterAmount: 'Enter amount',
      max: 'Max',
      clear: 'Clear',
      cancel: 'Cancel',
      processing: 'Processing...',
      donate: 'Donate',
      missingContract: 'Missing contract env vars',
      estimatedReward: 'Estimated SLEARN reward',
      estimatedRewardValue: '~{{0}} SLEARN',
      donateToCourse: 'Donate to course',
      resultTitle: '🎉 Donation completed!',
      resultCashback: '+{{0}} SLEARN cashback',
      resultTx: 'View transaction',
      resultOk: 'OK',
    },
    es: {
      connectSign: 'Conecta y firma con tu billetera para donar',
      yourBalance: 'Tu saldo USDT',
      yourSlearnBalance: 'Tu saldo SLEARN',
      yourCelo: 'Tu CELO (gas)',
      enoughGas: 'Gas suficiente estimado',
      noGas: 'Gas insuficiente para la transaccion',
      noGasHint: 'Desde la guia 3 del curso Web3 & UBI puedes pedir Learn.tg-UBI que se paga en CELO y te permite cubrir costos de gas.',
      gasWarn: 'Fallo al estimar gas, continue bajo su propio riesgo',
      estimating: 'estimando...',
      amountLabel: 'Monto (USDT)',
      slearnAmountLabel: 'Monto (SLEARN)',
      enterAmount: 'Ingresa monto',
      max: 'Todo',
      clear: 'Limpiar',
      cancel: 'Cancelar',
      processing: 'Procesando...',
      donate: 'Donar',
      missingContract: 'Faltan variables de entorno del contrato',
      estimatedReward: 'Recompensa SLEARN estimada',
      estimatedRewardValue: '~{{0}} SLEARN',
      donateToCourse: 'Donar al curso',
      resultTitle: '🎉 ¡Donación completada!',
      resultCashback: '+{{0}} SLEARN de cashback',
      resultTx: 'Ver transacción',
      resultOk: 'OK',
    },
  })

  const usdtBalFmt = formatDisplay(usdtBalance, usdtDecimals)
  const slearnBalFmt = formatDisplay(slearnBalance, SLEARN_DECIMALS)
  const celoBalFmt = formatDisplay(celoBalance, 18)
  const hasAnyAmount = usdtNum > 0 || slearnNum > 0
  const isSubmitting = paymentState === 'approving' || paymentState === 'paying' || paymentState === 'confirming'
  const donateDisabled = isSubmitting || !hasAnyAmount ||
    parseUserAmountSafe(amount, usdtDecimals) > usdtBalance ||
    parseUserAmountSafe(slearnAmount, SLEARN_DECIMALS) > slearnBalance ||
    (hasAnyAmount && gasState === 'no-gas')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto mx-4">
        {showResult ? (
          <div className="text-center py-6">
            <button onClick={handleResultOk} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            <h2 className="text-xl font-semibold mb-4">{t('resultTitle')}</h2>
            {resultCashback > 0 && (
              <p className="text-lg text-green-700 font-medium mb-4">{t('resultCashback', resultCashback.toFixed(2))}</p>
            )}
            {/* Distribution breakdown from actual on-chain data */}
            {resultDistribution.length > 0 && (
              <div className="text-left text-sm space-y-1 mb-4 bg-gray-50 rounded-lg p-3">
                {resultDistribution.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-gray-700">{item.destination}</span>
                    <span className="font-mono font-medium">{Number(item.amount).toFixed?.(2) ?? item.amount} {item.crypto.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            )}
            {resultTxHash && (() => {
              const explorerBase = process.env.NEXT_PUBLIC_NETWORK === 'celo' ? 'https://celo.blockscout.com' : 'https://celo-sepolia.blockscout.com'
              const txLink = `${explorerBase}/tx/${resultTxHash}`
              return (
                <a href={txLink} target="_blank" rel="noopener noreferrer"
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
            <button onClick={closeAll} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            <h2 className="text-xl font-semibold mb-4">{tCopy?.title || t('donateToCourse')}</h2>

        {(!address || !walletClient) && (
          <div className="text-sm text-red-600 mb-4">{t('connectSign')}</div>
        )}
        {(!recipientAddress || !usdtAddress) && (
          <div className="text-sm text-red-600 mb-4">{t('missingContract')}</div>
        )}

        <div className="space-y-2 text-sm">
          <div>{t('yourBalance')}: <span className="font-mono">{usdtBalFmt}</span></div>
          {slearnAddress && (
            <div>{t('yourSlearnBalance')}: <span className="font-mono">{slearnBalFmt}</span></div>
          )}
          <div>{t('yourCelo')}: <span className="font-mono">{celoBalFmt}</span></div>
          {hasAnyAmount && (
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

        {tCopy?.splitInfo && (
          <div className="mt-4 text-xs bg-yellow-50 border border-yellow-200 rounded p-3">{tCopy.splitInfo}</div>
        )}

        {hasAnyAmount && rewardPct > 0 && totalUSDTValue > 0 && (
          <div className="mt-3 text-xs bg-green-50 border border-green-200 rounded p-3">
            <strong>{tCopy?.rewardLabel || t('estimatedReward')}:</strong> {t('estimatedRewardValue', estimatedReward.toFixed(2))}
          </div>
        )}

        <div className="mt-4">
          <label htmlFor="donate-amount" className="block text-sm mb-1">{t('amountLabel')}</label>
          <input id="donate-amount" type="number" min="0" step={1 / 10 ** Math.min(usdtDecimals, 6)}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:border-gray-400"
            value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t('enterAmount')} />
          <div className="flex justify-end mt-1 space-x-2 text-xs">
            <button onClick={() => setAmount(Number(formatUnits(usdtBalance, usdtDecimals)).toString())} className="text-blue-600 hover:underline">{t('max')}</button>
            <button onClick={() => setAmount('')} className="text-gray-500 hover:underline">{t('clear')}</button>
          </div>
        </div>

        <div className="mt-3">
          <label htmlFor="donate-slearn-amount" className="block text-sm mb-1">{t('slearnAmountLabel')}</label>
          <input id="donate-slearn-amount" type="number" min="0" step={1 / 10 ** SLEARN_DECIMALS}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:border-gray-400"
            value={slearnAmount} onChange={(e) => setSlearnAmount(e.target.value)} placeholder={t('enterAmount')} />
          <div className="flex justify-end mt-1 space-x-2 text-xs">
            <button onClick={() => setSlearnAmount(Number(formatUnits(slearnBalance, SLEARN_DECIMALS)).toString())} className="text-blue-600 hover:underline">{t('max')}</button>
            <button onClick={() => setSlearnAmount('')} className="text-gray-500 hover:underline">{t('clear')}</button>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={closeAll} className="flex-1 border rounded px-4 py-2 text-sm hover:bg-gray-50">{t('cancel')}</button>
          <button onClick={executePayment} disabled={donateDisabled}
            className={`flex-1 rounded px-4 py-2 text-sm font-medium text-white ${donateDisabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {isSubmitting ? t('processing') : t('donate')}
          </button>
        </div>

        {paymentError && (
          <div className="mt-3 text-sm">
            <div className="bg-red-50 border border-red-300 rounded p-3">
              <p className="font-semibold text-red-700 mb-1">{lang === 'es' ? 'Error' : 'Error'}</p>
              <pre className="whitespace-pre-wrap text-red-600 text-xs max-h-32 overflow-y-auto">{paymentError}</pre>
              <button onClick={() => navigator.clipboard.writeText(paymentError)}
                className="mt-1 text-xs text-red-500 underline hover:text-red-700">
                {lang === 'es' ? 'Copiar error' : 'Copy error'}
              </button>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  )
}

export default DonateModal
