'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { type Address, formatUnits } from 'viem'
import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import axios from 'axios'
import { erc20Abi, parseUserAmount, parseUserAmountSafe, formatDisplay, safeParseFloat } from '@/lib/donate-utils'
import { useGasEstimation } from '@/lib/hooks/useGasEstimation'
import { useContractPayment } from '@/lib/hooks/useContractPayment'
import { TransactionStatus } from '@/components/ui/TransactionStatus'

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
  const [celoBalance, setCeloBalance] = useState<bigint>(0n)
  const [amount, setAmount] = useState('')
  const [allowance, setAllowance] = useState<bigint>(0n)

  const vaultAddress = process.env.NEXT_PUBLIC_DEPLOYED_AT as Address | undefined
  const usdtAddress = process.env.NEXT_PUBLIC_USDT_ADDRESS as Address | undefined

  const { gasState, estimating } = useGasEstimation({
    amount, usdtDecimals,
    needsApproval: (() => {
      if (!amount) return true
      try { return parseUserAmount(amount, usdtDecimals) > allowance }
      catch { return true }
    })(),
    address, walletClient, publicClient, vaultAddress, usdtAddress, courseId, celoBalance,
  })

  const {
    state: paymentState,
    error: paymentError,
    needsApproval,
    execute: executePayment,
    reset: resetPayment,
  } = useContractPayment({
    amount, usdtDecimals, address, walletClient, publicClient,
    vaultAddress, usdtAddress, courseId, allowance, usdtBalance, lang,
    onBackendCallback: async ({ walletAddress, token, donationAmountUSD, depositHash, courseId: cId }) => {
      const { data } = await axios.post('/api/add-donation', {
        lang, walletAddress, token, donationAmountUSD, depositHash, courseId: cId,
      })
      return data
    },
    onSuccess,
  })

  const reset = useCallback(() => {
    setAmount('')
    setAllowance(0n)
    resetPayment()
  }, [resetPayment])

  const closeAll = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  const loadData = useCallback(async () => {
    if (!isOpen || !address || !publicClient || !courseId || !usdtAddress || !vaultAddress) return
    try {
      const [dec, bal, nativeBal, al] = await Promise.all([
        publicClient.readContract({ address: usdtAddress, abi: erc20Abi, functionName: 'decimals' }).catch(() => BigInt(usdtDecimals)),
        publicClient.readContract({ address: usdtAddress, abi: erc20Abi, functionName: 'balanceOf', args: [address] }) as Promise<bigint>,
        publicClient.getBalance({ address }),
        publicClient.readContract({ address: usdtAddress, abi: erc20Abi, functionName: 'allowance', args: [address, vaultAddress] }) as Promise<bigint>,
      ])
      setUsdtDecimals(Number(dec)); setUsdtBalance(bal); setCeloBalance(nativeBal); setAllowance(al)
    } catch {
      // Silently fail; balances will show as 0
    }
  }, [isOpen, address, publicClient, courseId, usdtAddress, vaultAddress, usdtDecimals])

  useEffect(() => { loadData() }, [loadData])

  if (!isOpen || courseId === null) return null

  const t = createComponentT(lang || 'en', {
    en: { donateToCourse: 'Donate to course', connectSign: 'Connect and sign with your wallet to donate', yourBalance: 'Your USDT Balance', yourCelo: 'Your CELO (gas)', enoughGas: 'Enough gas estimated', noGas: 'Not enough gas for transaction', gasWarn: 'Gas estimation failed, proceed at your own risk', estimating: 'estimating...', donateSplit: '80% of your donation increases the scholarship vault and 20% helps sustain learn.tg operations', amountLabel: 'Amount (USDT)', enterAmount: 'Enter amount', max: 'Max', clear: 'Clear', cancel: 'Cancel', processing: 'Processing...', approveDonate: 'Approve & Donate', donate: 'Donate', missingContract: 'Missing contract env vars' },
    es: { donateToCourse: 'Donar al curso', connectSign: 'Conecta y firma con tu billetera para donar', yourBalance: 'Tu saldo USDT', yourCelo: 'Tu CELO (gas)', enoughGas: 'Gas suficiente estimado', noGas: 'Gas insuficiente para la transaccion', gasWarn: 'Fallo al estimar gas, continue bajo su propio riesgo', estimating: 'estimando...', donateSplit: '80% de tu donacion aumenta el fondo de becas y 20% ayuda a sostener learn.tg', amountLabel: 'Monto (USDT)', enterAmount: 'Ingresa monto', max: 'Todo', clear: 'Limpiar', cancel: 'Cancelar', processing: 'Procesando...', approveDonate: 'Aprobar y Donar', donate: 'Donar', missingContract: 'Faltan variables de entorno del contrato' },
  })

  const usdtBalFmt = formatDisplay(usdtBalance, usdtDecimals)
  const celoBalFmt = formatDisplay(celoBalance, 18)
  const amountNum = safeParseFloat(amount)
  const isSubmitting = paymentState === 'approving' || paymentState === 'paying' || paymentState === 'confirming'
  const donateDisabled = isSubmitting || !amount || amountNum <= 0 ||
    parseUserAmountSafe(amount, usdtDecimals) > usdtBalance || (amountNum > 0 && gasState === 'no-gas')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative">
        <button onClick={closeAll} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        <h2 className="text-xl font-semibold mb-4">{t('donateToCourse')} #{courseId}</h2>

        {(!address || !walletClient) && (
          <div className="text-sm text-red-600 mb-4">{t('connectSign')}</div>
        )}
        {(!vaultAddress || !usdtAddress) && (
          <div className="text-sm text-red-600 mb-4">{t('missingContract')}</div>
        )}

        <div className="space-y-2 text-sm">
          <div>{t('yourBalance')}: <span className="font-mono">{usdtBalFmt}</span></div>
          <div>{t('yourCelo')}: <span className="font-mono">{celoBalFmt}</span></div>
          {amountNum > 0 && (
            <div className={gasState === 'ok' ? 'text-green-600' : gasState === 'no-gas' ? 'text-red-600' : gasState === 'warn' ? 'text-yellow-600' : 'text-gray-500'}>
              {gasState === 'ok' && t('enoughGas')}
              {gasState === 'no-gas' && t('noGas')}
              {gasState === 'warn' && t('gasWarn')}
              {estimating && <span className="ml-2 animate-pulse">{t('estimating')}</span>}
            </div>
          )}
        </div>

        {usdtBalance > 0n && (
          <>
            {(amountNum === 0 || gasState === 'ok' || gasState === 'warn') && (
              <div className="mt-4 text-xs bg-yellow-50 border border-yellow-200 rounded p-3">{t('donateSplit')}</div>
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
          </>
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
            {isSubmitting ? t('processing') : needsApproval ? t('approveDonate') : t('donate')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DonateModal
