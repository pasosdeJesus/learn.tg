'use client'

import { use } from 'react'
import Leaderboard from '@/components/Leaderboard'
import type { LeaderboardResponse } from '@/types/leaderboard'

type PageProps = {
  params: Promise<{
    lang: string
  }>
}

export default function LeaderboardPage({ params }: PageProps) {
  const parameters = use(params)
  const { lang } = parameters

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <Leaderboard lang={lang} />
    </div>
  )
}