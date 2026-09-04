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
      {/* REQ/223: transparencia de la campaña Lensenia (ledger de donaciones) */}
      <div className="mt-8">
        <CampaignTransparency slug="lensenia" lang={lang} />
      </div>
    </div>
  )
}