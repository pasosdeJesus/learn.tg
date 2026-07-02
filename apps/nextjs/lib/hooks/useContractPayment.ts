'use client'

import { useState, useCallback } from 'react'
import { type Address } from 'viem'
import { erc20Abi, parseUserAmount, safeParseFloat } from '@/lib/donate-utils'
import { getCsrfToken } from 'next-auth/react'
import axios from 'axios'
import { useToast } from '@pasosdejesus/m/shadcn-components/ui/use-toast'

export type PaymentState =
  | 'idle'
  | 'approving'
  | 'paying'
  | 'confirming'
  | 'success'
  | 'error'

export interface UseContractPaymentOptions {
  amount: string
  slearnAmount: string
  usdtDecimals: number
  slearnDecimals: number
  address: Address | undefined
  walletClient: any
  publicClient: any
  backendWalletAddress: Address | undefined
  usdtAddress: Address | undefined
  slearnAddress: Address | undefined
  courseId: number | null
  usdtBalance: bigint
  slearnBalance: bigint
  lang?: string
  onBackendCallback?: (params: {
    walletAddress: string
    token: string
    donationAmountUSD: number
    slearnDonationAmount: number
    usdtHash: string
    slearnHash: string
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
  slearnAmount,
  usdtDecimals,
  slearnDecimals,
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
  onSuccess,
}: UseContractPaymentOptions): UseContractPaymentReturn {
  const [state, setState] = useState<PaymentState>('idle')
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  // Transfers don't need approval — always false for new flow
  const needsApproval = false

  const reset = useCallback(() => {
    setState('idle')
    setError(null)
  }, [])

  const execute = useCallback(async () => {
    if (!walletClient || !publicClient || !address || !backendWalletAddress || !usdtAddress || !courseId) {
      setState('error')
      setError('Missing wallet or contract configuration')
      return
    }

    let parsedUsdt: bigint = 0n
    let parsedSlearn: bigint = 0n

    try {
      if (amount) parsedUsdt = parseUserAmount(amount, usdtDecimals)
      if (slearnAmount) parsedSlearn = parseUserAmount(slearnAmount, slearnDecimals)
    } catch {
      setState('error')
      setError('Invalid amount')
      return
    }

    if (parsedUsdt === 0n && parsedSlearn === 0n) {
      setState('error')
      setError('Amount must be positive')
      return
    }

    if (parsedUsdt > usdtBalance) {
      setState('error')
      setError('USDT amount exceeds balance')
      return
    }

    if (parsedSlearn > slearnBalance) {
      setState('error')
      setError('SLEARN amount exceeds balance')
      return
    }

    try {
      setState('paying')

      let usdtHash = ''
      let slearnHash = ''

      if (parsedUsdt > 0n) {
        usdtHash = await walletClient.writeContract({
          address: usdtAddress,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [backendWalletAddress, parsedUsdt],
        })
        await publicClient.waitForTransactionReceipt({ hash: usdtHash })
      }

      if (parsedSlearn > 0n && slearnAddress) {
        slearnHash = await walletClient.writeContract({
          address: slearnAddress,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [backendWalletAddress, parsedSlearn],
        })
        await publicClient.waitForTransactionReceipt({ hash: slearnHash })
      }

      setState('confirming')

      // Backend callback (e.g. /api/add-donation)
      let increment: number | undefined
      if (onBackendCallback) {
        try {
          const csrfToken = await getCsrfToken()
          if (csrfToken && address) {
            const donationAmountUSD = safeParseFloat(amount)
            const slearnDonationAmount = safeParseFloat(slearnAmount)
            if (donationAmountUSD > 0 || slearnDonationAmount > 0) {
              const result = await onBackendCallback({
                walletAddress: address,
                token: csrfToken,
                donationAmountUSD,
                slearnDonationAmount,
                usdtHash,
                slearnHash,
                courseId,
              })
              increment = result.increment
            }
          }
        } catch {
          const now = new Date().toISOString()
          const info = [
            `Time: ${now}`,
            usdtHash && `USDT tx: ${usdtHash}`,
            slearnHash && `SLEARN tx: ${slearnHash}`,
            `Course: ${courseId}`,
          ].filter(Boolean).join('\n')
          toast({ title: lang === 'es'
            ? `¡Gracias por tu donación! No pudimos procesarla automáticamente.\n\n${info}\n\nToma un pantallazo y envíalo a soporte.`
            : `Thank you for your donation! We could not process it automatically.\n\n${info}\n\nPlease screenshot and contact support.`, variant: 'destructive' })
        }
      }

      setState('success')
      onSuccess?.({ increment })
    } catch (e: any) {
      setState('error')
      setError(e?.message || 'Transaction failed')
    }
  }, [amount, slearnAmount, usdtDecimals, slearnDecimals, address, walletClient, publicClient, backendWalletAddress, usdtAddress, slearnAddress, courseId, usdtBalance, slearnBalance, lang, onBackendCallback, onSuccess])

  return { state, error, needsApproval, execute, reset }
}
