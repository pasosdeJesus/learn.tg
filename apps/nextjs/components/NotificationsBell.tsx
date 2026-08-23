'use client'

import { useEffect, useRef, useState } from 'react'
import { getCsrfToken } from 'next-auth/react'
import { Bell } from 'lucide-react'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'

interface Notification {
  id: number
  type: string | null
  title: string | null
  content: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

export function NotificationsBell({ lang = 'en' }: { lang?: string }) {
  const { address, isAuthenticated } = useAuthAddress()
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('learn.tg.authToken') || (await getCsrfToken())
      const res = await fetch(`/api/notifications?walletAddress=${address || ''}&token=${token || ''}`)
      if (!res.ok) return
      const data = await res.json()
      setItems(data.notifications || [])
      setUnread(data.unread || 0)
    } catch {
      // ignore transient fetch errors
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return
    fetchNotifications()
    const id = setInterval(fetchNotifications, 60000)
    return () => clearInterval(id)
  }, [isAuthenticated, address])

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!isAuthenticated) return null

  const markAllRead = async () => {
    try {
      const token = localStorage.getItem('learn.tg.authToken') || (await getCsrfToken())
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, token }),
      })
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnread(0)
    } catch {
      // ignore
    }
  }

  const isEs = lang === 'es'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-gray-100"
        aria-label={isEs ? 'Notificaciones' : 'Notifications'}
      >
        <Bell className="h-5 w-5 text-gray-600" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[11px] font-semibold rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-4 right-4 top-14 z-50 md:absolute md:left-auto md:right-0 md:top-auto md:mt-2 md:w-72 md:max-w-[calc(100vw-2rem)] bg-white rounded-md shadow-lg border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-700">
              {isEs ? 'Notificaciones' : 'Notifications'}
            </span>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="text-xs text-blue-600 hover:underline">
                {isEs ? 'Marcar leídas' : 'Mark read'}
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-sm text-gray-400 px-4 py-6 text-center">
                {isEs ? 'Sin notificaciones' : 'No notifications'}
              </p>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-gray-50 text-sm ${n.is_read ? '' : 'bg-blue-50'}`}
                >
                  <p className="font-medium text-gray-800 break-words">{n.title}</p>
                  {n.content && <p className="text-gray-600 text-xs mt-0.5 break-words whitespace-normal">{n.content}</p>}
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-gray-400 text-xs">
                      {new Date(n.created_at).toLocaleString(isEs ? 'es' : 'en')}
                    </p>
                    {n.link && (
                      <a href={n.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                        {isEs ? 'Ver transacción' : 'View transaction'} ↗
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
