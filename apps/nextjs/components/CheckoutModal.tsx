'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import axios from 'axios'
import { getCsrfToken } from 'next-auth/react'
import { type Address } from 'viem'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { usePublicClient, useWalletClient } from '@/lib/hooks/useWallet'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { useContractPayment } from '@/lib/hooks/useContractPayment'
import { erc20Abi, formatDisplay } from '@/lib/donate-utils'
import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import { useToast } from '@pasosdejesus/m/shadcn-components/ui/use-toast'

const SLEARN_DECIMALS = 2

interface CheckoutModalProps {
  courseId: number
  lang: string
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function CheckoutModal({ courseId, lang, isOpen, onClose, onSuccess }: CheckoutModalProps) {
  const t = useMemo(() => createComponentT(lang, {
    en: {
      title: 'Purchase course',
      priceUsdt: 'Price (USDT)',
      priceSlearn: 'Or pay in SLEARN (10% off)',
      split: 'How would you like to pay?',
      slearnPct: 'SLEARN',
      usdtPct: 'USDT',
      yourBalance: 'Balance',
      purchase: 'Purchase',
      cancel: 'Cancel',
      processing: 'Processing...',
      success: 'Course purchased',
      copyError: 'Copy error',
      error: 'Error',
    },
    es: {
      title: 'Comprar curso',
      priceUsdt: 'Precio (USDT)',
      priceSlearn: 'O paga en SLEARN (10% descuento)',
      split: '¿Cómo quieres pagar?',
      slearnPct: 'SLEARN',
      usdtPct: 'USDT',
      yourBalance: 'Saldo',
      purchase: 'Comprar',
      cancel: 'Cancelar',
      processing: 'Procesando...',
      success: 'Curso comprado',
      copyError: 'Copiar error',
      error: 'Error',
    },
  }), [lang])

  const { address: rawAddress } = useAuthAddress()
  const address = rawAddress as Address | undefined
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { toast } = useToast()

  const [priceUSDT, setPriceUSDT] = useState<number | null>(null)
  const [priceSLEARN, setPriceSLEARN] = useState<number | null>(null)
  const [slearnPct, setSlearnPct] = useState(0) // 0-100, % paid with SLEARN
  const [usdtBalance, setUsdtBalance] = useState(0n)
  const [slearnBalance, setSlearnBalance] = useState(0n)

  const usdtAddress = process.env.NEXT_PUBLIC_USDT_ADDRESS as Address | undefined
  const slearnAddress = process.env.NEXT_PUBLIC_SLEARN_ADDRESS as Address | undefined
  const backendWalletAddress = process.env.NEXT_PUBLIC_ADDRESS as Address | undefined

  // Fetch price + balances when opened
  useEffect(() => {
    if (!isOpen || !address || !publicClient || !usdtAddress) return
    let cancelled = false
    ;(async () => {
      try {
        const token = localStorage.getItem('learn.tg.authToken') || await getCsrfToken()
        const url = `/api/courses/premium/price?courseId=${courseId}&walletAddress=${address}&token=${token}`
        const res = await axios.get(url)
        if (cancelled) return
        setPriceUSDT(Number(res.data.priceUSDT))
        setPriceSLEARN(Number(res.data.priceSLEARN))

        const [usdtBal, slearnBal] = await Promise.all([
          publicClient.readContract({ address: usdtAddress, abi: erc20Abi, functionName: 'balanceOf', args: [address] }) as Promise<bigint>,
          slearnAddress
            ? publicClient.readContract({ address: slearnAddress, abi: erc20Abi, functionName: 'balanceOf', args: [address] }) as Promise<bigint>
            : Promise.resolve(0n),
        ])
        if (!cancelled) {
          setUsdtBalance(usdtBal)
          setSlearnBalance(slearnBal)
        }
      } catch {
        if (!cancelled) {
          toast({ title: lang === 'es' ? 'No se pudo cargar el precio' : 'Could not load price', variant: 'destructive' })
        }
      }
    })()
    return () => { cancelled = true }
  }, [isOpen, address, publicClient, usdtAddress, slearnAddress, courseId, lang, toast])

  // Mixed payment split: slearnPct% with SLEARN, the rest with USDT.
  //   slearnAmount = priceSLEARN * pct/100  (already has the 10% discount)
  //   usdtAmount   = priceUSDT * (100-pct)/100
  const slearnAmount = priceSLEARN != null ? ((priceSLEARN * slearnPct) / 100).toFixed(2) : '0'
  const usdtAmount = priceUSDT != null ? ((priceUSDT * (100 - slearnPct)) / 100).toFixed(2) : '0'
  const usdtPct = 100 - slearnPct

  const handleSuccess = useCallback(() => {
    toast({ title: t('success') })
    onSuccess?.()
    onClose()
  }, [t, onSuccess, onClose, toast])

  const onBackendCallback = useCallback(async (params: {
    walletAddress: string
    token: string
    courseId: number | null
    usdtHash: string
    slearnHash: string
  }) => {
    const { data } = await axios.post('/api/courses/premium/purchase', {
      walletAddress: params.walletAddress,
      token: params.token,
      courseId: params.courseId,
      usdtHash: params.usdtHash || undefined,
      slearnHash: params.slearnHash || undefined,
    })
    return { increment: 0, ...data }
  }, [])

  const {
    state: paymentState,
    error: paymentError,
    execute: executePayment,
  } = useContractPayment({
    amount: usdtAmount,
    slearnAmount,
    usdtDecimals: +(process.env.NEXT_PUBLIC_USDT_DECIMALS || 6),
    slearnDecimals: SLEARN_DECIMALS,
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
    onSuccess: handleSuccess,
  })

  const copyError = useCallback(async () => {
    if (paymentError) {
      try {
        await navigator.clipboard.writeText(paymentError)
        toast({ title: lang === 'es' ? 'Error copiado' : 'Error copied' })
      } catch {
        /* ignore */
      }
    }
  }, [paymentError, lang, toast])

  if (!isOpen) return null

  const busy = paymentState === 'paying' || paymentState === 'confirming'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg text-gray-800">
        <h3 className="text-lg font-bold mb-4">{t('title')}</h3>

        <div className="space-y-4 text-sm">
          <p>
            {t('priceUsdt')}: <strong>{priceUSDT != null ? `$${priceUSDT.toFixed(2)}` : '…'}</strong>
          </p>
          <p>
            {t('priceSlearn')}: <strong>{priceSLEARN != null ? `${priceSLEARN.toFixed(2)} SLEARN` : '…'}</strong>
          </p>

          <div>
            <label className="block mb-1 font-medium">{t('split')}</label>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={slearnPct}
              onChange={(e) => setSlearnPct(Number(e.target.value))}
              className="w-full"
            />
            <div className="mt-2 grid grid-cols-2 gap-4">
              <div className="rounded border border-gray-200 p-3">
                <div className="text-xs text-gray-500">{t('usdtPct')} ({usdtPct}%)</div>
                <div className="text-base font-semibold">${usdtAmount}</div>
                <div className="text-xs text-gray-500">{t('yourBalance')}: {formatDisplay(usdtBalance, +(process.env.NEXT_PUBLIC_USDT_DECIMALS || 6))} USDT</div>
              </div>
              <div className="rounded border border-gray-200 p-3">
                <div className="text-xs text-gray-500">{t('slearnPct')} ({slearnPct}%)</div>
                <div className="text-base font-semibold">{slearnAmount} SLEARN</div>
                <div className="text-xs text-gray-500">{t('yourBalance')}: {formatDisplay(slearnBalance, SLEARN_DECIMALS)} SLEARN</div>
              </div>
            </div>
          </div>
        </div>

        {paymentError && (
          <div className="mt-4 rounded border border-red-300 bg-red-50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-red-700">{t('error')}</span>
              <button type="button" onClick={copyError} className="text-xs font-medium text-red-700 underline">
                {t('copyError')}
              </button>
            </div>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-red-800">{paymentError}</pre>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>{t('cancel')}</Button>
          <Button onClick={executePayment} disabled={busy || priceUSDT == null}>
            {busy ? t('processing') : t('purchase')}
          </Button>
        </div>
      </div>
    </div>
  )
}
