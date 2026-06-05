'use client'

import { useMemo } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { useState, useEffect, use } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@pasosdejesus/m/shadcn-components/ui/table'
import { formatLearningPoints, formatUSDT, formatCELO } from '@/lib/format'
import type { UserTransaction } from '@/lib/user-transactions'
import { ExternalLink, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'

type PageProps = {
  params: Promise<{
    lang: string
    id: string
  }>
}

interface TransactionsData {
  user: {
    nusuario: string
    nombre: string | null
  }
  transactions: UserTransaction[]
}

export default function UserTransactionsPage({ params }: PageProps) {
  const { lang, id } = use(params)
  const [data, setData] = useState<TransactionsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const t = useMemo(() => createComponentT(lang, {
    en: { txHistory: 'Transaction History', type: 'Type', amount: 'Amount', date: 'Date', hash: 'Hash', noTx: 'No transactions found', scholarship: 'Scholarship', donation: 'Donation', claim: 'Claim', ubiClaim: 'UBI Claim', learningPoints: 'Learning Points', points: 'Points' },
    es: { txHistory: 'Historial de Transacciones', type: 'Tipo', amount: 'Cantidad', date: 'Fecha', hash: 'Hash', noTx: 'No se encontraron transacciones', scholarship: 'Beca', donation: 'Donacion', claim: 'Reclamo', ubiClaim: 'Reclamo UBI', learningPoints: 'Puntos de Aprendizaje', points: 'Puntos' },
  }), [lang])

  useEffect(() => {
    async function fetchTransactions() {
      try {
        const response = await fetch(`/api/user-transactions/${id}`)
        if (!response.ok) {
          throw new Error('Failed to fetch transactions')
        }
        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchTransactions()
  }, [id])

  const getExplorerUrl = (hash: string) => {
    return `https://celoscan.io/tx/${hash}`
  }

  const formatAmount = (tx: UserTransaction) => {
    if (tx.crypto === 'learningpoints') return formatLearningPoints(tx.amount)
    if (tx.crypto === 'slearn') return `${Number(tx.amount).toFixed(2)} SLEARN`
    if (tx.crypto === 'usdt') return formatUSDT(tx.amount)
    if (tx.crypto === 'celo') return formatCELO(tx.amount)
    return tx.amount.toString()
  }

  const getTypeName = (tipo: string) => {
    switch (tipo) {
      case 'scholarship': return t('scholarship')
      case 'ubi-claim': return t('UBI Claim', 'Reclamo de UBI')
      case 'donation': return t('donation')
      case 'conversion': return lang === 'es' ? 'Conversión LP→SLEARN' : 'LP→SLEARN Conversion'
      case 'learningpoint': return t('learningPoints')
      default: return tipo
    }
  }

  if (isLoading) {
    return <div className="container mx-auto py-8 px-4 text-center">{t('Loading...', 'Cargando...')}</div>
  }

  if (error || !data) {
    return (
      <div className="container mx-auto py-8 px-4 text-center text-red-500">
        {error || t('User not found', 'Usuario no encontrado')}
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/${lang}/leaderboard`}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">
          {t('Transaction History for', 'Historial de Transacciones de')} {data.user.nusuario}
        </h1>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('date')}</TableHead>
              <TableHead>{t('type')}</TableHead>
              <TableHead>{t('Asset', 'Moneda')}</TableHead>
              <TableHead className="text-right">{t('amount')}</TableHead>
              <TableHead>{t('Description', 'Descripción')}</TableHead>
              <TableHead className="text-center">{t('Transaction', 'Transacción')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {t('noTx')}
                </TableCell>
              </TableRow>
            ) : (
              data.transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(tx.date).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </TableCell>
                  <TableCell>{getTypeName(tx.type)}</TableCell>
                  <TableCell className="uppercase">{tx.crypto}</TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatAmount(tx)}
                  </TableCell>
                  <TableCell className="max-w-xs truncate" title={tx.descripcion || ''}>
                    {tx.descripcion || '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    {tx.hash ? (
                      <a
                        href={getExplorerUrl(tx.hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-primary hover:underline gap-1"
                      >
                        <span className="hidden md:inline text-xs font-mono">{tx.hash.substring(0, 6)}...{tx.hash.substring(tx.hash.length - 4)}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
