'use client'

// Panel que reemplaza el contenido de los modales de donación/pago cuando el
// usuario no tiene CELO suficiente para pagar la comisión de la red (gas).
// Estado `no-gas` de useGasEstimation (gasState). Guía el pastor/estudiante
// al curso Web3 & UBI (Guía 2) donde aprende a reclamar CELO gratis (UBI).
import Link from 'next/link'
import type { GasDiagnostics } from '@/lib/hooks/useGasEstimation'

interface GasInsufficientPanelProps {
  lang: string
  onClose: () => void
  /** Diagnóstico detallado (solo se renderiza cuando se pasa; activar con ?diag=1) */
  diag?: GasDiagnostics | null
}

export function GasInsufficientPanel({ lang, onClose, diag }: GasInsufficientPanelProps) {
  const isEs = lang === 'es'
  // Guía de reclamar CELO (UBI) del curso Web3 & UBI: guide3 (EN) / guia3 (ES)
  const courseHref = isEs ? `/${lang}/web3-e-ibu/guia3` : `/${lang}/web3-and-ubi/guide3`

  return (
    <div className="text-center py-4">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-lg leading-none"
        aria-label={isEs ? 'Cerrar' : 'Close'}
      >
        ✕
      </button>

      <div className="text-4xl mb-3">⛽</div>
      <h2 className="text-xl font-semibold mb-3">
        {isEs
          ? 'Se necesita CELO para completar esta transacción'
          : 'CELO is needed to complete this transaction'}
      </h2>

      <p className="text-sm text-gray-700 mb-2">
        {isEs
          ? 'Para pagar la comisión de la red (gas), necesitas tener un poco de CELO en tu wallet.'
          : 'To pay the network fee (gas), you need a little CELO in your wallet.'}
      </p>

      <p className="text-sm text-gray-700 mb-4">
        {isEs
          ? 'No te preocupes — puedes obtener CELO gratis todos los días en learn.tg.'
          : 'Do not worry — you can get free CELO every day on learn.tg.'}
      </p>

      <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-left mb-5">
        📘{' '}
        {isEs
          ? 'Aprende a reclamar CELO gratis en el curso Web3 & UBI (Reclama tu IBU diario)'
          : 'Learn how to claim free CELO in the Web3 & UBI course (Claiming CELO)'}
      </div>

      <div className="flex gap-3 justify-center">
        <Link
          href={courseHref}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {isEs ? 'Ir al curso Web3 & UBI' : 'Go to the Web3 & UBI course'}
        </Link>
        <button
          onClick={onClose}
          className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {isEs ? 'Cerrar' : 'Close'}
        </button>
      </div>

      <p className="text-xs text-gray-500 mt-5">
        💡 {isEs ? 'Después de reclamar CELO, vuelve a intentarlo.' : 'After claiming CELO, come back and try again.'}
      </p>

      {diag && (
        <details className="mt-5 rounded bg-gray-100 border border-gray-300 p-3 text-left text-xs">
          <summary className="cursor-pointer font-semibold text-gray-700">
            {isEs ? 'Diagnóstico de gas' : 'Gas diagnostics'}
          </summary>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono">
            <Dt>{isEs ? 'Estado' : 'State'}</Dt><Dd>{diag.state}{diag.reason ? ` (${diag.reason})` : ''}</Dd>
            <Dt>{isEs ? 'Billetera' : 'Wallet'}</Dt><Dd className="break-all">{diag.address || '-'}</Dd>
            <Dt>Chain app</Dt><Dd>{diag.appChainId}</Dd>
            <Dt>Chain wallet</Dt><Dd>{diag.walletChainId ?? '-'}</Dd>
            <Dt>RPC</Dt><Dd className="break-all">{diag.rpcUrl || '-'}</Dd>
            <Dt>CELO balance</Dt><Dd>{diag.celoBalanceCELO ?? '-'}</Dd>
            <Dt>Gas price</Dt><Dd>{diag.gasPriceGwei ? `${diag.gasPriceGwei} gwei` : '-'}</Dd>
            <Dt>Gas USDT</Dt><Dd>{diag.usdtTransferGas ?? '-'}</Dd>
            <Dt>Gas SLEARN</Dt><Dd>{diag.slearnTransferGas ?? '-'}</Dd>
            <Dt>{isEs ? 'Gas total' : 'Total gas'}</Dt><Dd>{diag.totalGas ?? '-'}</Dd>
            <Dt>{isEs ? 'Coste estimado' : 'Est. cost'}</Dt><Dd>{diag.estimatedCostCELO ? `${diag.estimatedCostCELO} CELO` : '-'}</Dd>
            <Dt>{isEs ? 'Suficiente' : 'Sufficient'}</Dt><Dd>{diag.sufficient === undefined ? '-' : String(diag.sufficient)}</Dd>
            {diag.error && (<><Dt>{isEs ? 'Error' : 'Error'}</Dt><Dd className="break-all text-red-600">{diag.error}</Dd></>)}
          </dl>
        </details>
      )}
    </div>
  )
}

function Dt({ children }: { children: React.ReactNode }) {
  return <dt className="text-gray-500">{children}</dt>
}

function Dd({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <dd className={`text-gray-800 ${className}`}>{children}</dd>
}
