/**
 * MIT License
 * Copyright (c) 2022 DevRel Team & Community
 *
 * Based on Celo Composer. See
 */
'use client'

import { useMemo } from 'react'
import { SessionProvider } from 'next-auth/react'
import { WalletEventListener } from '@/components/WalletEventListener'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

interface AppProviderProps {
  children: React.ReactNode
}

// Taking ideas of
// https://github.com/0xRowdy/nextauth-siwe-route-handlers/blob/main/src/app/providers/web3-providers.tsx
export function AppProvider(props: AppProviderProps) {

  const queryClient = useMemo(() => new QueryClient(), [])

  return (
    <SessionProvider>
      <WalletEventListener />
      <QueryClientProvider client={queryClient}>
        {props.children}
      </QueryClientProvider>
    </SessionProvider>
  )
}
