'use client'

import { useState, useMemo } from 'react'
import { PureAbility } from '@casl/ability'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { CountryFlag } from '@/components/CountryFlag'
import { formatLearningPoints, formatUSDT, formatCELO } from '@/lib/format'
import { ChevronUp, ChevronDown } from 'lucide-react'
import type { LeaderboardRow } from '@/types/leaderboard'

export type SortField = 'learningpoints' | 'scholarship_usdt' | 'ubi_celo' | 'donations_usdt'
export type SortOrder = 'asc' | 'desc'

interface LeaderboardTableProps {
  data: LeaderboardRow[]
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  sortBy: SortField
  sortOrder: SortOrder
  onSortChange: (sortBy: SortField, sortOrder: SortOrder) => void
  onPageChange?: (page: number) => void
  isLoading?: boolean
  lang?: string
  rules?: Array<{ action: string; subject: string }>
}

export function LeaderboardTable({
  data,
  pagination,
  sortBy,
  sortOrder,
  onSortChange,
  onPageChange,
  isLoading = false,
  lang = 'en',
  rules = [],
}: LeaderboardTableProps) {
  // Translation helper
  const t = (en: string, es: string) => (lang === 'es' ? es : en)

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      // Toggle order if same field
      onSortChange(field, sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // New field, default to descending (higher values first)
      onSortChange(field, 'desc')
    }
  }

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => {
    const isActive = sortBy === field
    return (
      <Button
        variant="ghost"
        onClick={() => handleSort(field)}
        className="h-auto p-0 font-medium hover:bg-transparent"
      >
        {children}
        {isActive && (
          <span className="ml-1">
            {sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        )}
      </Button>
    )
  }

  // Calculate rank based on position in data (considering pagination)
  const startRank = pagination ? (pagination.page - 1) * pagination.limit + 1 : 1

  const ability = useMemo(() => {
    return new PureAbility(rules as any)
  }, [rules])
  const canViewReligion = ability.can('view_religion', 'User')

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px] md:w-[80px]">
                <span className="md:hidden">#</span>
                <span className="hidden md:inline">{t('Rank', 'Posición')}</span>
              </TableHead>
              <TableHead className="min-w-[120px] md:min-w-[150px]">{t('User', 'Usuario')}</TableHead>
              <TableHead className="min-w-[70px] md:min-w-[120px]">
                <span className="md:hidden">{t('Ctry', 'Pais')}</span>
                <span className="hidden md:inline">{t('Country', 'País')}</span>
              </TableHead>
              {canViewReligion && (
                <TableHead>{t('Religion', 'Religión')}</TableHead>
              )}
              <TableHead className="text-right">
                <SortableHeader field="learningpoints">
                  <span className="md:hidden">{t('LP', 'PA')}</span>
                  <span className="hidden md:inline">{t('Learning Points', 'Puntos de Aprendizaje')}</span>
                </SortableHeader>
              </TableHead>
              <TableHead className="text-right">
                <SortableHeader field="scholarship_usdt">
                  {t('Scholarship (USDT)', 'Beca (USDT)')}
                </SortableHeader>
              </TableHead>
              <TableHead className="text-right">
                <SortableHeader field="ubi_celo">
                  {t('UBI (CELO)', 'UBI (CELO)')}
                </SortableHeader>
              </TableHead>
              <TableHead className="text-right">
                <SortableHeader field="donations_usdt">
                  {t('Donations (USDT)', 'Donaciones (USDT)')}
                </SortableHeader>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: pagination?.limit || 10 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  <TableCell><div className="h-4 bg-muted rounded w-8"></div></TableCell>
                  <TableCell><div className="h-4 bg-muted rounded w-24"></div></TableCell>
                  <TableCell><div className="h-4 bg-muted rounded w-16"></div></TableCell>
                  {canViewReligion && (
                    <TableCell><div className="h-4 bg-muted rounded w-16"></div></TableCell>
                  )}
                  <TableCell className="text-right"><div className="h-4 bg-muted rounded w-20 ml-auto"></div></TableCell>
                  <TableCell className="text-right"><div className="h-4 bg-muted rounded w-20 ml-auto"></div></TableCell>
                  <TableCell className="text-right"><div className="h-4 bg-muted rounded w-20 ml-auto"></div></TableCell>
                  <TableCell className="text-right"><div className="h-4 bg-muted rounded w-20 ml-auto"></div></TableCell>
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canViewReligion ? 8 : 7} className="text-center py-8 text-muted-foreground">
                  {t('No data available', 'No hay datos disponibles')}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, index) => (
                <TableRow key={row.usuario_id}>
                  <TableCell className="font-medium">{startRank + index}</TableCell>
                  <TableCell className="font-medium">{row.username}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <CountryFlag alfa2={row.pais_alfa2} />
                      <span className="text-sm text-muted-foreground hidden md:inline">
                        {row.pais_nombre || row.pais_alfa2 || t('Unknown', 'Desconocido')}
                      </span>
                    </div>
                  </TableCell>
                  {canViewReligion && (
                    <TableCell>{row.religion || '-'}</TableCell>
                  )}
                  <TableCell className="text-right font-mono">
                    {formatLearningPoints(row.learningpoints)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatUSDT(row.scholarship_usdt)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCELO(row.ubi_celo)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatUSDT(row.donations_usdt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && onPageChange && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {t(`Showing ${data.length} of ${pagination.total} users`, `Mostrando ${data.length} de ${pagination.total} usuarios`)}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1 || isLoading}
            >
              {t('Previous', 'Anterior')}
            </Button>
            <span className="text-sm">
              {t(`Page ${pagination.page} of ${pagination.totalPages}`, `Página ${pagination.page} de ${pagination.totalPages}`)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || isLoading}
            >
              {t('Next', 'Siguiente')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default LeaderboardTable