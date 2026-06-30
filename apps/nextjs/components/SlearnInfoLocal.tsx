'use client'

import { useState } from 'react'
import { Card, CardContent } from '@pasosdejesus/m/shadcn-components/ui/card'
import { Info, GraduationCap, BadgeCheck, ArrowRightLeft, ExternalLink } from 'lucide-react'
import { SLEARN_ADDRESSES, resolveNetwork } from '@pasosdejesus/m/blockchain/ecosystem-addresses'

const tS: Record<string, Record<string, string>> = {
  en: {
    title: '🎓 SLEARN — Learn & Earn',
    what: 'What is SLEARN?',
    description: 'You earn USDT + SLEARN scholarships by completing crosswords, and 10% back in SLEARN when you donate to courses.',
    step1Title: '1. Learn',
    step1Desc: 'Complete crosswords on learn.tg — get scholarships in USDT + SLEARN',
    step2Title: '2. Donate',
    step2Desc: 'Donate to a course vault — earn 10% back in SLEARN',
    step3Title: '3. Take courses',
    step3Desc: 'Use SLEARN to pay for premium courses on learn.tg',
    step4Title: '4. Redeem',
    step4Desc: 'Complete a premium course → get SBT → redeem SLEARN on stable-sl.pdJ.app for Leones (Sierra Leone) or USDT (worldwide)',
    contractLink: 'Verified contract',
    unverified: '🔐 Verify on learn.tg to unlock SLEARN and start taking courses.',
    learnTg: 'Take courses on learn.tg',
    stableSl: 'Redeem on stable-sl',
  },
  es: {
    title: '🎓 SLEARN — Aprende y Gana',
    what: '¿Qué es SLEARN?',
    description: 'Ganas becas en USDT + SLEARN al completar crucigramas, y 10% de vuelta en SLEARN al donar a cursos.',
    step1Title: '1. Aprendes',
    step1Desc: 'Completa crucigramas en learn.tg — recibe becas en USDT + SLEARN',
    step2Title: '2. Donas',
    step2Desc: 'Dona a la bóveda de un curso — recibe 10% de vuelta en SLEARN',
    step3Title: '3. Tomas cursos',
    step3Desc: 'Usa SLEARN para pagar cursos premium en learn.tg',
    step4Title: '4. Canjeas',
    step4Desc: 'Completa un curso premium → obtén SBT → canjea SLEARN en stable-sl.pdJ.app por Leones (Sierra Leona) o USDT (todo el mundo)',
    contractLink: 'Contrato verificado',
    unverified: '🔐 Verifícate en learn.tg para desbloquear SLEARN y comenzar a tomar cursos.',
    learnTg: 'Tomar cursos en learn.tg',
    stableSl: 'Canjear en stable-sl',
  },
}

interface SlearnInfoProps {
  locale?: string
  isVerified?: boolean
}

export function SlearnInfo({ locale = 'en', isVerified }: SlearnInfoProps) {
  const t = (k: string) => tS[locale]?.[k] || tS.en[k]
  const [open, setOpen] = useState(false)
  const network = resolveNetwork()
  const slearnAddr = SLEARN_ADDRESSES[network]
  const blockscoutBase = network === 'celo'
    ? 'https://celo.blockscout.com'
    : 'https://celo-sepolia.blockscout.com'
  const base = process.env.NEXT_PUBLIC_NETWORK === 'celo'
    ? 'https://learn.tg'
    : 'https://learn.tg:9001'

  return (
    <Card>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 transition-colors rounded-t-lg"
      >
        <span className="font-medium flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-purple-600" />
          {t('what')}
        </span>
        <Info className="h-4 w-4 text-gray-400" />
      </button>
      {open && (
        <CardContent className="pt-0 pb-4 space-y-3 text-sm">
          <p className="text-gray-600">{t('description')}</p>
          {!isVerified && (
            <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-800">
              {t('unverified')}
            </div>
          )}
          <div className="space-y-2">
            {[1, 2, 3, 4].map((step) => {
              const icons = [null, ArrowRightLeft, GraduationCap, BadgeCheck]
              const Icon = icons[step - 1]
              return (
                <div key={step} className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-xs flex items-center justify-center font-bold">
                    {step}
                  </span>
                  <div>
                    <strong>{t(`step${step}Title`)}</strong>
                    <span className="text-gray-500"> — {t(`step${step}Desc`)}</span>
                  </div>
                  {Icon && step > 1 && (
                    <Icon className="h-3 w-3 text-purple-400 flex-shrink-0 mt-0.5" />
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <a href={base} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-600 underline hover:text-purple-800">
              {t('learnTg')} →
            </a>
            <a href="https://stable-sl.pdJ.app" target="_blank" rel="noopener noreferrer" className="text-xs text-purple-600 underline hover:text-purple-800">
              {t('stableSl')} →
            </a>
            {slearnAddr && (
              <a href={`${blockscoutBase}/address/${slearnAddr}`} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 underline hover:text-gray-600 flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />
                {t('contractLink')}
              </a>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
