'use client'

import { useEffect, useState } from 'react'
import { type Address } from 'viem'
import LearnTGVaultsAbi from '@/abis/LearnTGVaults.json'
import { erc20Abi, parseUserAmount, safeParseFloat } from '@/lib/donate-utils'

export type GasState = 'idle' | 'ok' | 'no-gas' | 'warn'

interface UseGasEstimationOptions {
  amount: string
  usdtDecimals: number
  needsApproval: boolean
  address: Address | undefined
  walletClient: any
  publicClient: any
  vaultAddress: Address | undefined
  usdtAddress: Address | undefined
  courseId: number | null
  celoBalance: bigint
}

export function useGasEstimation({
  amount,
  usdtDecimals,
  needsApproval,
  address,
  walletClient,
  publicClient,
  vaultAddress,
  usdtAddress,
  courseId,
  celoBalance,
}: UseGasEstimationOptions) {
  const [gasState, setGasState] = useState<GasState>('idle')
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
