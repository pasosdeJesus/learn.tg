'use client'

import { useState, useCallback } from 'react'
import { type Address } from 'viem'
import { erc20Abi, parseUserAmount, safeParseFloat } from '@learn-tg/rewards/src/lib/donate-utils'
import { getCsrfToken } from 'next-auth/react'
import axios from 'axios'
import { useToast } from '@pasosdejesus/m/shadcn-components/ui/use-toast'
import { logger } from '@pasosdejesus/m/debug'

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
    courseId: number | null
  }) => Promise<Record<string, any>>
  onSuccess?: (data: Record<string, any>) => void
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
    if (!walletClient || !publicClient || !address || !backendWalletAddress || !usdtAddress) {
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

    let usdtHash = ''
    let slearnHash = ''

    try {
      setState('paying')
      // [PayDiag] Version marker: confirms which bundle is running. If the
      // deployed UI shows "v2.1" in DevTools, the best-effort wait is live;
      // otherwise production was not rebuilt.
      console.log('[PayDiag] flow v2.1 start', { amount, slearnAmount, backend: backendWalletAddress?.slice(0, 10) })

      if (parsedUsdt > 0n) {
        usdtHash = await walletClient.writeContract({
          address: usdtAddress,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [backendWalletAddress, parsedUsdt],
        })
        console.log('[PayDiag] USDT broadcast', usdtHash)
      }

      if (parsedSlearn > 0n && slearnAddress) {
        slearnHash = await walletClient.writeContract({
          address: slearnAddress,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [backendWalletAddress, parsedSlearn],
        })
        console.log('[PayDiag] SLEARN broadcast', slearnHash)
      }

      // Best-effort confirmation: forno lags, so never abort here — the
      // backend re-verifies each hash with its own polling and rejects the
      // donation if a transaction genuinely never mined.
      for (const h of [usdtHash, slearnHash].filter(Boolean)) {
        try {
          await publicClient.waitForTransactionReceipt({ hash: h as Address, timeout: 120_000 })
          console.log('[PayDiag] receipt wait OK', h)
        } catch (e: any) {
          console.log('[PayDiag] receipt wait FAILED (continuing to backend):', h, e?.constructor?.name, e?.shortMessage || e?.message)
        }
      }

      setState('confirming')
      console.log('[PayDiag] calling backend with', { usdtHash: usdtHash || null, slearnHash: slearnHash || null })

      // Backend callback (e.g. /api/add-donation)
      let increment: number | undefined
      let backendResult: Record<string, any> = {}
      if (onBackendCallback) {
        try {
          const csrfToken = localStorage.getItem("learn.tg.authToken") || await getCsrfToken()
          if (csrfToken && address) {
            const donationAmountUSD = safeParseFloat(amount)
            const slearnDonationAmount = safeParseFloat(slearnAmount)
            if (donationAmountUSD > 0 || slearnDonationAmount > 0) {
              backendResult = await onBackendCallback({
                walletAddress: address,
                token: csrfToken,
                donationAmountUSD,
                slearnDonationAmount,
                usdtHash,
                slearnHash,
                courseId,
              })
              increment = backendResult.increment
            }
          }
        } catch (e: any) {
          const detail = e?.response?.data?.error || e?.message || String(e)
          console.log('[PayDiag] BACKEND FAILED', {
            status: e?.response?.status,
            dataError: e?.response?.data?.error,
            name: e?.constructor?.name,
            message: e?.message,
          })
          logger.error('[useContractPayment] Backend verification failed: ' + detail, 'Payment')
          setState('error')
          setError(detail)
          return
        }
      }

      setState('success')
      logger.info('[useContractPayment] Donation completed successfully', 'Donate')
      onSuccess?.({ increment, usdtHash, slearnHash, ...backendResult })
    } catch (e: any) {
      setState('error')
      console.log('[PayDiag] EXECUTE ERROR', {
        name: e?.constructor?.name,
        shortMessage: e?.shortMessage,
        message: e?.message,
        usdtHash: usdtHash || null,
        slearnHash: slearnHash || null,
      })
      logger.error('[useContractPayment] Transaction failed: ' + (e?.message || String(e)), 'Donate')
      setError(e?.message || 'Transaction failed')
    }
  }, [amount, slearnAmount, usdtDecimals, slearnDecimals, address, walletClient, publicClient, backendWalletAddress, usdtAddress, slearnAddress, courseId, usdtBalance, slearnBalance, lang, onBackendCallback, onSuccess])

  return { state, error, needsApproval, execute, reset }
}
