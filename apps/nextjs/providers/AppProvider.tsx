/**
 * MIT License
 * Copyright (c) 2022 DevRel Team & Community
 *
 * Based on Celo Composer. See
 */
'use client'

import { SessionProvider } from 'next-auth/react'
import { useEffect } from 'react'
import OKXNetworkCheck from '@/components/OKXNetworkCheck'
import WalletDetectionHint from '@/components/WalletDetectionHint'
import { isOKXWallet } from '@/lib/okx-switch'

interface ExtendedWindow extends Window {
  ethereum?: {
    selectedAddress?: string
    isOKX?: boolean
    isOkxWallet?: boolean
    isMetaMask?: boolean
    isRabby?: boolean
    isTrust?: boolean
    isCoinbaseWallet?: boolean
    chainId?: string
    networkVersion?: string
  }
  okxwallet?: any
  okex?: any
}
import { AppProps } from 'next/app'
import {
  connectorsForWallets,
  lightTheme,
  RainbowKitProvider,
} from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import {
  injectedWallet,
  metaMaskWallet,
  okxWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets'
import {
  RainbowKitSiweNextAuthProvider,
  type GetSiweMessageOptions,
} from '@rainbow-me/rainbowkit-siwe-next-auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createConfig, http, useAccount, WagmiProvider } from 'wagmi'
import { celo, celoSepolia } from 'wagmi/chains'
import { Address } from 'viem'
import { IS_PRODUCTION } from '@/lib/config';

interface RainbowKitProviderProps {
  children: React.ReactNode
  autoConnect?: boolean
}

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [okxWallet, walletConnectWallet, metaMaskWallet, injectedWallet],
    },
  ],
  {
    appName: process.env.NEXT_PUBLIC_APPNAME ?? 'Learn Through Games',
    projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? '0123',
  },
)

const config = createConfig({
  connectors,
  chains: [celo, celoSepolia],
  transports: {
    [celo.id]: http(),
    [celoSepolia.id]: http(),
  },
})

const getSiweMessageOptions: GetSiweMessageOptions = () => {
  // Check if ethereum is available in window object
  const selectedAddress =
    (typeof window !== 'undefined' &&
      (window as ExtendedWindow).ethereum?.selectedAddress) ||
    '0x0'
  const msg = {
    statement:
      'Sign in to Learn through games. '
  }
  console.log('OJO msg=', msg)
  return msg
}

const queryClient = new QueryClient()

// Taking ideas of
// https://github.com/0xRowdy/nextauth-siwe-route-handlers/blob/main/src/app/providers/web3-providers.tsx
export function AppProvider(props: RainbowKitProviderProps) {
  useEffect(() => {
    const win = window as ExtendedWindow
    console.log('=== OKX DIAGNOSTIC INFO ===')
    console.log('1. User Agent:', navigator.userAgent)
    console.log('2. Is OKX Browser?', navigator.userAgent.toLowerCase().includes('okx'))
    console.log('3. Ethereum provider:', win.ethereum ? 'Present' : 'Absent')
    console.log('4. window.okxwallet:', win.okxwallet ? 'Present' : 'Absent')
    console.log('5. window.okex:', win.okex ? 'Present' : 'Absent')
    if (win.ethereum) {
      console.log('6. Provider details:', {
        isOKX: win.ethereum.isOKX,
        isOkxWallet: win.ethereum.isOkxWallet,
        isMetaMask: win.ethereum.isMetaMask,
        isRabby: win.ethereum.isRabby,
        isTrust: win.ethereum.isTrust,
        isCoinbaseWallet: win.ethereum.isCoinbaseWallet,
        chainId: win.ethereum.chainId,
        networkVersion: win.ethereum.networkVersion
      })
      // Log all enumerable properties of window.ethereum
      try {
        const props = Object.keys(win.ethereum)
        console.log('7. window.ethereum properties:', props)
      } catch (e) {
        console.log('7. Failed to enumerate window.ethereum properties:', e)
      }
    }
    console.log('8. isOKXWallet() result:', isOKXWallet())
    console.log('9. Configured wallet types:', ['okxWallet', 'walletConnectWallet', 'metaMaskWallet', 'injectedWallet'])
    console.log('10. Connectors count:', connectors.length)
  }, [])


  return (
    <WagmiProvider config={config}>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <RainbowKitSiweNextAuthProvider
            getSiweMessageOptions={getSiweMessageOptions}
          >
            <RainbowKitProvider
              initialChain={IS_PRODUCTION ? celo : celoSepolia}
              theme={lightTheme({
                accentColor: '#714ba6',
                accentColorForeground: 'white',
                borderRadius: 'small',
                fontStack: 'system',
                overlayBlur: 'none',
              })}
            >
              {props.children}
              <OKXNetworkCheck />
              <WalletDetectionHint />
            </RainbowKitProvider>
          </RainbowKitSiweNextAuthProvider>
        </QueryClientProvider>
      </SessionProvider>
    </WagmiProvider>
  )
}
