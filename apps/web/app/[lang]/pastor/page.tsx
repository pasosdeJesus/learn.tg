'use client'

import { use } from 'react'
import { PastorLanding } from '@/components/PastorLanding'

// R-#283: the pastor landing now lives at /{lang}/pastor (no longer under the GD
// paths). See `next.config.ts` redirects for the old /gdcluster/pastors and
// /redgd/pastores URLs.

type PageProps = { params: Promise<{ lang: string }> }

export default function PastorPage({ params }: PageProps) {
  const { lang } = use(params)
  return <PastorLanding lang={lang} />
}
