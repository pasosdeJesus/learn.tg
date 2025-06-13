/**
 * MIT License
 * Copyright (c) 2022 DevRel Team & Community
 *
 * Based on Celo Composer. See 
 */
'use client'

import {
  connectorsForWallets,
  lightTheme,
  RainbowKitProvider,
} from '@rainbow-me/rainbowkit';
import { injectedWallet } from '@rainbow-me/rainbowkit/wallets';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { celo, celoAlfajores } from 'wagmi/chains';

import '@rainbow-me/rainbowkit/styles.css';

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [injectedWallet],
    },
  ],
  {
    appName: process.env.NEXT_PUBLIC_APPNAME ?? "Learn Through Games",
    projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? '0123',
  }
);

const config = createConfig({
  connectors,
  chains: [celo, celoAlfajores],
  transports: {
    [celo.id]: http(),
    [celoAlfajores.id]: http(),
  },
});

const queryClient = new QueryClient();

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider 
          theme={lightTheme({
            accentColor: '#714ba6',
            accentColorForeground: 'white',
            borderRadius: 'small',
            fontStack: 'system',
            overlayBlur: 'none',
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
