'use client'

import { useAccount } from 'wagmi'
import { useEffect, useState } from 'react'

export default function OKXNetworkCheck() {
  const { chainId, address, isConnected, connector } = useAccount()
  const [isOKXBrowser, setIsOKXBrowser] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    const win = window as any
    // Detectar OKX Wallet (navegador interno o extensión)
    let isOKX = false
    let detectionMethod = 'none'

    const ua = navigator.userAgent.toLowerCase()
    if (ua.includes('okx') || ua.includes('web3wallet')) {
      isOKX = true
      detectionMethod = 'userAgent'
    } else if (win.ethereum?.isOKX) {
      isOKX = true
      detectionMethod = 'window.ethereum.isOKX'
    } else if (win.ethereum?.isOkxWallet) {
      isOKX = true
      detectionMethod = 'window.ethereum.isOkxWallet'
    } else if (win.okxwallet) {
      isOKX = true
      detectionMethod = 'window.okxwallet'
    } else if (win.okex) {
      isOKX = true
      detectionMethod = 'window.okex'
    }

    console.log('OKX Detection:', { isOKX, detectionMethod })
    setIsOKXBrowser(isOKX)

    // Si es OKX y está en red incorrecta, mostrar ayuda
    if (isOKX && chainId && chainId !== 42220 && chainId !== 11142220) {
      console.log('OKX on wrong network:', chainId)
      console.log('User Agent:', navigator.userAgent)
      console.log('Address:', address)
      console.log('Detection method:', detectionMethod)
      setShowHelp(true)
    }
  }, [chainId, address])

  // Monitor wallet connection state
  useEffect(() => {
    console.log('=== WALLET CONNECTION STATE ===')
    console.log('Address:', address)
    console.log('Chain ID:', chainId)
    console.log('Is connected:', isConnected)
    console.log('Connector:', connector?.name)
    console.log('Connector ID:', connector?.id)
  }, [address, chainId, isConnected, connector])

  if (!showHelp) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-bold mb-3 text-red-600">
          ❌ Wrong Network Detected
        </h3>

        <div className="space-y-3 mb-4">
          <p className="text-gray-700">
            Your OKX Wallet is connected to the wrong network. Please switch to <strong>Celo</strong> network.
          </p>

          <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
            <h4 className="font-medium mb-1">How to switch in OKX:</h4>
            <ol className="list-decimal pl-5 space-y-1 text-sm">
              <li>Tap the network name at the top of OKX browser</li>
              <li>Select <strong>"Celo"</strong> from the list</li>
              <li>If Celo is not listed, tap "Add Network" and enter:</li>
            </ol>
            <div className="mt-2 text-xs bg-gray-100 p-2 rounded">
              <p>Network: <strong>Celo</strong></p>
              <p>RPC URL: <strong>https://forno.celo.org</strong></p>
              <p>Chain ID: <strong>42220</strong></p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              console.log('User clicked "I\'ve switched"')
              setShowHelp(false)
            }}
            className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            I've switched
          </button>
          <button
            onClick={() => {
              console.log('User clicked "Open in Chrome"')
              window.open(window.location.href, '_blank')
            }}
            className="flex-1 bg-gray-200 py-2 rounded hover:bg-gray-300"
          >
            Open in Chrome
          </button>
        </div>
      </div>
    </div>
  )
}