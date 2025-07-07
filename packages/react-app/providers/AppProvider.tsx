/**
 * MIT License
 * Copyright (c) 2022 DevRel Team & Community
 *
 * Based on Celo Composer. See 
 */
'use client'

import { getReferralTag, submitReferral } from '@divvi/referral-sdk'
import { SessionProvider } from 'next-auth/react';
import { AppProps } from 'next/app';
import {
  connectorsForWallets,
  lightTheme,
  RainbowKitProvider,
} from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { injectedWallet } from '@rainbow-me/rainbowkit/wallets';
import { RainbowKitSiweNextAuthProvider, type GetSiweMessageOptions } from '@rainbow-me/rainbowkit-siwe-next-auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createConfig, http, useAccount, WagmiProvider } from 'wagmi';
import { celo, celoAlfajores } from 'wagmi/chains';



interface RainbowKitProviderProps {
  children: React.ReactNode;
  autoConnect?: boolean;
}

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


const getSiweMessageOptions: GetSiweMessageOptions = () => {
  const referralTag = getReferralTag({
    user: ethereum?.selectedAddress || '0x0',
    consumer: '0x358643badcc77cccb28a319abd439438a57339a7',
  })
  const msg={
    statement: `Sign in to Learn through games with DIVVI tracking.` // + ` Referral Tag: ${referralTag}`
  }
  console.log("OJO msg=", msg)
  return msg
}

const queryClient = new QueryClient();

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
  );
}
