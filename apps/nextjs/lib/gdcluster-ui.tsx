// Adapter del core → componentes UI del motor `gdcluster` (https://gitlab.com/pasosdeJesus/m/-/work_items/35 §13.3, D2
// para componentes): el motor nunca importa hooks ni componentes del core;
// el host inyecta las deps reales (hooks, libs, DonateModal) y la app
// re-exporta estos wrappers desde las páginas.
'use client'

import { RankingClient } from '@learn-tg/gdcluster/components/RankingClient'
import { ClusterPage } from '@learn-tg/gdcluster/components/ClusterPage'
import ReferralsPage from '@learn-tg/gdcluster/components/ReferralsPage'

import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { adminAuthParams } from '@/lib/admin-fetch'
import { useSession, getCsrfToken } from 'next-auth/react'
import DonateModal from '@/components/DonateModal'
import { Button } from '@/components/ui/button'
import { ReferralQr } from '@/components/ReferralQr'

export const RankingClientHost = (p: { lang: string }) => (
  <RankingClient {...p} deps={{ adminAuthParams, DonateModal }} />
)

export const ClusterPageHost = (p: { lang: string; id: string }) => (
  <ClusterPage
    {...p}
    deps={{ useAuthAddress, useSession, getCsrfToken, Button }}
  />
)

export const ReferralsPageHost = (p: { params: Promise<{ lang: string }> }) => (
  <ReferralsPage {...p} deps={{ useAuthAddress, QrCode: ReferralQr }} />
)
