'use client'

import { useState } from 'react'
import * as Toast from '@radix-ui/react-toast'

import { Button } from '@/components/ui/button'
import DonateModal from '@/components/DonateModal'

interface CourseDonationProps {
  lang: string
  vaultBalance: number
  courseId: number
  isLoggedIn: boolean
  onDonationSuccess: (courseId: number) => void
}

export const CourseDonation = ({
  lang,
  vaultBalance,
  courseId,
  isLoggedIn,
  onDonationSuccess,
}: CourseDonationProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isToastOpen, setIsToastOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  const handleDonateClick = () => {
    setIsModalOpen(true)
  }

  const handleDonationResult = () => {
    onDonationSuccess(courseId)
    setToastMsg(lang === 'es' ? 'Donación exitosa' : 'Donation successful')
    setIsToastOpen(true)
  }

  return (
    <Toast.Provider swipeDirection="right">
      <div className="p-4 bg-green-100 flex items-center gap-3 justify-between">
        <div className="text-sm text-green-800">
          {lang === 'es' ? 'En bóveda: ' : 'In vault: '}${vaultBalance} USDT
        </div>
        {isLoggedIn && (
          <Button onClick={handleDonateClick} size="sm">
            {lang === 'es' ? 'Donar a este curso' : 'Donate for this course'}
          </Button>
        )}
      </div>

      <DonateModal
        courseId={courseId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleDonationResult}
        lang={lang}
      />

      <Toast.Root
        open={isToastOpen}
        onOpenChange={setIsToastOpen}
        duration={5000}
        className="bg-primary text-primary-foreground rounded px-4 py-3 text-sm shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      >
        <Toast.Title className="font-bold">{toastMsg}</Toast.Title>
        <Toast.Close className="absolute top-1 right-2 text-primary-foreground/70 hover:text-primary-foreground">
          ×
        </Toast.Close>
      </Toast.Root>
      <Toast.Viewport className="fixed bottom-4 right-4 flex flex-col gap-2 w-96 max-w-[100vw] outline-none z-[60]" />
    </Toast.Provider>
  )
}
