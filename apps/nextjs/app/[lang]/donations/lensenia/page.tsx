'use client'

// REQ #223 — página de donación de la campaña Lensenia Water Well.
// Estructura (REQ/223 §3.1): header, progreso, breakdown multi-cadena,
// donar, claim Learn.tg-UBI + GoodDollar (guía 3) y otras formas de donar.

import { use, useState, useMemo } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'
import BalanceDisplay from '@/components/donations/BalanceDisplay'
import DonateButton from '@/components/donations/DonateButton'
import Movements from '@/components/donations/Movements'
import GoodDollarClaimButton from '@/components/GoodDollarClaimButton'
import CeloUbiButton from '@/components/CeloUbiButton'

type PageProps = { params: Promise<{ lang: string }> }

export default function Page({ params }: PageProps) {
  const { lang } = use(params)
  const [refreshTick, setRefreshTick] = useState(0)

  const t = useMemo(() => createComponentT(lang, {
    en: {
      title: 'Lensenia Water Well',
      subtitle: 'Help build a water well for Lensenia, Sierra Leone',
      description:
        'Clean water transforms a community. Your donation goes straight to the Lensenia water well project: 100% reaches the campaign unless you choose to share a percentage with pdJ. You may also receive 10% back as SLEARN cashback.',
      donateSection: 'Donate',
      claimTitle: 'Claim daily and give it to the well',
      claimText:
        'Claim the daily Learn.tg-UBI in CELO (verified profile, score 50+) and the free GoodDollar G$ with your wallet, then send them to the campaign. Guide 3 of the Web3 & UBI course explains the whole flow.',
      guideLink: 'Guide: claiming Learn.tg-UBI and GoodDollar, and giving to the well',
      otherWays: 'Other ways to donate',
      otherWaysText: 'Bank transfers, Binance, Giveth and off-chain XAUT are handled on the project page at pasosdejesus.org.',
      otherWaysLink: 'pasosdejesus.org/lensenia',
      success: 'Donation completed',
    },
    es: {
      title: 'Pozo de Agua Lensenia',
      subtitle: 'Ayuda a construir un pozo de agua para Lensenia, Sierra Leona',
      description:
        'El agua limpia transforma una comunidad. Tu donación va directo al proyecto del pozo de Lensenia: 100% llega a la campaña salvo que elijas compartir un porcentaje con pdJ. También puedes recibir 10% de vuelta como cashback en SLEARN.',
      donateSection: 'Donar',
      claimTitle: 'Reclama a diario y dónalo al pozo',
      claimText:
        'Reclama el Learn.tg-UBI diario en CELO (perfil verificado, score 50+) y los G$ gratis de GoodDollar con tu billetera, y envíalos a la campaña. La guía 3 del curso Web3 & UBI explica todo el flujo.',
      guideLink: 'Guía: reclamar Learn.tg-UBI y GoodDollar, y darlos al pozo',
      otherWays: 'Otras formas de donar',
      otherWaysText:
        'Transferencias bancarias, Binance, Giveth y XAUT off-chain se gestionan en la página del proyecto en pasosdejesus.org.',
      otherWaysLink: 'pasosdejesus.org/lensenia',
      success: 'Donación completada',
    },
  }), [lang])

  const guidePath = lang === 'es' ? 'web3-e-ibu/guia3' : 'web3-and-ubi/guide3'

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-800">{t('title')}</h1>
          <p className="mt-2 text-lg text-gray-600">{t('subtitle')}</p>
          <p className="mt-4 text-sm text-gray-500">{t('description')}</p>
        </header>

        <BalanceDisplay key={refreshTick} slug="lensenia" lang={lang} />

        <section className="mt-6 rounded-2xl bg-white shadow-md p-4 text-gray-800">
          <h2 className="text-sm font-bold mb-3">{t('donateSection')}</h2>
          <DonateButton slug="lensenia" lang={lang} onDonationSuccess={() => setRefreshTick((n) => n + 1)} />
        </section>

        <section className="mt-6 rounded-2xl bg-white shadow-md p-4 text-gray-800">
          <h2 className="text-sm font-bold mb-2">{t('claimTitle')}</h2>
          <p className="text-xs text-gray-500 mb-3">{t('claimText')}</p>
          <div className="flex flex-col gap-3">
            <CeloUbiButton lang={lang} />
            <GoodDollarClaimButton lang={lang} />
          </div>
          <a href={`/${lang}/${guidePath}`} className="inline-block mt-3 text-xs text-blue-600 underline">
            {t('guideLink')}
          </a>
        </section>

        <section className="mt-6 rounded-2xl bg-white shadow-md p-4 text-gray-800">
          <h2 className="text-sm font-bold mb-2">{t('otherWays')}</h2>
          <p className="text-xs text-gray-500 mb-2">{t('otherWaysText')}</p>
          <a
            href="https://pasosdejesus.org/lensenia"
            target="_blank" rel="noopener noreferrer"
            className="text-sm text-blue-600 underline break-all"
          >
            {t('otherWaysLink')}
          </a>
        </section>

        {/* REQ/223: movimientos recientes de la billetera de la campaña.
            key={refreshTick}: al cerrar el modal de éxito de una donación se
            remonta (refetch) igual que BalanceDisplay. */}
        <div className="mt-6">
          <Movements key={refreshTick} slug="lensenia" lang={lang} limit={8} showLink />
        </div>
      </div>
    </main>
  )
}
