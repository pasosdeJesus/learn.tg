'use client'

import { useState, useEffect, use } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatLearningPoints, formatUSDT, formatCELO } from '@/lib/format'
import type { UserTransaction } from '@/lib/user-transactions'
import { ExternalLink, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

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

  const t = (en: string, es: string) => (lang === 'es' ? es : en)

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
    if (tx.crypto === 'learningpoints') return formatLearningPoints(tx.cantidad)
    if (tx.crypto === 'usdt') return formatUSDT(tx.cantidad)
    if (tx.crypto === 'celo') return formatCELO(tx.cantidad)
    return tx.cantidad.toString()
  }

  const getTypeName = (tipo: string) => {
    switch (tipo) {
      case 'scholarship': return t('Scholarship', 'Beca')
      case 'ubi-claim': return t('UBI Claim', 'Reclamo de UBI')
      case 'donation': return t('Donation', 'Donación')
      case 'learningpoint': return t('Learning Points', 'Puntos de Aprendizaje')
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
          {t('Transaction History for', 'Historial de Transacciones de')} {data.user.nombre || data.user.nusuario}
        </h1>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Date', 'Fecha')}</TableHead>
              <TableHead>{t('Type', 'Tipo')}</TableHead>
              <TableHead>{t('Asset', 'Moneda')}</TableHead>
              <TableHead className="text-right">{t('Amount', 'Cantidad')}</TableHead>
              <TableHead>{t('Description', 'Descripción')}</TableHead>
              <TableHead className="text-center">{t('Transaction', 'Transacción')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {t('No transactions found', 'No se encontraron transacciones')}
                </TableCell>
              </TableRow>
            ) : (
              data.transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(tx.fecha).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </TableCell>
                  <TableCell>{getTypeName(tx.tipo)}</TableCell>
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
