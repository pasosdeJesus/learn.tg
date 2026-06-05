'use client'

import { useEffect, useState } from 'react'
import { type Address } from 'viem'
import { erc20Abi, parseUserAmount, safeParseFloat } from '@/lib/donate-utils'

export type GasState = 'idle' | 'ok' | 'no-gas' | 'warn'

interface UseGasEstimationOptions {
  amount: string
  slearnAmount: string
  usdtDecimals: number
  address: Address | undefined
  walletClient: any
  publicClient: any
  backendWalletAddress: Address | undefined
  usdtAddress: Address | undefined
  slearnAddress: Address | undefined
  courseId: number | null
  celoBalance: bigint
}

export function useGasEstimation({
  amount,
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
}: UseGasEstimationOptions) {
  const [gasState, setGasState] = useState<GasState>('idle')
  const [estimating, setEstimating] = useState(false)

  useEffect(() => {
    const estimate = async () => {
      const hasUsdt = amount && safeParseFloat(amount) > 0
      const hasSlearn = slearnAmount && safeParseFloat(slearnAmount) > 0
      if (!hasUsdt && !hasSlearn) { setGasState('idle'); return }
      if (!address || !walletClient || !publicClient || !backendWalletAddress || !courseId) {
        setGasState('no-gas'); return
      }
      try {
        setEstimating(true)
        const gasPrice = await publicClient.getGasPrice()
        let totalGas = 0n

        if (hasUsdt && usdtAddress) {
          const value = parseUserAmount(amount, usdtDecimals)
          if (value > 0n) {
            const transferGas = await publicClient.estimateContractGas({
              address: usdtAddress, abi: erc20Abi, functionName: 'transfer',
              account: address, args: [backendWalletAddress, value],
            })
            totalGas += transferGas
          }
        }

        if (hasSlearn && slearnAddress) {
          const value = parseUserAmount(slearnAmount, 2)
          if (value > 0n) {
            const transferGas = await publicClient.estimateContractGas({
              address: slearnAddress, abi: erc20Abi, functionName: 'transfer',
              account: address, args: [backendWalletAddress, value],
            })
            totalGas += transferGas
          }
        }

        if (totalGas === 0n) { setGasState('idle'); return }
        setGasState(celoBalance > totalGas * gasPrice ? 'ok' : 'no-gas')
      } catch {
        setGasState('warn')
      } finally { setEstimating(false) }
    }
    estimate()
  }, [amount, slearnAmount, address, walletClient, publicClient, backendWalletAddress, usdtAddress, slearnAddress, courseId, celoBalance, usdtDecimals])

  return { gasState, estimating }
}
