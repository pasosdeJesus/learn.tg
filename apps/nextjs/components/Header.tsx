'use client'

import { Session } from 'next-auth'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import * as React from 'react'
import { useEffect, useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useConnect } from 'wagmi'
import { injected } from 'wagmi/connectors'

import { Button } from '@/components/ui/button'

interface ExtendedSession extends Session {
  address?: string
}

export default function Header({ lang = 'en' }) {
  const [hideConnectBtn, setHideConnectBtn] = useState(false)
  const { connect } = useConnect()
  const { address, isConnected } = useAccount()
  const { data: session } = useSession() as { data: ExtendedSession | null }

  useEffect(() => {
    if (window.ethereum && window.ethereum.isMiniPay) {
      setHideConnectBtn(true)
      connect({ connector: injected({ target: 'metaMask' }) })
    }
  }, [connect])

  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          <nav aria-label="Primary navigation">
            <div className="flex items-center">
              <Link href="/" className="flex items-center gap-2">
                <Image
                  src="/logo-learntg.png"
                  alt="logo"
                  width={32}
                  height={32}
                  className="rounded-full"
                />
                <span className="text-gray-800 font-semibold text-lg">
                  {lang === 'es'
                    ? 'Aprender mediante juegos'
                    : 'Learn through games'}
                </span>
              </Link>
            </div>
          </nav>

          <nav aria-label="User authentication">
            <div className="flex items-center gap-4">
              {isConnected &&
                address &&
                session &&
                session.address &&
                session.address == address && (
                  <Button asChild variant="ghost">
                    <Link href={`/${lang ? lang : 'es'}/profile`}>
                      {lang === 'en' ? 'Profile' : 'Perfil'}
                    </Link>
                  </Button>
                )}
              {!hideConnectBtn && (
                <ConnectButton
                  showBalance={{ smallScreen: false, largeScreen: false }}
                />
              )}
            </div>
          </nav>
        </div>
      </div>
    </header>
  )
}
