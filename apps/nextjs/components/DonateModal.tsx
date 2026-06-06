'use client'

import { useEffect, useState, useCallback } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { type Address, formatUnits } from 'viem'
import axios from 'axios'
import { erc20Abi, parseUserAmountSafe, formatDisplay, safeParseFloat } from '@/lib/donate-utils'
import { useGasEstimation } from '@/lib/hooks/useGasEstimation'
import { useContractPayment } from '@/lib/hooks/useContractPayment'
import { TransactionStatus } from '@/components/ui/TransactionStatus'

const SLEARN_DECIMALS = 2
const SLEARN_RATE = 22 // 1 USDT = 22 SLEARN
const REWARD_PCT = 10 // 10% of total value as SLEARN reward

export interface DonateModalProps {
  courseId: number | null
  isOpen: boolean
  onClose: () => void
  onSuccess?: (data: { increment?: number }) => void
  lang?: string
}

export function DonateModal({ courseId, isOpen, onClose, onSuccess, lang }: DonateModalProps) {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const [usdtDecimals, setUsdtDecimals] = useState<number>(+(process.env.NEXT_PUBLIC_USDT_DECIMALS || 6))
  const [usdtBalance, setUsdtBalance] = useState<bigint>(0n)
  const [slearnBalance, setSlearnBalance] = useState<bigint>(0n)
  const [celoBalance, setCeloBalance] = useState<bigint>(0n)
  const [amount, setAmount] = useState('')
  const [slearnAmount, setSlearnAmount] = useState('')

  const backendWalletAddress = (process.env.NEXT_PUBLIC_ADDRESS as Address) || undefined
  const usdtAddress = (process.env.NEXT_PUBLIC_USDT_ADDRESS as Address) || undefined
  const slearnAddress = (process.env.NEXT_PUBLIC_SLEARN_ADDRESS as Address) || undefined

  const usdtNum = safeParseFloat(amount)
  const slearnNum = safeParseFloat(slearnAmount)
  const totalUSDTValue = usdtNum + (slearnNum / SLEARN_RATE)
  const estimatedReward = totalUSDTValue * (REWARD_PCT / 100) * SLEARN_RATE

  const { gasState, estimating } = useGasEstimation({
    amount, slearnAmount, usdtDecimals,
    address, walletClient, publicClient,
    backendWalletAddress, usdtAddress, slearnAddress,
    courseId, celoBalance,
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
    backendWalletAddress, usdtAddress, slearnAddress,
    courseId, usdtBalance, slearnBalance, lang,
    onBackendCallback: async ({ walletAddress, token, donationAmountUSD, slearnDonationAmount, usdtHash, slearnHash, courseId: cId }) => {
      const { data } = await axios.post('/api/add-donation', {
        walletAddress, token, donationAmountUSD, slearnDonationAmount,
        usdtHash, slearnHash, courseId: cId,
      })
      return data
    },
    onSuccess,
  })

  const reset = useCallback(() => {
    setAmount('')
    setSlearnAmount('')
    resetPayment()
  }, [resetPayment])

  const closeAll = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  const loadData = useCallback(async () => {
    if (!isOpen || !address || !publicClient || !courseId || !usdtAddress || !backendWalletAddress) return
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
    } catch {
      // Silently fail; balances will show as 0
    }
  }, [isOpen, address, publicClient, courseId, usdtAddress, backendWalletAddress, usdtDecimals, slearnAddress])

  useEffect(() => { loadData() }, [loadData])

  if (!isOpen || courseId === null) return null

  const t = createComponentT(lang || 'en', {
    en: {
      donateToCourse: 'Donate to course',
      connectSign: 'Connect and sign with your wallet to donate',
      yourBalance: 'Your USDT Balance',
      yourSlearnBalance: 'Your SLEARN Balance',
      yourCelo: 'Your CELO (gas)',
      enoughGas: 'Enough gas estimated',
      noGas: 'Not enough gas for transaction',
      gasWarn: 'Gas estimation failed, proceed at your own risk',
      estimating: 'estimating...',
      donateSplit: '70% goes to course scholarships, 10% back as SLEARN reward, 20% sustains operations and missions.',
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
    },
    es: {
      donateToCourse: 'Donar al curso',
      connectSign: 'Conecta y firma con tu billetera para donar',
      yourBalance: 'Tu saldo USDT',
      yourSlearnBalance: 'Tu saldo SLEARN',
      yourCelo: 'Tu CELO (gas)',
      enoughGas: 'Gas suficiente estimado',
      noGas: 'Gas insuficiente para la transaccion',
      gasWarn: 'Fallo al estimar gas, continue bajo su propio riesgo',
      estimating: 'estimando...',
      donateSplit: '70% va a becas del curso, 10% vuelve como SLEARN de recompensa, 20% sostiene operaciones y misiones.',
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative">
        <button onClick={closeAll} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        <h2 className="text-xl font-semibold mb-4">{t('donateToCourse')} #{courseId}</h2>

        {(!address || !walletClient) && (
          <div className="text-sm text-red-600 mb-4">{t('connectSign')}</div>
        )}
        {(!backendWalletAddress || !usdtAddress) && (
          <div className="text-sm text-red-600 mb-4">{t('missingContract')}</div>
        )}

        <div className="space-y-2 text-sm">
          <div>{t('yourBalance')}: <span className="font-mono">{usdtBalFmt}</span></div>
          {slearnAddress && (
            <div>{t('yourSlearnBalance')}: <span className="font-mono">{slearnBalFmt}</span></div>
          )}
          <div>{t('yourCelo')}: <span className="font-mono">{celoBalFmt}</span></div>
          {hasAnyAmount && (
            <div className={gasState === 'ok' ? 'text-green-600' : gasState === 'no-gas' ? 'text-red-600' : gasState === 'warn' ? 'text-yellow-600' : 'text-gray-500'}>
              {gasState === 'ok' && t('enoughGas')}
              {gasState === 'no-gas' && t('noGas')}
              {gasState === 'warn' && t('gasWarn')}
              {estimating && <span className="ml-2 animate-pulse">{t('estimating')}</span>}
            </div>
          )}
        </div>

        {hasAnyAmount && (
          <div className="mt-4 text-xs bg-yellow-50 border border-yellow-200 rounded p-3">{t('donateSplit')}</div>
        )}

        {hasAnyAmount && totalUSDTValue > 0 && (
          <div className="mt-3 text-xs bg-green-50 border border-green-200 rounded p-3">
            <strong>{t('estimatedReward')}:</strong> {t('estimatedRewardValue', estimatedReward.toFixed(2))}
          </div>
        )}

        <div className="mt-4">
          <label htmlFor={`donate-amount-${courseId}`} className="block text-sm mb-1">{t('amountLabel')}</label>
          <input id={`donate-amount-${courseId}`} type="number" min="0" step={1 / 10 ** Math.min(usdtDecimals, 6)}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:border-gray-400"
            value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t('enterAmount')} />
          <div className="flex justify-end mt-1 space-x-2 text-xs">
            <button onClick={() => setAmount(Number(formatUnits(usdtBalance, usdtDecimals)).toString())} className="text-blue-600 hover:underline">{t('max')}</button>
            <button onClick={() => setAmount('')} className="text-gray-500 hover:underline">{t('clear')}</button>
          </div>
        </div>

        {slearnAddress && (
          <div className="mt-4">
            <label htmlFor={`donate-slearn-amount-${courseId}`} className="block text-sm mb-1">{t('slearnAmountLabel')}</label>
            <input id={`donate-slearn-amount-${courseId}`} type="number" min="0" step={1 / 10 ** SLEARN_DECIMALS}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:border-gray-400"
              value={slearnAmount} onChange={(e) => setSlearnAmount(e.target.value)} placeholder={t('enterAmount')} />
            <div className="flex justify-end mt-1 space-x-2 text-xs">
              <button onClick={() => setSlearnAmount(Number(formatUnits(slearnBalance, SLEARN_DECIMALS)).toString())} className="text-blue-600 hover:underline">{t('max')}</button>
              <button onClick={() => setSlearnAmount('')} className="text-gray-500 hover:underline">{t('clear')}</button>
            </div>
          </div>
        )}

        <TransactionStatus
          state={paymentState}
          error={paymentError}
          onRetry={executePayment}
          onDismiss={resetPayment}
          lang={lang}
        />

        <div className="mt-6 flex justify-end space-x-3">
          <button onClick={closeAll} className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">{t('cancel')}</button>
          <button
            disabled={donateDisabled}
            onClick={executePayment}
            className={`px-4 py-2 text-sm rounded-md text-white ${donateDisabled ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {isSubmitting ? t('processing') : t('donate')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DonateModal
