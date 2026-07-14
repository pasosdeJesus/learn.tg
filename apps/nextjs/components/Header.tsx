'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import * as React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'

import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { ConnectWalletButton } from '@/components/ConnectWalletButton'

export default function Header({ lang: langProp = 'en' }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { data: session } = useSession()
  const params = useParams()
  const lang = (params?.lang as string) || langProp || 'en'

  const sessionAddress = (session as any)?.address as string | undefined
    || (typeof window !== 'undefined' ? localStorage.getItem('learn.tg.sessionAddress') || undefined : undefined)
  const isAuthenticated = !!sessionAddress

  // Local translations (title + menu icon)
  const t = useMemo(() => createComponentT(lang, {
    en: { title: 'Learn through games', menu: '☰' },
    es: { title: 'Aprender mediante juegos', menu: '☰' },
  }), [lang])

  // Common translations (nav items — from common.ts via createComponentT)
  const tCommon = useMemo(() => createComponentT(lang, {}), [lang])

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Menu items configuration
  const menuItems = [
    { key: 'navProfile', href: `/${lang}/profile`, emoji: '👤' },
    { key: 'navLeaderboard', href: `/${lang}/leaderboard`, emoji: '🏆' },
    { key: 'navTransparency', href: `/${lang}/transparency`, emoji: '📊' },
  ]

  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-y-2">
          <nav aria-label="Primary navigation">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2">
                <Image
                  src="/logo-learntg.png"
                  alt="logo"
                  width={32}
                  height={32}
                  className="rounded-full"
                />
                <span className="text-gray-800 font-semibold text-lg">
                  {t('title')}
                </span>
              </Link>
            </div>
          </nav>

          <nav aria-label="User authentication">
            <div className="flex items-center justify-end gap-4">
              {/* Hamburger Menu — visible when authenticated */}
              {isAuthenticated && (
                <div className="relative" ref={menuRef}>
                  <Button
                    variant="ghost"
                    className="text-2xl px-3 py-1 hover:bg-gray-100"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    aria-label="Menu"
                  >
                    {t('menu')}
                  </Button>

                  {/* Dropdown menu */}
                  {isMenuOpen && (
                    <div className="absolute left-0 mt-2 w-56 max-w-[calc(100vw-3rem)] bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                      {menuItems.map((item) => (
                        <Link
                          key={item.key}
                          href={item.href}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <span className="text-base">{item.emoji}</span>
                          <span>{tCommon(item.key)}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <ConnectWalletButton lang={lang} />
            </div>
          </nav>
        </div>
      </div>
    </header>
  )
}
