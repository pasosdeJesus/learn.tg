'use client'

import { useState, useMemo } from 'react'

import { DonateModal } from './DonateModal'
import { Button } from '@/components/ui/button'
import { createComponentT } from '@/lib/hooks/useTranslation'

interface CourseDonationProps {
  lang: string
  vaultBalance: number
  courseId: number
  isLoggedIn: boolean
  onDonationSuccess: (courseId: number, data: { increment?: number }) => void
  showDonateButton?: boolean
}

export const CourseDonation = ({
  lang,
  vaultBalance,
  courseId,
  isLoggedIn,
  onDonationSuccess,
  showDonateButton = true,
}: CourseDonationProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const t = useMemo(() => createComponentT(lang, {
    en: {
      loginToDonate: 'You must be logged in to donate',
      scholarshipFund: 'Scholarship Fund',
      currentValue: 'Current value',
      donateToCourse: 'Donate to this course',
      donate: 'Donate',
      vaultBalance: 'Vault Balance:',
      usdt: 'USDT',
    },
    es: {
      loginToDonate: 'Debes iniciar sesi\u00f3n para donar',
      scholarshipFund: 'B\u00f3veda de Becas',
      currentValue: 'Valor actual',
      donateToCourse: 'Donar a este curso',
      donate: 'Donar',
      vaultBalance: 'Saldo de la Beca:',
      usdt: 'USDT',
    },
  }), [lang])

  const handleDonateClick = () => {
    if (!isLoggedIn) {
      alert(t('loginToDonate'))
      return
    }
    setIsModalOpen(true)
  }

  const handleDonationResult = (data: { increment?: number }) => {
    onDonationSuccess(courseId, data)
    setIsModalOpen(false)
  }

  return (
    <div className="p-4 rounded-2xl bg-white shadow-md text-gray-800">
      <h4 className="text-xs font-bold mb-2">
        {t('scholarshipFund')}
      </h4>
      <p className="mb-1 text-xs">{t('currentValue')}</p>
      <p className="text-lg font-bold mb-4">${vaultBalance.toFixed(2)}</p>

      {showDonateButton && (
        <Button onClick={handleDonateClick} className="w-full">
          {t('donateToCourse')}
        </Button>
      )}

      {isModalOpen && (
        <DonateModal
          lang={lang}
          courseId={courseId}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleDonationResult}
        />
      )}
    </div>
  )
}
