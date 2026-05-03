'use client'

import { useAccount } from 'wagmi'
import { useEffect, useState } from 'react'
import { switchToCelo, isOKXWallet } from '@/lib/okx-switch'
import { IS_PRODUCTION } from '@/lib/config'

export default function OKXNetworkCheck() {
  const { chainId, address, isConnected, connector } = useAccount()
  const [isOKXBrowser, setIsOKXBrowser] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [copied, setCopied] = useState(false)
  const [hasTriedSwitch, setHasTriedSwitch] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)

  // Network configuration based on environment
  const targetChainId = IS_PRODUCTION ? '42220' : '11142220'
  const targetChainName = IS_PRODUCTION ? 'Celo' : 'Celo Sepolia'
  const targetRpcUrl = IS_PRODUCTION ? 'https://forno.celo.org' : 'https://forno.celo-sepolia.celo-testnet.org'
  const targetExplorerUrl = IS_PRODUCTION ? 'https://celoscan.io' : 'https://celo-sepolia.blockscout.com/'
  const chainlistUrl = IS_PRODUCTION ? 'https://chainlist.org/chain/42220' : 'https://chainlist.org/chain/11142220'

  useEffect(() => {
    const isOKX = isOKXWallet()
    setIsOKXBrowser(isOKX)

    if (isOKX && chainId && chainId !== 42220 && chainId !== 11142220) {
      if (!hasTriedSwitch) {
        setHasTriedSwitch(true)
        setIsSwitching(true)

        switchToCelo()
          .then((success) => {
            if (success) {
              setShowHelp(false)
            } else {
              setShowHelp(true)
            }
          })
          .catch(() => {
            setShowHelp(true)
          })
          .finally(() => {
            setIsSwitching(false)
          })
      } else {
        setShowHelp(true)
      }
    } else {
      setShowHelp(false)
    }
  }, [chainId, address, hasTriedSwitch])

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  const copyDiagnostics = async () => {
    const diagnostics = {
      userAgent: navigator.userAgent,
      chainId,
      address,
      isConnected,
      connector: connector?.name,
      connectorId: connector?.id,
      detectionMethod: isOKXBrowser ? 'OKX detected' : 'Not OKX',
      timestamp: new Date().toISOString()
    }
    const text = `OKX Diagnostics:\n${JSON.stringify(diagnostics, null, 2)}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch (err) {
      console.error('Failed to copy diagnostics:', err)
    }
  }

  if (!showHelp) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-bold mb-3 text-red-600">
          ❌ Wrong Network Detected
        </h3>

        <div className="space-y-3 mb-4">
          <p className="text-gray-700">
            Your OKX Wallet is connected to the wrong network. We tried to switch automatically but failed.
            {hasTriedSwitch ? ' ' : ' '}Please switch to <strong>{IS_PRODUCTION ? 'Celo' : 'Celo Sepolia'}</strong> network manually or try auto-switch again.
          </p>

          <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
            <h4 className="font-medium mb-1">How to switch in OKX:</h4>
            <ol className="list-decimal pl-5 space-y-1 text-sm">
              <li>Tap the network name at the top of OKX browser</li>
              <li>Select <strong>"{targetChainName}"</strong> from the list</li>
              <li>If {targetChainName} is not listed, tap "Add Network" and enter:</li>
            </ol>
            <div className="mt-2 text-xs bg-gray-100 p-2 rounded">
              <p>Network: <strong>{targetChainName}</strong></p>
              <p>RPC URL: <strong>{targetRpcUrl}</strong></p>
              <p>Chain ID: <strong>{targetChainId}</strong></p>
            </div>
            <div className="mt-3 pt-3 border-t border-yellow-200">
              <p className="text-sm text-gray-700 mb-1">
                If OKX doesn't allow adding the network, use Chainlist:
              </p>
              <a
                href={chainlistUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                🔗 Add {targetChainName} via Chainlist
              </a>
              <p className="text-xs text-gray-500 mt-1">
                Chainlist will automatically add the correct network to your wallet.
              </p>
            </div>
          </div>
        </div>

        {isSwitching ? (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Switching to Celo network automatically...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsSwitching(true)
                  switchToCelo()
                    .then((success) => {
                      if (success) {
                        setShowHelp(false)
                      }
                    })
                    .catch(() => {
                      console.error('Retry failed')
                    })
                    .finally(() => {
                      setIsSwitching(false)
                    })
                }}
                className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700"
              >
                🔄 Try Auto-Switch
              </button>
              <button
                onClick={() => {
                  setShowHelp(false)
                }}
                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              >
                I've switched
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  window.open(window.location.href, '_blank')
                }}
                className="flex-1 bg-gray-200 py-2 rounded hover:bg-gray-300"
              >
                Open in Chrome
              </button>
              <button
                onClick={copyDiagnostics}
                className="flex-1 bg-purple-600 text-white py-2 rounded hover:bg-purple-700"
              >
                {copied ? 'Copied!' : 'Copy Diagnostics'}
              </button>
            </div>
          </div>
        )}
        {copied && (
          <p className="mt-3 text-sm text-green-600 text-center">
            Diagnostics copied to clipboard. You can paste them in support chats.
          </p>
        )}
      </div>
    </div>
  )
}
