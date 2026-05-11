'use client'

import { useMemo } from 'react'
import { createComponentT } from '@/lib/hooks/useTranslation'
import type { PaymentState } from '@/lib/hooks/useContractPayment'

export interface TransactionStatusProps {
  state: PaymentState
  error: string | null
  explorerUrl?: string | null
  onRetry?: () => void
  onDismiss?: () => void
  lang?: string
}

export function TransactionStatus({
  state,
  error,
  explorerUrl,
  onRetry,
  onDismiss,
  lang = 'en',
}: TransactionStatusProps) {
  const t = useMemo(() => createComponentT(lang, {
    en: {
      approving: 'Approving USDT...',
      paying: 'Submitting transaction...',
      confirming: 'Confirming transaction...',
      success: 'Transaction successful!',
      errorLabel: 'Error',
      retry: 'Retry',
      dismiss: 'Dismiss',
      viewExplorer: 'View on explorer',
    },
    es: {
      approving: 'Aprobando USDT...',
      paying: 'Enviando transacción...',
      confirming: 'Confirmando transacción...',
      success: '¡Transacción exitosa!',
      errorLabel: 'Error',
      retry: 'Reintentar',
      dismiss: 'Descartar',
      viewExplorer: 'Ver en explorador',
    },
  }), [lang])

  if (state === 'idle') return null

  const statusColors: Record<PaymentState, string> = {
    idle: '',
    approving: 'bg-blue-50 border-blue-200 text-blue-700',
    paying: 'bg-blue-50 border-blue-200 text-blue-700',
    confirming: 'bg-blue-50 border-blue-200 text-blue-700',
    success: 'bg-green-50 border-green-200 text-green-700',
    error: 'bg-red-50 border-red-200 text-red-700',
  }

  const statusText: Record<PaymentState, string> = {
    idle: '',
    approving: t('approving'),
    paying: t('paying'),
    confirming: t('confirming'),
    success: t('success'),
    error: error || t('errorLabel'),
  }

  return (
    <div className={`mt-3 text-xs rounded p-3 border ${statusColors[state]}`}>
      <div className="flex items-center justify-between">
        <span>
          {state === 'approving' || state === 'paying' || state === 'confirming' ? (
            <span className="inline-block w-3 h-3 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : null}
          {statusText[state]}
        </span>
        {state === 'error' && onRetry && (
          <button onClick={onRetry} className="underline ml-2">{t('retry')}</button>
        )}
      </div>
      {state === 'success' && explorerUrl && (
        <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="underline block mt-1">
          {t('viewExplorer')}
        </a>
      )}
      {state === 'error' && onDismiss && (
        <button onClick={onDismiss} className="underline block mt-1">{t('dismiss')}</button>
      )}
    </div>
  )
}

export default TransactionStatus
