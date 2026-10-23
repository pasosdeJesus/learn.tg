'use client'

/**
 * Sign a SIWE message with a known address (R-#288). The sign-in flows sign as part
 * of entering; the handover accept needs a fresh signature from the wallet that is
 * already in session, with the same domain/chain/nonce policy as `lib/in-app-siwe.ts`
 * and `ConnectWalletButton`, so `lib/siwe-server.ts` accepts it.
 */
import { SiweMessage } from 'siwe'
import { getAddress } from 'viem'
import type { Eip1193Provider } from '@pasosdejesus/m/wallet'
import { getAppChain } from '@/lib/app-chain'

export type SiweSignFailure = 'no-provider' | 'wrong-account' | 'no-csrf' | 'cancelled'

export class SiweSignError extends Error {
  code: SiweSignFailure

  constructor(code: SiweSignFailure) {
    super(code)
    this.name = 'SiweSignError'
    this.code = code
  }
}

function isCancelled(error: unknown): boolean {
  const code = (error as { code?: number })?.code
  const message = String((error as Error)?.message ?? error)
  return code === 4001 || code === -32603 || /reject|denied|cancel/i.test(message)
}

async function ensureAccount(provider: Eip1193Provider, address: string): Promise<void> {
  const target = address.toLowerCase()
  let accounts = (await provider.request({ method: 'eth_accounts' }).catch(() => [])) as string[]
  if (!Array.isArray(accounts) || !accounts.some((item) => item.toLowerCase() === target)) {
    accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[]
  }
  if (!Array.isArray(accounts) || !accounts.some((item) => item.toLowerCase() === target)) {
    throw new SiweSignError('wrong-account')
  }
}

export async function signSiweForAddress(
  provider: Eip1193Provider | null | undefined,
  address: string,
): Promise<{ message: string; signature: string }> {
  if (!provider) throw new SiweSignError('no-provider')
  await ensureAccount(provider, address)

  const response = await fetch('/api/auth/csrf')
  const { csrfToken } = (await response.json().catch(() => ({}))) as { csrfToken?: string }
  if (!csrfToken) throw new SiweSignError('no-csrf')

  const message = new SiweMessage({
    domain: window.location.host,
    address: getAddress(address),
    statement: 'Sign in to Learn through games.',
    uri: window.location.origin,
    version: '1',
    chainId: getAppChain().id,
    nonce: csrfToken,
  }).prepareMessage()

  let signature: string
  try {
    signature = (await provider.request({
      method: 'personal_sign',
      params: [message, address],
    })) as string
  } catch (error) {
    if (isCancelled(error)) throw new SiweSignError('cancelled')
    throw error
  }
  return { message, signature }
}
