import { formatLearningPoints, formatUSDT, formatCELO } from '@/lib/format'

interface Totals {
  totalUsers: number
  totalLearningPoints: number
  totalScholarshipUSDT: number
  totalUBICELO: number
  totalDonationsUSDT: number
}

interface TotalsGridProps {
  totals: Totals
  t: (en: string, es: string) => string
}

export function TotalsGrid({ totals, t }: TotalsGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
      <div className="p-3 rounded-md border bg-muted/30">
        <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          {t('Total Users', 'Total Usuarios')}
        </div>
        <div className="text-lg font-bold">{totals.totalUsers}</div>
      </div>
      <div className="p-3 rounded-md border bg-muted/30">
        <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          {t('Total LP', 'Total PA')}
        </div>
        <div className="text-lg font-bold">{formatLearningPoints(totals.totalLearningPoints)}</div>
      </div>
      <div className="p-3 rounded-md border bg-muted/30">
        <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          {t('Scholarships', 'Becas')}
        </div>
        <div className="text-lg font-bold">{formatUSDT(totals.totalScholarshipUSDT)}</div>
      </div>
      <div className="p-3 rounded-md border bg-muted/30">
        <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          {t('UBI (CELO)', 'UBI (CELO)')}
        </div>
        <div className="text-lg font-bold">{formatCELO(totals.totalUBICELO)}</div>
      </div>
      <div className="p-3 rounded-md border bg-muted/30">
        <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          {t('Donations', 'Donaciones')}
        </div>
        <div className="text-lg font-bold">{formatUSDT(totals.totalDonationsUSDT)}</div>
      </div>
    </div>
  )
}