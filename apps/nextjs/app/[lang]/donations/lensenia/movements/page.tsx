'use client'

// REQ/223: historial completo de movimientos de la billetera de la campaña
// Lensenia (todas las cadenas visibles por explorer público).

import { use } from 'react'
import Movements from '@/components/donations/Movements'

type PageProps = { params: Promise<{ lang: string }> }

export default function MovementsPage({ params }: PageProps) {
  const { lang } = use(params)
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-extrabold text-gray-800 mb-4">
          {lang === 'es' ? 'Historial de movimientos — Lensenia' : 'Movement history — Lensenia'}
        </h1>
        <Movements slug="lensenia" lang={lang} limit={300} showLink={false} />
      </div>
    </main>
  )
}
