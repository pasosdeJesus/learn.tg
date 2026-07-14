'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { SiweMessage } from 'siwe'
import { getAddress } from 'viem'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ExtendedSession {
  address?: string
  expires?: string
  user?: { name?: string }
}

/**
 * Custom Connect button — replaces RainbowKit's ConnectButton.
 *
 * Uses window.ethereum directly (no wagmi, no RainbowKit) to:
 * 1. Request wallet accounts (eth_requestAccounts)
 * 2. Sign a SIWE message (personal_sign)
 * 3. POST to NextAuth callback (/api/auth/callback/credentials)
 *
 * After SIWE, NextAuth session JWT handles identity.
 * The session persists across navigation — no reconnect needed.
 */
export function ConnectWalletButton() {
  const { data: session, update } = useSession() as {
    data: ExtendedSession | null
    update: () => Promise<ExtendedSession | null>
  }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hidden, setHidden] = useState(false)

  // NextAuth's useSession() sometimes returns null after client-side navigation
  // (known bug #5719) even with a valid cookie. Fall back to localStorage.
  const sessionAddress = session?.address || (
    typeof window !== 'undefined'
      ? localStorage.getItem('learn.tg.sessionAddress') || undefined
      : undefined
  )

  // Persist session address to localStorage whenever it changes
  useEffect(() => {
    if (session?.address) {
      localStorage.setItem('learn.tg.sessionAddress', session.address)
    }
  }, [session?.address])

  // Auto-connect for MiniPay
  useEffect(() => {
    if (typeof window !== 'undefined' && (window.ethereum as any)?.isMiniPay) {
      setHidden(true)
      handleConnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleConnect() {
    setLoading(true)
    setError('')

    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        setError('No wallet detected. Please install OneKey or MetaMask.')
        return
      }

      // 1. Request accounts — opens wallet if not already connected
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      })
      const address: string = accounts[0]
      const checksummedAddress = getAddress(address)

      // 2. Get chain ID
      const chainIdHex: string = await window.ethereum.request({
        method: 'eth_chainId',
      })
      const chainId = parseInt(chainIdHex, 16)

      // 3. Get CSRF token (nonce) from NextAuth
      const csrfRes = await fetch('/api/auth/csrf')
      const { csrfToken } = await csrfRes.json()
      if (!csrfToken) throw new Error('Could not get CSRF token')

      // 4. Build and sign SIWE message
      const domain = window.location.host
      const origin = window.location.origin
      const msg = new SiweMessage({
        domain,
        address: checksummedAddress,
        statement: 'Sign in to Learn through games.',
        uri: origin,
        version: '1',
        chainId,
        nonce: csrfToken,
      })
      const msgStr = msg.prepareMessage()
      const sig: string = await window.ethereum.request({
        method: 'personal_sign',
        params: [msgStr, address],
      })

      // 5. POST to NextAuth credentials callback
      const body = new URLSearchParams({
        csrfToken,
        message: msgStr,
        signature: sig,
        redirect: 'false',
        json: 'true',
      })
      const cbRes = await fetch('/api/auth/callback/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })

      if (!cbRes.ok) {
        const text = await cbRes.text()
        console.error('[ConnectWallet] callback failed:', cbRes.status, text.slice(0, 200))
        throw new Error(`Authentication failed (${cbRes.status})`)
      }

      // Set localStorage immediately — don't wait for useEffect
      localStorage.setItem('learn.tg.sessionAddress', checksummedAddress)

      // Refresh NextAuth session — may require page reload if update() doesn't work
      const updated = await update()
      console.log('[ConnectWallet] connected:', checksummedAddress.slice(0, 10) + '...',
        'session after update:', updated?.address?.slice(0, 10) || 'null')

      if (!updated?.address) {
        // NextAuth update() failed to return session — reload page as fallback
        console.log('[ConnectWallet] update() returned no address, reloading page')
        window.location.reload()
      }
    } catch (err: any) {
      console.error('ConnectWalletButton error:', err)
      const msg =
        err?.code === 4001
          ? 'Connection cancelled. Please try again.'
          : err?.message || 'Connection failed. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    localStorage.removeItem('learn.tg.sessionAddress')
    await fetch('/api/auth/signout', { method: 'POST' })
    await update()
  }

  // MiniPay: hide the button completely
  if (hidden) return null

  // Connected: show address with disconnect
  if (sessionAddress) {
    return (
      <div className="flex items-center gap-2">
        <span
          className="text-xs text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full font-mono"
          title={sessionAddress}
        >
          {sessionAddress.slice(0, 6)}...{sessionAddress.slice(-4)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-gray-500 hover:text-red-600"
          onClick={handleDisconnect}
        >
          ✕
        </Button>
      </div>
    )
  }

  // Not connected: show Connect button
  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleConnect}
        disabled={loading}
        variant="default"
        size="sm"
        className="text-sm"
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Connect Wallet
      </Button>
      {error && (
        <span className="text-xs text-red-600 max-w-[200px] truncate" title={error}>
          {error}
        </span>
      )}
    </div>
  )
}
