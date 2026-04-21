'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { TransparencyTable } from '@/components/TransparencyTable'
import type { CountryTotals, TransparencyResponse } from '@/types/leaderboard'

interface TransparencyProps {
  initialData?: TransparencyResponse
  lang?: string
}

export function Transparency({ initialData, lang = 'en' }: TransparencyProps) {
  const { data: session } = useSession()
  // State for data and loading
  const [data, setData] = useState<CountryTotals[]>(initialData?.data || [])
  const [totals, setTotals] = useState(initialData?.totals)
  const [rules, setRules] = useState<Array<{ action: string; subject: string }>>(initialData?.rules || [])
  const [isLoading, setIsLoading] = useState(false)

  // Translation helper
  const t = (en: string, es: string) => (lang === 'es' ? es : en)

  // Fetch transparency data
  const fetchTransparency = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()

      if (session?.address) {
        params.append('wallet', session.address)
        const token = (session as any).user?.token || (session as any).token
        if (token) {
          params.append('token', token)
        }
      }

      const response = await fetch(`/api/transparency?${params.toString()}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const result: TransparencyResponse = await response.json()

      setData(result.data)
      setTotals(result.totals)
      setRules(result.rules || [])
    } catch (error) {
      console.error('Failed to fetch transparency data:', error)
      // Keep existing data
    } finally {
      setIsLoading(false)
    }
  }, [session])

  // Initial fetch if no initialData provided
  useEffect(() => {
    if (!initialData) {
      fetchTransparency()
    }
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t('Transparency', 'Transparencia')}
        </h1>
        <p className="text-muted-foreground">
          {t('Platform totals by country', 'Totales de la plataforma por país')}
        </p>
      </div>

      <TransparencyTable
        data={data}
        isLoading={isLoading}
        lang={lang}
        rules={rules}
        totals={totals}
      />

      <div className="text-sm text-muted-foreground">
        <p>
          <strong>{t('Learning Points', 'Puntos de Aprendizaje')}</strong>{' '}
          {t('are earned by completing crosswords and giving donations.', 'se ganan completando crucigramas y haciendo donaciones.')}
        </p>
        <p>
          <strong>{t('Scholarship (USDT)', 'Beca (USDT)')}</strong>{' '}
          {t('is received as educational grants.', 'se recibe como becas educativas.')}
        </p>
        <p>
          <strong>{t('UBI (CELO)', 'UBI (CELO)')}</strong>{' '}
          {t('is received through universal basic income claims.', 'se recibe a través de reclamos de ingreso básico universal.')}
        </p>
        <p>
          <strong>{t('Donations (USDT)', 'Donaciones (USDT)')}</strong>{' '}
          {t('are contributions made to support the platform.', 'son contribuciones hechas para apoyar la plataforma.')}
        </p>
      </div>
    </div>
  )
}

export default Transparency