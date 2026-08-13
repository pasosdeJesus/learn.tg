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
import { SLEARN_DISCOUNT } from '@/lib/premium-pricing'

const SLEARN_DECIMALS = 2
const SLEARN_RATE = 22

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
      slearnToUse: 'SLEARN to use',
      usdtToPay: 'USDT to pay',
      yourBalance: 'Balance',
      purchase: 'Purchase',
      cancel: 'Cancel',
      processing: 'Processing...',
      success: 'Course purchased',
      missingConfig: 'Missing wallet or contract configuration',
    },
    es: {
      title: 'Comprar curso',
      priceUsdt: 'Precio (USDT)',
      priceSlearn: 'O paga en SLEARN (10% descuento)',
      slearnToUse: 'SLEARN a usar',
      usdtToPay: 'USDT a pagar',
      yourBalance: 'Saldo',
      purchase: 'Comprar',
      cancel: 'Cancelar',
      processing: 'Procesando...',
      success: 'Curso comprado',
      missingConfig: 'Falta configuración de wallet o contrato',
    },
  }), [lang])

  const { address: rawAddress } = useAuthAddress()
  const address = rawAddress as Address | undefined
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { toast } = useToast()

  const [priceUSDT, setPriceUSDT] = useState<number | null>(null)
  const [priceSLEARN, setPriceSLEARN] = useState<number | null>(null)
  const [slearnAmount, setSlearnAmount] = useState('0')
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
        const token = await getCsrfToken()
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

  // USDT required for the chosen SLEARN amount (mixed payment formula)
  const slearnChosen = Number(slearnAmount) || 0
  const usdtNeeded = priceUSDT != null
    ? Math.max(0, priceUSDT - slearnChosen / (SLEARN_RATE * (1 - SLEARN_DISCOUNT)))
    : 0
  const usdtAmount = usdtNeeded.toFixed(2)

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

  if (!isOpen) return null

  const busy = paymentState === 'paying' || paymentState === 'confirming'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg text-gray-800">
        <h3 className="text-lg font-bold mb-4">{t('title')}</h3>

        <div className="space-y-3 text-sm">
          <p>
            {t('priceUsdt')}: <strong>{priceUSDT != null ? `$${priceUSDT.toFixed(2)}` : '…'}</strong>
          </p>
          <p>
            {t('priceSlearn')}: <strong>{priceSLEARN != null ? `${priceSLEARN.toFixed(2)} SLEARN` : '…'}</strong>
          </p>

          <div>
            <label className="block mb-1">
              {t('slearnToUse')} ({t('yourBalance')}: {formatDisplay(slearnBalance, SLEARN_DECIMALS)} SLEARN)
            </label>
            <input
              type="number"
              min="0"
              max={priceSLEARN ?? 0}
              step="0.01"
              value={slearnAmount}
              onChange={(e) => setSlearnAmount(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>

          <p>
            {t('usdtToPay')}: <strong>${usdtAmount}</strong>{' '}
            ({t('yourBalance')}: {formatDisplay(usdtBalance, +(process.env.NEXT_PUBLIC_USDT_DECIMALS || 6))} USDT)
          </p>
        </div>

        {paymentError && <p className="mt-3 text-sm text-red-600">{paymentError}</p>}

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
