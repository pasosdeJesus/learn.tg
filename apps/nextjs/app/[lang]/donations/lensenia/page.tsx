'use client'

// REQ #223 — página de donación de la campaña Lensenia Water Well.
// Estructura (REQ/223 §3.1): header, progreso, breakdown multi-cadena,
// donar, GoodDollar claim (guía 3) y otras formas de donar.

import { use, useState, useMemo } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'
import BalanceDisplay from '@/components/donations/BalanceDisplay'
import DonateButton from '@/components/donations/DonateButton'
import Movements from '@/components/donations/Movements'
import GoodDollarClaimButton from '@/components/GoodDollarClaimButton'

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
      goodDollarTitle: 'Claim GoodDollar daily and give it to the well',
      goodDollarText:
        'Claim free G$ every day with the GoodDollar wallet (guide 3 of the Web3 & UBI course explains how) and send it to the campaign.',
      guideLink: 'Guide: claiming GoodDollar and giving to the well',
      otherWays: 'Other ways to donate',
      otherWaysText:
        'Bank transfers, Binance and Giveth: see the project page below. Off-chain XAUT (gold) donations are also described there — contact the team through pasosdejesus.org to arrange delivery instructions.',
      otherWaysLink: 'pasosdejesus.org/lensenia',
      success: 'Donation completed',
    },
    es: {
      title: 'Pozo de Agua Lensenia',
      subtitle: 'Ayuda a construir un pozo de agua para Lensenia, Sierra Leona',
      description:
        'El agua limpia transforma una comunidad. Tu donación va directo al proyecto del pozo de Lensenia: 100% llega a la campaña salvo que elijas compartir un porcentaje con pdJ. También puedes recibir 10% de vuelta como cashback en SLEARN.',
      donateSection: 'Donar',
      goodDollarTitle: 'Reclama GoodDollar a diario y dónalo al pozo',
      goodDollarText:
        'Reclama G$ gratis cada día con la billetera GoodDollar (la guía 3 del curso Web3 & UBI explica cómo) y envíalo a la campaña.',
      guideLink: 'Guía: reclamar GoodDollar y darlo al pozo',
      otherWays: 'Otras formas de donar',
      otherWaysText:
        'Transferencias bancarias, Binance y Giveth: ver la página del proyecto abajo. Las donaciones de XAUT (oro) off-chain también se describen allí — contacta al equipo vía pasosdejesus.org para las instrucciones de entrega.',
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
          <h2 className="text-sm font-bold mb-2">{t('goodDollarTitle')}</h2>
          <p className="text-xs text-gray-500 mb-3">{t('goodDollarText')}</p>
          <GoodDollarClaimButton lang={lang} />
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

        {/* REQ/223: movimientos recientes de la billetera de la campaña */}
        <div className="mt-6">
          <Movements slug="lensenia" lang={lang} limit={8} showLink />
        </div>
      </div>
    </main>
  )
}
