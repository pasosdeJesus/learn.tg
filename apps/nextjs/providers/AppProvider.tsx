/**
 * MIT License
 * Copyright (c) 2022 DevRel Team & Community
 *
 * Based on Celo Composer. See
 */
'use client'

import { SessionProvider } from 'next-auth/react'

interface ExtendedWindow extends Window {
  ethereum?: {
    selectedAddress?: string
  }
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
  chains:
    process.env.NEXT_PUBLIC_AUTH_URL == 'https://learn.tg'
      ? [celo]
      : [celoSepolia],
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
  return (
    <WagmiProvider config={config}>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <RainbowKitSiweNextAuthProvider
            getSiweMessageOptions={getSiweMessageOptions}
          >
            <RainbowKitProvider
              theme={lightTheme({
                accentColor: '#714ba6',
                accentColorForeground: 'white',
                borderRadius: 'small',
                fontStack: 'system',
                overlayBlur: 'none',
              })}
            >
              {props.children}
            </RainbowKitProvider>
          </RainbowKitSiweNextAuthProvider>
        </QueryClientProvider>
      </SessionProvider>
    </WagmiProvider>
  )
}
