'use client'

// Botón "Donate now" de campaña (REQ/223 §3.1): abre el DonateModal existente
// con destino `campaign-donation` (slug) y las opciones por donación
// (cashback SLEARN on/off + % a pdJ, REQ/223 §3.3).

import { useState, useMemo } from 'react'
import { DonateModal } from '../DonateModal'
import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import { useToast } from '@pasosdejesus/m/shadcn-components/ui/use-toast'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'

interface DonateButtonProps {
  slug?: string
  lang?: string
  onDonationSuccess?: () => void
}

export default function DonateButton({ slug = 'lensenia', lang = 'en', onDonationSuccess }: DonateButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { toast } = useToast()
  const { isAuthenticated } = useAuthAddress()

  const t = useMemo(() => createComponentT(lang, {
    en: {
      donate: 'Donate now',
      connectPrompt: 'Connect your wallet to donate',
    },
    es: {
      donate: 'Donar ahora',
      connectPrompt: 'Conecta tu billetera para donar',
    },
  }), [lang])

  const handleClick = () => {
    if (!isAuthenticated) {
      toast({ title: t('connectPrompt'), variant: 'destructive' })
      return
    }
    setIsModalOpen(true)
  }

  const handleSuccess = () => {
    setIsModalOpen(false)
    onDonationSuccess?.()
  }

  return (
    <>
      <Button onClick={handleClick} className="w-full" size="lg">
        {t('donate')}
      </Button>
      {isModalOpen && (
        <DonateModal
          lang={lang}
          target={{ type: 'campaign-donation', slug }}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  )
}
