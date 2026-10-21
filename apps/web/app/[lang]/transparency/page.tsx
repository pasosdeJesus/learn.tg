'use client'

import { use } from 'react'
import Transparency from '@/components/Transparency'
import CampaignTransparency from '@/components/donations/CampaignTransparency'
import type { TransparencyResponse } from '@/types/leaderboard'

type PageProps = {
  params: Promise<{
    lang: string
  }>
}

export default function TransparencyPage({ params }: PageProps) {
  const parameters = use(params)
  const { lang } = parameters

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <Transparency lang={lang} />
      {/* https://github.com/pasosdeJesus/learn.tg/issues/223: explorador público de donaciones (detalle + comentario del donante) */}
      <p className="mt-4 text-sm">
        <a href={`/${lang}/donations`} className="text-blue-600 underline">
          {lang === 'es' ? 'Explorador de donaciones (detalle y comentarios)' : 'Donation explorer (detail and comments)'}
        </a>
      </p>
      {/* https://github.com/pasosdeJesus/learn.tg/issues/223: transparencia de la campaña Lensenia (ledger de donaciones) */}
      <div className="mt-8">
        <CampaignTransparency slug="lensenia" lang={lang} />
      </div>
    </div>
  )
}