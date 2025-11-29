'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { formatUnits, parseUnits, type Address } from 'viem'
import LearnTGVaultsAbi from '@/abis/LearnTGVaults.json'
import { Button } from '@/components/ui/button'

const erc20Abi = [
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

export interface DonateModalProps {
  courseId: number | null
  isOpen: boolean
  onClose: () => void
  onSuccess?: (newVaultBalance?: number) => void
  lang?: string
}

interface StatusMsg {
  type: 'info' | 'error' | 'success'
  text: string
}

export function DonateModal({
  courseId,
  isOpen,
  onClose,
  onSuccess,
  lang,
}: DonateModalProps) {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const [usdtDecimals, setUsdtDecimals] = useState<number>(
    +(process.env.NEXT_PUBLIC_USDT_DECIMALS || 6),
  )
  const [usdtBalance, setUsdtBalance] = useState<bigint>(0n)
  const [celoBalance, setCeloBalance] = useState<bigint>(0n)
  const [amount, setAmount] = useState<string>('')
  const [estimating, setEstimating] = useState(false)
  const [gasState, setGasState] = useState<'idle' | 'ok' | 'no-gas' | 'warn'>(
    'idle',
  )
  const [needsApproval, setNeedsApproval] = useState<boolean>(true)
  const [allowance, setAllowance] = useState<bigint>(0n)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<StatusMsg | null>(null)

  const vaultAddress = process.env.NEXT_PUBLIC_DEPLOYED_AT as
    | Address
    | undefined
  const usdtAddress = process.env.NEXT_PUBLIC_USDT_ADDRESS as
    | Address
    | undefined

  const reset = () => {
    setAmount('')
    setStatus(null)
    setNeedsApproval(true)
    setAllowance(0n)
  }
  const closeAll = () => {
    reset()
    onClose()
  }

  const loadData = useCallback(async () => {
    if (
      !isOpen ||
      !address ||
      !publicClient ||
      !courseId ||
      !usdtAddress ||
      !vaultAddress
    )
      return
    try {
      const [dec, bal, nativeBal, allowanceValue] = await Promise.all([
        publicClient
          .readContract({
            address: usdtAddress,
            abi: erc20Abi,
            functionName: 'decimals',
          })
          .catch(() => BigInt(usdtDecimals)),
        publicClient.readContract({
          address: usdtAddress,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [address],
        }) as Promise<bigint>,
        publicClient.getBalance({ address }),
        publicClient.readContract({
          address: usdtAddress,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [address, vaultAddress],
        }) as Promise<bigint>,
      ])
      const decNumber = Number(dec)
      setUsdtDecimals(decNumber)
      setUsdtBalance(bal)
      setCeloBalance(nativeBal)
      setAllowance(allowanceValue)
    } catch (e: any) {
      console.error(e)
      setStatus({ type: 'error', text: e.message || 'Error loading balances' })
    }
  }, [
    isOpen,
    address,
    publicClient,
    courseId,
    usdtAddress,
    vaultAddress,
    usdtDecimals,
  ])

  useEffect(() => {
    loadData()
  }, [loadData])
  useEffect(() => {
    if (!amount) {
      setNeedsApproval(true)
      setGasState('idle')
      return
    }
    try {
      const parsed = parseUserAmount(amount, usdtDecimals)
      setNeedsApproval(parsed > allowance)
    } catch {
      setNeedsApproval(true)
    }
  }, [amount, allowance, usdtDecimals])

  useEffect(() => {
    const estimate = async () => {
      if (!amount || parseFloat(amount) <= 0) {
        setGasState('idle')
        return
      }
      if (
        !address ||
        !walletClient ||
        !publicClient ||
        !vaultAddress ||
        !courseId
      ) {
        setGasState('no-gas')
        return
      }
      try {
        setEstimating(true)
        const value = parseUserAmount(amount, usdtDecimals)
        if (value <= 0n) {
          setGasState('idle')
          return
        }
        const gasPrice = await publicClient.getGasPrice()
        let totalGas = 0n
        if (needsApproval && usdtAddress) {
          const approveGas = await publicClient.estimateContractGas({
            address: usdtAddress,
            abi: erc20Abi,
            functionName: 'approve',
            account: address,
            args: [vaultAddress, value],
          })
          totalGas += approveGas
        }
        const depositGas = await publicClient.estimateContractGas({
          address: vaultAddress,
          abi: LearnTGVaultsAbi as any,
          functionName: 'deposit',
          account: address,
          args: [BigInt(courseId), value],
        })
        totalGas += depositGas
        const cost = totalGas * gasPrice
        setGasState(celoBalance > cost ? 'ok' : 'no-gas')
      } catch (e) {
        console.warn('Gas estimation failed. Allowing continue.', e)
        // Consideramos warn (permitido continuar)
        setGasState('warn')
      } finally {
        setEstimating(false)
      }
    }
    estimate()
  }, [
    amount,
    address,
    walletClient,
    publicClient,
    vaultAddress,
    courseId,
    usdtAddress,
    needsApproval,
    celoBalance,
    usdtDecimals,
  ])

  const donate = async () => {
    if (
      !walletClient ||
      !publicClient ||
      !address ||
      !vaultAddress ||
      !usdtAddress ||
      !courseId
    )
      return
    let parsed: bigint
    try {
      parsed = parseUserAmount(amount, usdtDecimals)
    } catch {
      setStatus({ type: 'error', text: 'Invalid amount' })
      return
    }
    if (parsed <= 0n || parsed > usdtBalance) {
      setStatus({ type: 'error', text: 'Amount out of range' })
      return
    }
    setSubmitting(true)
    setStatus({ type: 'info', text: 'Submitting transaction(s)...' })
    try {
      if (needsApproval) {
        const approveHash = await walletClient.writeContract({
          address: usdtAddress,
          abi: erc20Abi,
          functionName: 'approve',
          args: [vaultAddress, parsed],
        })
        await publicClient.waitForTransactionReceipt({ hash: approveHash })
        setStatus({ type: 'info', text: 'Approval confirmed. Depositing...' })
      }
      console.log('Donating raw (scaled) amount:', parsed.toString())
      const depositHash = await walletClient.writeContract({
        address: vaultAddress,
        abi: LearnTGVaultsAbi as any,
        functionName: 'deposit',
        args: [BigInt(courseId), parsed],
      })
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: depositHash,
      })
      if (receipt.status !== 'success') throw new Error('Deposit failed')
      await loadData()
      // Cerramos modal y delegamos la notificación a la página
      onSuccess && onSuccess()
      closeAll()
    } catch (e: any) {
      console.error(e)
      setStatus({ type: 'error', text: e.message || 'Transaction failed' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen || courseId === null) return null
  const t = (en: string, es: string) => (lang === 'es' ? es : en)
  const usdtBalFmt = formatDisplay(usdtBalance, usdtDecimals)
  const celoBalFmt = formatDisplay(celoBalance, 18)
  const amountNum = safeParseFloat(amount)
  const donateDisabled =
    submitting ||
    !amount ||
    amountNum <= 0 ||
    parseUserAmountSafe(amount, usdtDecimals) > usdtBalance ||
    (amountNum > 0 && gasState === 'no-gas')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative">
        <Button
          onClick={closeAll}
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2"
        >
          ✕
        </Button>
        <h2 className="text-xl font-semibold mb-4">
          {t('Donate to course', 'Donar al curso')} #{courseId}
        </h2>
        {(!address || !walletClient) && (
          <div className="text-sm text-red-600 mb-4">
            {t(
              'Connect and sign with your wallet to donate',
              'Conecta y firma con tu billetera para donar',
            )}
          </div>
        )}
        {(!vaultAddress || !usdtAddress) && (
          <div className="text-sm text-red-600 mb-4">
            Missing contract env vars
          </div>
        )}
        <div className="space-y-2 text-sm">
          <div>
            {t('Your USDT Balance', 'Tu saldo USDT')}:{' '}
            <span className="font-mono">{usdtBalFmt}</span>
          </div>
          <div>
            {t('Your CELO (gas)', 'Tu CELO (gas)')}:{' '}
            <span className="font-mono">{celoBalFmt}</span>
          </div>
          {amountNum > 0 && (
            <div
              className={
                gasState === 'ok'
                  ? 'text-green-600'
                  : gasState === 'no-gas'
                    ? 'text-red-600'
                    : gasState === 'warn'
                      ? 'text-yellow-600'
                      : 'text-gray-500'
              }
            >
              {gasState === 'ok' &&
                t('Enough gas estimated', 'Gas suficiente estimado')}
              {gasState === 'no-gas' &&
                t(
                  'Not enough gas for transaction',
                  'Gas insuficiente para la transacción',
                )}
              {gasState === 'warn' &&
                t(
                  'Gas estimation failed, proceed at your own risk',
                  'Fallo al estimar gas, continúe bajo su propio riesgo',
                )}
              {estimating && (
                <span className="ml-2 animate-pulse">
                  {t('estimating...', 'estimando...')}
                </span>
              )}
            </div>
          )}
        </div>
        {usdtBalance > 0n && (
          <>
            {(amountNum === 0 || gasState === 'ok' || gasState === 'warn') && (
              <div className="mt-4 text-xs bg-yellow-50 border border-yellow-200 rounded p-3">
                {t(
                  '80% of your donation increases the scholarship vault and 20% helps sustain learn.tg operations',
                  '80% de tu donación aumenta el fondo de becas y 20% ayuda a sostener learn.tg',
                )}
              </div>
            )}
            <div className="mt-4">
              <label
                htmlFor={`donate-amount-${courseId}`}
                className="block text-sm mb-1"
              >
                {t('Amount (USDT)', 'Monto (USDT)')}
              </label>
              <input
                id={`donate-amount-${courseId}`}
                type="number"
                min="0"
                step={1 / 10 ** Math.min(usdtDecimals, 6)}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:border-gray-400"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t('Enter amount', 'Ingresa monto')}
              />
              <div className="flex justify-end mt-1 space-x-2 text-xs">
                <Button
                  onClick={() =>
                    setAmount(formatUnits(usdtBalance, usdtDecimals))
                  }
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                >
                  {t('Max', 'Todo')}
                </Button>
                <Button
                  onClick={() => setAmount('')}
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                >
                  {t('Clear', 'Limpiar')}
                </Button>
              </div>
            </div>
          </>
        )}
        {status && (
          <div
            className={`mt-3 text-xs rounded p-2 border ${status.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : status.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}
          >
            {status.text}
          </div>
        )}
        <div className="mt-6 flex justify-end space-x-3">
          <Button onClick={closeAll} variant="outline" size="sm">
            {t('Cancel', 'Cancelar')}
          </Button>
          <Button disabled={donateDisabled} onClick={donate} size="sm">
            {submitting
              ? t('Processing...', 'Procesando...')
              : needsApproval
                ? t('Approve & Donate', 'Aprobar y Donar')
                : t('Donate', 'Donar')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function parseUserAmount(value: string, decimals: number): bigint {
  if (!/^\d*(\.|,)?\d*$/.test(value)) throw new Error('Invalid number')
  const normalized = value.replace(',', '.')
  if (normalized.trim() === '') return 0n
  return parseUnits(normalized as `${number}`, decimals)
}
function formatDisplay(v: bigint, decimals: number): string {
  try {
    const num = Number(formatUnits(v, decimals))
    if (isNaN(num)) return '0'
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  } catch {
    return '0'
  }
}
function parseUserAmountSafe(value: string, decimals: number): bigint {
  try {
    return parseUserAmount(value, decimals)
  } catch {
    return 0n
  }
}
function safeParseFloat(v: string): number {
  return isNaN(parseFloat(v)) ? 0 : parseFloat(v)
}

export default DonateModal
