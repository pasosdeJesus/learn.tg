'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { type Address } from 'viem'
import LearnTGVaultsAbi from '@/abis/LearnTGVaults.json'
import { Button } from '@/components/ui/button'
import { getCsrfToken } from 'next-auth/react'
import axios from 'axios'
import { erc20Abi, parseUserAmount, parseUserAmountSafe, formatDisplay, safeParseFloat } from '@/lib/donate-utils'

export interface DonateModalProps {
  courseId: number | null
  isOpen: boolean
  onClose: () => void
  onSuccess?: (data: { increment?: number }) => void
  lang?: string
}

interface StatusMsg { type: 'info' | 'error' | 'success'; text: string }

function useGasEstimation(
  amount: string,
  usdtDecimals: number,
  needsApproval: boolean,
  address: Address | undefined,
  walletClient: any,
  publicClient: any,
  vaultAddress: Address | undefined,
  usdtAddress: Address | undefined,
  courseId: number | null,
  celoBalance: bigint,
) {
  const [gasState, setGasState] = useState<'idle' | 'ok' | 'no-gas' | 'warn'>('idle')
  const [estimating, setEstimating] = useState(false)

  useEffect(() => {
    const estimate = async () => {
      if (!amount || safeParseFloat(amount) <= 0) { setGasState('idle'); return }
      if (!address || !walletClient || !publicClient || !vaultAddress || !courseId) {
        setGasState('no-gas'); return
      }
      try {
        setEstimating(true)
        const value = parseUserAmount(amount, usdtDecimals)
        if (value <= 0n) { setGasState('idle'); return }
        const gasPrice = await publicClient.getGasPrice()
        let totalGas = 0n
        if (needsApproval && usdtAddress) {
          const approveGas = await publicClient.estimateContractGas({
            address: usdtAddress, abi: erc20Abi, functionName: 'approve',
            account: address, args: [vaultAddress, value],
          })
          totalGas += approveGas
        }
        const depositGas = await publicClient.estimateContractGas({
          address: vaultAddress, abi: LearnTGVaultsAbi as any,
          functionName: 'deposit', account: address, args: [BigInt(courseId), value],
        })
        totalGas += depositGas
        setGasState(celoBalance > totalGas * gasPrice ? 'ok' : 'no-gas')
      } catch {
        setGasState('warn')
      } finally { setEstimating(false) }
    }
    estimate()
  }, [amount, address, walletClient, publicClient, vaultAddress, courseId, usdtAddress, needsApproval, celoBalance, usdtDecimals])

  return { gasState, estimating }
}

export function DonateModal({ courseId, isOpen, onClose, onSuccess, lang }: DonateModalProps) {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const [usdtDecimals, setUsdtDecimals] = useState<number>(+(process.env.NEXT_PUBLIC_USDT_DECIMALS || 6))
  const [usdtBalance, setUsdtBalance] = useState<bigint>(0n)
  const [celoBalance, setCeloBalance] = useState<bigint>(0n)
  const [amount, setAmount] = useState('')
  const [needsApproval, setNeedsApproval] = useState(true)
  const [allowance, setAllowance] = useState<bigint>(0n)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<StatusMsg | null>(null)

  const vaultAddress = process.env.NEXT_PUBLIC_DEPLOYED_AT as Address | undefined
  const usdtAddress = process.env.NEXT_PUBLIC_USDT_ADDRESS as Address | undefined
  const { gasState, estimating } = useGasEstimation(amount, usdtDecimals, needsApproval, address, walletClient, publicClient, vaultAddress, usdtAddress, courseId, celoBalance)

  const reset = () => { setAmount(''); setStatus(null); setNeedsApproval(true); setAllowance(0n) }
  const closeAll = () => { reset(); onClose() }

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
    } catch { setStatus({ type: 'error', text: 'Error loading balances' }) }
  }, [isOpen, address, publicClient, courseId, usdtAddress, vaultAddress, usdtDecimals])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    if (!amount) { setNeedsApproval(true); return }
    try { setNeedsApproval(parseUserAmount(amount, usdtDecimals) > allowance) }
    catch { setNeedsApproval(true) }
  }, [amount, allowance, usdtDecimals])

  const donate = async () => {
    if (!walletClient || !publicClient || !address || !vaultAddress || !usdtAddress || !courseId) return
    let parsed: bigint
    try { parsed = parseUserAmount(amount, usdtDecimals) } catch { setStatus({ type: 'error', text: 'Invalid amount' }); return }
    if (parsed <= 0n || parsed > usdtBalance) { setStatus({ type: 'error', text: 'Amount out of range' }); return }
    setSubmitting(true)
    setStatus({ type: 'info', text: 'Submitting transaction(s)...' })
    try {
      if (needsApproval) {
        const approveHash = await walletClient.writeContract({ address: usdtAddress, abi: erc20Abi, functionName: 'approve', args: [vaultAddress, parsed] })
        await publicClient.waitForTransactionReceipt({ hash: approveHash })
      }
      const depositHash = await walletClient.writeContract({ address: vaultAddress, abi: LearnTGVaultsAbi as any, functionName: 'deposit', args: [BigInt(courseId), parsed] })
      const { status: txStatus } = await publicClient.waitForTransactionReceipt({ hash: depositHash })
      if (txStatus !== 'success') throw new Error('Deposit failed')

      let increment: number | undefined
      try {
        const csrfToken = await getCsrfToken()
        if (csrfToken && address) {
          const donationAmountUSD = safeParseFloat(amount)
          if (donationAmountUSD > 0) {
            const { data } = await axios.post('/api/add-donation', {
              lang, walletAddress: address, token: csrfToken, donationAmountUSD,
              depositHash, courseId,
            })
            increment = data.increment
          }
        }
      } catch {
        const donationAmountUSD = safeParseFloat(amount)
        alert(lang === 'es'
          ? 'Gracias por tu donacion de ' + donationAmountUSD + ' USD! No pudimos actualizar tus puntos automaticamente. Toma un pantallazo y envialo a soporte.'
          : 'Thank you for your donation of ' + donationAmountUSD + ' USD! We could not update your points automatically. Please screenshot and contact support.')
      }
      await loadData()
      onSuccess?.({ increment })
      closeAll()
    } catch (e: any) {
      setStatus({ type: 'error', text: e.message || 'Transaction failed' })
    } finally { setSubmitting(false) }
  }

  if (!isOpen || courseId === null) return null
  const t = createComponentT(lang || 'en', {
    en: { donateToCourse: 'Donate to course', connectSign: 'Connect and sign with your wallet to donate', yourBalance: 'Your USDT Balance', yourCelo: 'Your CELO (gas)', enoughGas: 'Enough gas estimated', noGas: 'Not enough gas for transaction', gasWarn: 'Gas estimation failed, proceed at your own risk', estimating: 'estimating...', donateSplit: '80% of your donation increases the scholarship vault and 20% helps sustain learn.tg operations', amountLabel: 'Amount (USDT)', enterAmount: 'Enter amount', max: 'Max', clear: 'Clear', cancel: 'Cancel', processing: 'Processing...', approveDonate: 'Approve & Donate', donate: 'Donate', missingContract: 'Missing contract env vars' },
    es: { donateToCourse: 'Donar al curso', connectSign: 'Conecta y firma con tu billetera para donar', yourBalance: 'Tu saldo USDT', yourCelo: 'Tu CELO (gas)', enoughGas: 'Gas suficiente estimado', noGas: 'Gas insuficiente para la transaccion', gasWarn: 'Fallo al estimar gas, continue bajo su propio riesgo', estimating: 'estimando...', donateSplit: '80% de tu donacion aumenta el fondo de becas y 20% ayuda a sostener learn.tg', amountLabel: 'Monto (USDT)', enterAmount: 'Ingresa monto', max: 'Todo', clear: 'Limpiar', cancel: 'Cancelar', processing: 'Procesando...', approveDonate: 'Aprobar y Donar', donate: 'Donar', missingContract: 'Faltan variables de entorno del contrato' },
  })
  const usdtBalFmt = formatDisplay(usdtBalance, usdtDecimals)
  const celoBalFmt = formatDisplay(celoBalance, 18)
  const amountNum = safeParseFloat(amount)
  const donateDisabled = submitting || !amount || amountNum <= 0 ||
    parseUserAmountSafe(amount, usdtDecimals) > usdtBalance || (amountNum > 0 && gasState === 'no-gas')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative">
        <Button onClick={closeAll} variant="ghost" size="icon" className="absolute top-2 right-2">✕</Button>
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
                <Button onClick={() => setAmount(formatDisplay(usdtBalance, usdtDecimals))} variant="link" size="sm" className="h-auto p-0">{t('max')}</Button>
                <Button onClick={() => setAmount('')} variant="link" size="sm" className="h-auto p-0">{t('clear')}</Button>
              </div>
            </div>
          </>
        )}

        {status && <div className={`mt-3 text-xs rounded p-2 border ${status.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : status.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>{status.text}</div>}

        <div className="mt-6 flex justify-end space-x-3">
          <Button onClick={closeAll} variant="outline" size="sm">{t('cancel')}</Button>
          <Button disabled={donateDisabled} onClick={donate} size="sm">
            {submitting ? t('processing') : needsApproval ? t('approveDonate') : t('donate')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default DonateModal
