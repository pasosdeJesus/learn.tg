'use client'

import { useState, useMemo } from 'react'
import { Ability } from '@casl/ability'
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
import type { CountryTotals } from '@/types/leaderboard'

export type SortField = 'totalUsers' | 'totalLearningPoints' | 'totalScholarshipUSDT' | 'totalUBICELO' | 'totalDonationsUSDT'
export type SortOrder = 'asc' | 'desc'

interface TransparencyTableProps {
  data: CountryTotals[]
  isLoading?: boolean
  lang?: string
  rules?: Array<{ action: string; subject: string }>
  totals?: {
    totalUsers: number
    totalLearningPoints: number
    totalScholarshipUSDT: number
    totalUBICELO: number
    totalDonationsUSDT: number
  }
}

export function TransparencyTable({
  data,
  isLoading = false,
  lang = 'en',
  rules = [],
  totals,
}: TransparencyTableProps) {
  // Translation helper
  const t = (en: string, es: string) => (lang === 'es' ? es : en)

  // Sorting state
  const [sortBy, setSortBy] = useState<SortField>('totalUsers')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      // Toggle order if same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // New field, default to descending (higher values first)
      setSortBy(field)
      setSortOrder('desc')
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

  // Sort data
  const sortedData = useMemo(() => {
    const sorted = [...data]
    sorted.sort((a, b) => {
      let aVal: number, bVal: number
      switch (sortBy) {
        case 'totalUsers':
          aVal = a.totalUsers
          bVal = b.totalUsers
          break
        case 'totalLearningPoints':
          aVal = a.totalLearningPoints
          bVal = b.totalLearningPoints
          break
        case 'totalScholarshipUSDT':
          aVal = a.totalScholarshipUSDT
          bVal = b.totalScholarshipUSDT
          break
        case 'totalUBICELO':
          aVal = a.totalUBICELO
          bVal = b.totalUBICELO
          break
        case 'totalDonationsUSDT':
          aVal = a.totalDonationsUSDT
          bVal = b.totalDonationsUSDT
          break
        default:
          aVal = 0
          bVal = 0
      }
      const multiplier = sortOrder === 'asc' ? 1 : -1
      return (aVal - bVal) * multiplier
    })
    return sorted
  }, [data, sortBy, sortOrder])

  const ability = useMemo(() => {
    return new Ability(rules as any)
  }, [rules])
  const canViewReligion = ability.can('view_religion', 'User')

  return (
    <div className="space-y-4">
      {!isLoading && totals && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-3 rounded-md border bg-muted/30">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t('Total Users', 'Total Usuarios')}</div>
            <div className="text-lg font-bold">{totals.totalUsers}</div>
          </div>
          <div className="p-3 rounded-md border bg-muted/30">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t('Total LP', 'Total PA')}</div>
            <div className="text-lg font-bold">{formatLearningPoints(totals.totalLearningPoints)}</div>
          </div>
          <div className="p-3 rounded-md border bg-muted/30">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t('Scholarships', 'Becas')}</div>
            <div className="text-lg font-bold">{formatUSDT(totals.totalScholarshipUSDT)}</div>
          </div>
          <div className="p-3 rounded-md border bg-muted/30">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t('UBI (CELO)', 'UBI (CELO)')}</div>
            <div className="text-lg font-bold">{formatCELO(totals.totalUBICELO)}</div>
          </div>
          <div className="p-3 rounded-md border bg-muted/30">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t('Donations', 'Donaciones')}</div>
            <div className="text-lg font-bold">{formatUSDT(totals.totalDonationsUSDT)}</div>
          </div>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[120px] md:min-w-[150px]">{t('Country', 'País')}</TableHead>
              {canViewReligion && (
                <TableHead>{t('Religion', 'Religión')}</TableHead>
              )}
              <TableHead className="text-right">
                <SortableHeader field="totalUsers">
                  {t('Users', 'Usuarios')}
                </SortableHeader>
              </TableHead>
              <TableHead className="text-right">
                <SortableHeader field="totalLearningPoints">
                  <span className="md:hidden">{t('LP', 'PA')}</span>
                  <span className="hidden md:inline">{t('Learning Points', 'Puntos de Aprendizaje')}</span>
                </SortableHeader>
              </TableHead>
              <TableHead className="text-right">
                <SortableHeader field="totalScholarshipUSDT">
                  {t('Scholarship (USDT)', 'Beca (USDT)')}
                </SortableHeader>
              </TableHead>
              <TableHead className="text-right">
                <SortableHeader field="totalUBICELO">
                  {t('UBI (CELO)', 'UBI (CELO)')}
                </SortableHeader>
              </TableHead>
              <TableHead className="text-right">
                <SortableHeader field="totalDonationsUSDT">
                  {t('Donations (USDT)', 'Donaciones (USDT)')}
                </SortableHeader>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: 10 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  <TableCell><div className="h-4 bg-muted rounded w-24"></div></TableCell>
                  {canViewReligion && (
                    <TableCell><div className="h-4 bg-muted rounded w-16"></div></TableCell>
                  )}
                  <TableCell className="text-right"><div className="h-4 bg-muted rounded w-20 ml-auto"></div></TableCell>
                  <TableCell className="text-right"><div className="h-4 bg-muted rounded w-20 ml-auto"></div></TableCell>
                  <TableCell className="text-right"><div className="h-4 bg-muted rounded w-20 ml-auto"></div></TableCell>
                  <TableCell className="text-right"><div className="h-4 bg-muted rounded w-20 ml-auto"></div></TableCell>
                  <TableCell className="text-right"><div className="h-4 bg-muted rounded w-20 ml-auto"></div></TableCell>
                </TableRow>
              ))
            ) : sortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canViewReligion ? 7 : 6} className="text-center py-8 text-muted-foreground">
                  {t('No data available', 'No hay datos disponibles')}
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((row) => (
                <TableRow key={row.alfa2}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <CountryFlag alfa2={row.alfa2} />
                      <span className="font-medium">{row.nombre}</span>
                    </div>
                  </TableCell>
                  {canViewReligion && (
                    <TableCell>-</TableCell>
                  )}
                  <TableCell className="text-right font-mono">
                    {row.totalUsers}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatLearningPoints(row.totalLearningPoints)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatUSDT(row.totalScholarshipUSDT)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCELO(row.totalUBICELO)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatUSDT(row.totalDonationsUSDT)}
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

export default TransparencyTable