'use client'

import { useAccount } from 'wagmi'
import { useEffect, useState } from 'react'
import { isOKXWallet } from '@/lib/okx-switch'

export default function WalletDetectionHint() {
  const { isConnected, address, connector } = useAccount()
  const [showHint, setShowHint] = useState(false)
  const [detectionDetails, setDetectionDetails] = useState<{
    isOKX: boolean
    hasEthereum: boolean
    hasOKXWallet: boolean
    userAgent: string
  } | null>(null)

  useEffect(() => {
    // Solo ejecutar en cliente
    if (typeof window === 'undefined') return

    const isOKX = isOKXWallet()
    const hasEthereum = !!(window as any).ethereum
    const hasOKXWallet = !!(window as any).okxwallet
    const userAgent = navigator.userAgent

    const details = {
      isOKX,
      hasEthereum,
      hasOKXWallet,
      userAgent
    }

    setDetectionDetails(details)

    console.log('=== WALLET DETECTION HINT DEBUG ===')
    console.log('Details:', details)
    console.log('Is connected:', isConnected)
    console.log('Address:', address)
    console.log('Connector:', connector?.name)

    // Mostrar hint si:
    // 1. No está conectado
    // 2. Es OKX (detectado por user agent o provider)
    // 3. No hay provider ethereum detectado (o hay pero no conecta)
    if (!isConnected && (isOKX || userAgent.toLowerCase().includes('okx'))) {
      console.log('Showing wallet detection hint for OKX user')
      setShowHint(true)
    } else {
      setShowHint(false)
    }
  }, [isConnected, address, connector])

  if (!showHint || isConnected) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:bottom-4 md:max-w-md z-40">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 shadow-lg">
        <h4 className="font-medium text-amber-800 mb-2 flex items-center gap-2">
          <span>🔍</span> Wallet Detection Issue
        </h4>
        <p className="text-amber-700 text-sm mb-3">
          It looks like you're using OKX Web3 Wallet, but we couldn't detect a wallet provider.
          This may prevent the "Connect Wallet" button from appearing.
        </p>

        <div className="text-xs text-amber-600 bg-amber-100 p-3 rounded mb-3">
          <p className="font-medium mb-1">Detection details:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>User Agent contains "OKX": {detectionDetails?.userAgent.toLowerCase().includes('okx') ? '✅ Yes' : '❌ No'}</li>
            <li>OKX Wallet detected: {detectionDetails?.isOKX ? '✅ Yes' : '❌ No'}</li>
            <li>Ethereum provider: {detectionDetails?.hasEthereum ? '✅ Present' : '❌ Absent'}</li>
            <li>OKX Wallet object: {detectionDetails?.hasOKXWallet ? '✅ Present' : '❌ Absent'}</li>
          </ul>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-amber-800">Possible solutions:</p>
          <ol className="list-decimal pl-5 text-xs text-amber-700 space-y-1">
            <li>Ensure OKX Web3 Wallet is installed and enabled</li>
            <li>Try refreshing the page</li>
            <li>If using OKX mobile browser, ensure "Web3 Mode" is enabled in settings</li>
            <li>Try opening in Chrome with the OKX Wallet extension</li>
            <li>As a last resort, try using WalletConnect via the "Open in Chrome" option</li>
          </ol>
        </div>

        <div className="flex gap-2 mt-3">
          <button
            onClick={() => {
              console.log('User clicked "Refresh"')
              window.location.reload()
            }}
            className="flex-1 bg-amber-600 text-white py-2 rounded hover:bg-amber-700 text-sm"
          >
            Refresh Page
          </button>
          <button
            onClick={() => {
              console.log('User clicked "Open in Chrome"')
              window.open(window.location.href, '_blank')
            }}
            className="flex-1 bg-gray-200 py-2 rounded hover:bg-gray-300 text-sm"
          >
            Open in Chrome
          </button>
          <button
            onClick={() => setShowHint(false)}
            className="px-3 py-2 text-amber-700 hover:text-amber-900 text-sm"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}