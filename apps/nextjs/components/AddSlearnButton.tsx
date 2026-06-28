'use client'

import { useState, useEffect } from 'react'
import { useWalletClient } from 'wagmi'
import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import { PlusCircle, CheckCircle, AlertCircle } from 'lucide-react'

interface AddSlearnButtonProps {
  lang: string
}

export function AddSlearnButton({ lang }: AddSlearnButtonProps) {
  const { data: walletClient } = useWalletClient()
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [isMiniPay, setIsMiniPay] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum?.isMiniPay) {
      setIsMiniPay(true)
    }
  }, [])

  const addToken = async () => {
    if (!walletClient) return
    setState('loading')
    try {
      const wasAdded = await (window as any).ethereum?.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: '0x27fd41Bea85C39254f2B12789eB37a1543152CC1',
            symbol: 'SLEARN',
            decimals: 2,
            image: 'https://learn.tg/img/slearn-icon.svg',
          },
        },
      })
      setState(wasAdded ? 'success' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="text-center">
      {isMiniPay ? (
        <span className="text-xs text-gray-400">
          {lang === 'es'
            ? 'SLEARN: 0x27fd41Bea85C39254f2B12789eB37a1543152CC1 — 2 decimales'
            : 'SLEARN: 0x27fd41Bea85C39254f2B12789eB37a1543152CC1 — 2 decimals'}
        </span>
      ) : state === 'success' ? (
        <span className="text-xs text-emerald-600 flex items-center justify-center gap-1">
          <CheckCircle className="h-3 w-3" />
          {lang === 'es' ? '¡SLEARN agregado a tu billetera!' : 'SLEARN added to your wallet!'}
        </span>
      ) : state === 'error' ? (
        <span className="text-xs text-red-500 flex items-center justify-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {lang === 'es'
            ? 'Agrega manualmente: 0x27fd…CC1, 2 decimales'
            : 'Add manually: 0x27fd…CC1, 2 decimals'}
        </span>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={addToken}
          disabled={!walletClient || state === 'loading'}
          className="text-xs gap-1"
        >
          <PlusCircle className="h-3 w-3" />
          {state === 'loading'
            ? (lang === 'es' ? 'Agregando…' : 'Adding…')
            : lang === 'es'
              ? 'Agregar SLEARN a mi billetera'
              : 'Add SLEARN to my wallet'}
        </Button>
      )}
    </div>
  )
}
