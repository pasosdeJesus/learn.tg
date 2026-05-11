'use client'

import { useState, useCallback } from 'react'
import { type Address } from 'viem'
import LearnTGVaultsAbi from '@/abis/LearnTGVaults.json'
import { erc20Abi, parseUserAmount, safeParseFloat } from '@/lib/donate-utils'
import { getCsrfToken } from 'next-auth/react'
import axios from 'axios'

export type PaymentState =
  | 'idle'
  | 'approving'
  | 'paying'
  | 'confirming'
  | 'success'
  | 'error'

export interface UseContractPaymentOptions {
  amount: string
  usdtDecimals: number
  address: Address | undefined
  walletClient: any
  publicClient: any
  vaultAddress: Address | undefined
  usdtAddress: Address | undefined
  courseId: number | null
  allowance: bigint
  usdtBalance: bigint
  lang?: string
  onBackendCallback?: (params: {
    walletAddress: string
    token: string
    donationAmountUSD: number
    depositHash: string
    courseId: number
  }) => Promise<{ increment?: number }>
  onSuccess?: (data: { increment?: number }) => void
}

export interface UseContractPaymentReturn {
  state: PaymentState
  error: string | null
  needsApproval: boolean
  execute: () => Promise<void>
  reset: () => void
}

export function useContractPayment({
  amount,
  usdtDecimals,
  address,
  walletClient,
  publicClient,
  vaultAddress,
  usdtAddress,
  courseId,
  allowance,
  usdtBalance,
  lang,
  onBackendCallback,
  onSuccess,
}: UseContractPaymentOptions): UseContractPaymentReturn {
  const [state, setState] = useState<PaymentState>('idle')
  const [error, setError] = useState<string | null>(null)

  const needsApproval = (() => {
    if (!amount) return true
    try { return parseUserAmount(amount, usdtDecimals) > allowance }
    catch { return true }
  })()

  const reset = useCallback(() => {
    setState('idle')
    setError(null)
  }, [])

  const execute = useCallback(async () => {
    if (!walletClient || !publicClient || !address || !vaultAddress || !usdtAddress || !courseId) {
      setState('error')
      setError('Missing wallet or contract configuration')
      return
    }

    let parsed: bigint
    try {
      parsed = parseUserAmount(amount, usdtDecimals)
    } catch {
      setState('error')
      setError('Invalid amount')
      return
    }

    if (parsed <= 0n || parsed > usdtBalance) {
      setState('error')
      setError(parsed <= 0n ? 'Amount must be positive' : 'Amount exceeds balance')
      return
    }

    try {
      if (needsApproval) {
        setState('approving')
        const approveHash = await walletClient.writeContract({
          address: usdtAddress,
          abi: erc20Abi,
          functionName: 'approve',
          args: [vaultAddress, parsed],
        })
        await publicClient.waitForTransactionReceipt({ hash: approveHash })
      }

      setState('paying')
      const depositHash = await walletClient.writeContract({
        address: vaultAddress,
        abi: LearnTGVaultsAbi as any,
        functionName: 'deposit',
        args: [BigInt(courseId), parsed],
      })

      setState('confirming')
      const { status: txStatus } = await publicClient.waitForTransactionReceipt({ hash: depositHash })
      if (txStatus !== 'success') throw new Error('Transaction failed')

      // Backend callback (e.g. /api/add-donation)
      let increment: number | undefined
      if (onBackendCallback) {
        try {
          const csrfToken = await getCsrfToken()
          if (csrfToken && address) {
            const donationAmountUSD = safeParseFloat(amount)
            if (donationAmountUSD > 0) {
              const result = await onBackendCallback({
                walletAddress: address,
                token: csrfToken,
                donationAmountUSD,
                depositHash,
                courseId,
              })
              increment = result.increment
            }
          }
        } catch {
          const donationAmountUSD = safeParseFloat(amount)
          alert(lang === 'es'
            ? 'Gracias por tu donacion de ' + donationAmountUSD + ' USD! No pudimos actualizar tus puntos automaticamente. Toma un pantallazo y envialo a soporte.'
            : 'Thank you for your donation of ' + donationAmountUSD + ' USD! We could not update your points automatically. Please screenshot and contact support.')
        }
      }

      setState('success')
      onSuccess?.({ increment })
    } catch (e: any) {
      setState('error')
      setError(e?.message || 'Transaction failed')
    }
  }, [amount, usdtDecimals, address, walletClient, publicClient, vaultAddress, usdtAddress, courseId, allowance, usdtBalance, needsApproval, lang, onBackendCallback, onSuccess])

  return { state, error, needsApproval, execute, reset }
}
