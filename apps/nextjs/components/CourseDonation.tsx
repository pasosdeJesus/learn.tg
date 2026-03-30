'use client'

import { useState } from 'react'

import { DonateModal } from './DonateModal'
import { Button } from '@/components/ui/button'

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

  const handleDonateClick = () => {
    if (!isLoggedIn) {
      alert(
        lang === 'es'
          ? 'Debes iniciar sesión para donar'
          : 'You must be logged in to donate',
      )
      return
    }
    setIsModalOpen(true)
  }

  const handleDonationResult = (data: { increment?: number }) => {
    onDonationSuccess(courseId, data)
    setIsModalOpen(false)
  }

  const t = (en: string, es: string) => (lang === 'es' ? es : en)

  return (
    <div className="p-4 rounded-2xl bg-white shadow-md text-gray-800">
      <h4 className="text-xs font-bold mb-2">
        {t('Scholarship Fund', 'Beca de Aprendizaje')}
      </h4>
      <p className="mb-1 text-xs">{t('Current value', 'Valor actual')}</p>
      <p className="text-lg font-bold mb-4">${vaultBalance.toFixed(2)}</p>

      {showDonateButton && (
        <Button onClick={handleDonateClick} className="w-full">
          {t('Donate to this course', 'Donar a este curso')}
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
