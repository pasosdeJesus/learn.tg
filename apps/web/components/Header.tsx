'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import * as React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'

import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { WalletSelector } from '@/components/WalletSelector'
import { NotificationsBell } from '@/components/NotificationsBell'
import { UserLanguageSync } from '@/components/UserLanguageSync'

/**
 * Wallets with the verifier role (R-#255): the same source the admin pages use.
 * Read inside the component so a test (or a build) can change the env var.
 */
function verifierWallets(): string[] {
  return (process.env.NEXT_PUBLIC_VERIFIER_WALLET || '')
    .split(',')
    .map((wallet) => wallet.trim().toLowerCase())
    .filter(Boolean)
}

export default function Header({ lang: langProp = 'en' }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  // Grupo abierto del menú de dos niveles (R-#161 §15); cerrado por omisión.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const menuRef = useRef<HTMLDivElement>(null)
  const { data: session } = useSession()
  const params = useParams()
  const lang = (params?.lang as string) || langProp || 'en'

  // Defer localStorage read to client-side to avoid hydration mismatch
  const [localAddr, setLocalAddr] = useState<string | null>(null)
  useEffect(() => {
    setLocalAddr(localStorage.getItem('learn.tg.sessionAddress'))
  }, [])

  const sessionAddress = (session as any)?.address as string | undefined || localAddr || undefined
  const isAuthenticated = !!sessionAddress
  // R-#164: el directorio de iglesias se ofrece sólo a quien está autenticado,
  // verificado y vive en un país de región tipo 1. El API lo decide
  // (`/api/settings.directoryVisible`): invitado, sin país o país tipo 2 → no.
  const [directoryVisible, setDirectoryVisible] = useState(false)
  // R-#161 §15: la sección GDCluster usa la **misma** señal con que `/[lang]` ya
  // decide si el curso Global Disciples se ofrece a un perfil (R-#194): los campos
  // `religion_id` y `position_israel_gaza` de `/api/profile`. Aquí no se decide
  // elegibilidad: se reutiliza la decisión del servidor, y la compra y el rol de
  // pastor se preguntan aparte. Si el curso no se le ofrece, la sección no se
  // muestra y no se le dice por qué (es la admisión del programa, no una etiqueta
  // sobre la persona).
  const [gdOfferable, setGdOfferable] = useState(false)
  const [gdHasCourse, setGdHasCourse] = useState(false)
  const [gdIsPastor, setGdIsPastor] = useState(false)
  useEffect(() => {
    setDirectoryVisible(false)
    if (!sessionAddress || typeof window === 'undefined') {
      setGdOfferable(false)
      setGdHasCourse(false)
      setGdIsPastor(false)
      return
    }
    let cancelled = false
    const wallet = encodeURIComponent(sessionAddress)
    try {
      fetch(`/api/settings?walletAddress=${wallet}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (!cancelled && d) setDirectoryVisible(!!d.directoryVisible) })
        .catch(() => { /* ignore */ })

      fetch(`/api/profile?walletAddress=${wallet}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled || !d) return
          setGdOfferable(Number(d.religion_id) === 2 && d.position_israel_gaza === 'no')
        })
        .catch(() => { /* ignore */ })

      fetch('/api/course-catalog?filtro[busconBilletera]=true')
        .then((r) => (r.ok ? r.json() : null))
        .then((courses) => {
          if (cancelled || !Array.isArray(courses)) return
          // Cursos 10/11 (gdcluster, redgd): el id o el prefijo de ruta los identifica.
          setGdHasCourse(
            (courses as Array<{ id?: number | string; prefijoRuta?: string | null }>).some(
              (course) => {
                const prefix = String(course?.prefijoRuta || '').replace(/^\/+/, '')
                return [10, 11].includes(Number(course?.id)) || ['gdcluster', 'redgd'].includes(prefix)
              },
            ),
          )
        })
        .catch(() => { /* ignore */ })

      fetch(`/api/cluster/status?walletAddress=${wallet}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled || !d) return
          // `noChurch` es lo que el API responde a quien no es pastor principal.
          setGdIsPastor(d.noChurch !== true)
        })
        .catch(() => { /* ignore */ })
    } catch { /* relative URL / offline in tests */ }
    return () => { cancelled = true }
  }, [sessionAddress])
  // R-#255: sólo el verificador ve el acceso al panel de administración. La página
  // /{lang}/admin vuelve a comprobarlo; esto es comodidad, no un control de acceso.
  const isVerifier = !!sessionAddress && verifierWallets().includes(sessionAddress.toLowerCase())

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

  // Menú de dos niveles (R-#161 §15). Cada grupo se abre con su botón
  // (`aria-expanded`); lo que no aplica al visitante no se renderiza:
  //   My account   → sólo con sesión (y Admin sólo el verificador)
  //   Courses      → siempre
  //   GDCluster    → sólo a quien el servidor ya le ofrece el curso (R-#194);
  //                  Budget necesita la compra y Cluster además el rol de pastor
  //   learn.tg     → siempre (el directorio de iglesias según R-#164)
  // La gota 💧 suelta desaparece con sesión porque Donate vive en el último grupo
  // (R-#230).
  type MenuItem = { key: string; href: string; emoji: string }
  type MenuGroup = { id: string; key: string; emoji: string; items: MenuItem[] }

  const groups: MenuGroup[] = []
  if (isAuthenticated) {
    groups.push({
      id: 'account',
      key: 'navMyAccount',
      emoji: '👤',
      items: [
        { key: 'navProfile', href: `/${lang}/profile`, emoji: '👤' },
        { key: 'navSettings', href: `/${lang}/settings`, emoji: '🔒' },
        { key: 'navReferrals', href: lang === 'es' ? '/es/referidos' : `/${lang}/referrals`, emoji: '🤝' },
        ...(isVerifier ? [{ key: 'navAdmin', href: `/${lang}/admin`, emoji: '🛠️' }] : []),
      ],
    })
  }

  groups.push({
    id: 'courses',
    key: 'navCourses',
    emoji: '📚',
    items: [{ key: 'navCourseList', href: `/${lang}`, emoji: '📚' }],
  })

  if (gdOfferable) {
    groups.push({
      id: 'gdcluster',
      key: 'navGdCluster',
      emoji: '🌍',
      items: [
        { key: 'navGdRanking', href: `/${lang}/gdcluster/ranking`, emoji: '🏆' },
        ...(gdHasCourse ? [{ key: 'navGdBudget', href: `/${lang}/gdcluster`, emoji: '💵' }] : []),
        ...(gdIsPastor
          ? [{ key: 'navGdClusterMenu', href: `/${lang}/cluster`, emoji: '🤝' }]
          : []),
      ],
    })
  }

  groups.push({
    id: 'learntg',
    key: 'navLearnTg',
    emoji: '🎓',
    items: [
      { key: 'navLeaderboard', href: `/${lang}/leaderboard`, emoji: '🏆' },
      { key: 'navTransparency', href: `/${lang}/transparency`, emoji: '📊' },
      // R-#164: directorio de iglesias; sólo para quien está verificado en un país de región tipo 1.
      ...(directoryVisible
        ? [{ key: 'churchDirectory', href: `/${lang}/directory/churches`, emoji: '⛪' }]
        : []),
      { key: 'navDonateLensenia', href: `/${lang}/donations/lensenia`, emoji: '💧' },
    ],
  })

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
              {/* Hamburger Menu — visible para todos (R-#230: también invitados,
                  sin Profile). Renderizado incondicional evita el hydration
                  mismatch del menú condicional (R-#218). */}
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
                  <div className="absolute left-0 mt-2 w-60 max-w-[calc(100vw-3rem)] bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                    {groups.map((group) => {
                      const open = !!openGroups[group.id]
                      return (
                        <div key={group.id} className="border-b border-gray-100 last:border-b-0">
                          <button
                            type="button"
                            aria-expanded={open}
                            aria-controls={`menu-group-${group.id}`}
                            data-testid={`menu-group-${group.id}`}
                            onClick={() =>
                              setOpenGroups((previous) => ({
                                ...previous,
                                [group.id]: !previous[group.id],
                              }))
                            }
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-100 transition-colors"
                          >
                            <span className="text-base">{group.emoji}</span>
                            <span className="flex-1 text-left">{tCommon(group.key)}</span>
                            <span aria-hidden="true" className="text-[0.65rem] text-gray-400">
                              {open ? '▲' : '▼'}
                            </span>
                          </button>
                          {open && (
                            <ul id={`menu-group-${group.id}`} className="pb-1">
                              {group.items.map((item) => (
                                <li key={`${group.id}-${item.key}`}>
                                  <Link
                                    href={item.href}
                                    className="flex items-center gap-3 pl-10 pr-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                                    onClick={() => setIsMenuOpen(false)}
                                  >
                                    <span className="text-base">{item.emoji}</span>
                                    <span>{tCommon(item.key)}</span>
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* R-#223 + R-#230: gota 💧 de acceso público a la donación — solo
                  SIN sesión; con sesión la donación vive en el menú ☰. */}
              {!isAuthenticated && (
                <Link
                  href={`/${lang}/donations/lensenia`}
                  title={tCommon('navDonateLensenia')}
                  className="text-xl hover:opacity-70"
                  aria-label={tCommon('navDonateLensenia')}
                >
                  💧
                </Link>
              )}
              <NotificationsBell lang={lang} />
              <WalletSelector lang={lang} />
              <UserLanguageSync lang={lang} />
            </div>
          </nav>
        </div>
      </div>
    </header>
  )
}
