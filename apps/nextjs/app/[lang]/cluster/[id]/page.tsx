'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession, getCsrfToken } from 'next-auth/react'
import { useAccount } from 'wagmi'
import { Loader2 } from 'lucide-react'
import { useToast } from '@pasosdejesus/m/shadcn-components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { createComponentT } from '@/lib/hooks/useTranslation'

type PageProps = {
  params: Promise<{
    lang: string
    id: string
  }>
}

const tEn = {
  back: 'Back to home',
  formed: 'Formed',
  inProgress: 'In Progress',
  churches: 'churches',
  rename: 'Rename',
  save: 'Save',
  cancel: 'Cancel',
  joinCode: 'Join code',
  memberChurches: 'Member Churches',
  codePlaceholder: '6-char code',
  join: 'Join',
  joinedCluster: 'Joined cluster!',
  leaveCluster: 'Leave cluster',
  leftCluster: 'Left cluster',
  clusterDissolved: 'Cluster dissolved',
  nameUpdated: 'Name updated',
  history: 'History',
  churchJoined: 'Church joined',
  churchLeft: 'Church left',
  nameChanged: 'Name changed',
}
const tEs: typeof tEn = {
  back: 'Volver al inicio',
  formed: 'Formado',
  inProgress: 'En Progreso',
  churches: 'iglesias',
  rename: 'Renombrar',
  save: 'Guardar',
  cancel: 'Cancelar',
  joinCode: 'Código para unirse',
  memberChurches: 'Iglesias Miembros',
  codePlaceholder: 'Código de 6 caracteres',
  join: 'Unirse',
  joinedCluster: '¡Unido al clúster!',
  leaveCluster: 'Abandonar clúster',
  leftCluster: 'Saliste del clúster',
  clusterDissolved: 'Clúster disuelto',
  nameUpdated: 'Nombre actualizado',
  history: 'Historial',
  churchJoined: 'Iglesia se unió',
  churchLeft: 'Iglesia salió',
  nameChanged: 'Nombre cambiado',
}
const translations = { en: tEn, es: tEs }

const HISTORY_LABELS: Record<string, { en: string; es: string }> = {
  church_join: { en: 'Church joined', es: 'Iglesia se unió' },
  church_leave: { en: 'Church left', es: 'Iglesia salió' },
  name_change: { en: 'Name changed', es: 'Nombre cambiado' },
}

interface ClusterMember {
  church_id: number
  church_name: string
  joined_at: string
}

interface ClusterHistory {
  event_type: string
  old_value: string | null
  new_value: string | null
  changed_by: number | null
  created_at: string
}

interface ClusterData {
  id: number
  name: string
  code: string
  country_id: number
  created_at: string
  member_count: number
  status: string
  members: ClusterMember[]
  history: ClusterHistory[]
}

export default function ClusterPage({ params }: PageProps) {
  const { lang, id } = use(params)
  const t = createComponentT(lang, translations)
  const { toast } = useToast()
  const { data: session } = useSession()
  const { address } = useAccount()
  const [cluster, setCluster] = useState<ClusterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingName, setEditingName] = useState(false)

  const isAuthenticated = !!(address && session?.address && address.toLowerCase() === session.address.toLowerCase())

  const fetchCluster = useCallback(() => {
    fetch(`/api/cluster/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Cluster not found')
        return r.json()
      })
      .then((data) => {
        setCluster(data)
        setNewName(data.name)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { fetchCluster() }, [fetchCluster])

  const handleJoin = async () => {
    if (!joinCode || joinCode.length !== 6) return
    setJoining(true)
    try {
      const csrfToken = await getCsrfToken()
      const res = await fetch('/api/cluster/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, token: csrfToken, code: joinCode }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to join')
      }
      toast({ title: t('joinedCluster') })
      fetchCluster()
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
    } finally {
      setJoining(false)
    }
  }

  const handleLeave = async () => {
    try {
      const csrfToken = await getCsrfToken()
      const res = await fetch(`/api/cluster/${id}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, token: csrfToken }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to leave')
      }
      const data = await res.json()
      if (data.dissolved) {
        toast({ title: t('clusterDissolved') })
      } else {
        toast({ title: t('leftCluster') })
      }
      fetchCluster()
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
    }
  }

  const handleRename = async () => {
    if (!newName || newName.length < 3 || newName.length > 50) return
    try {
      const csrfToken = await getCsrfToken()
      const res = await fetch(`/api/cluster/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, token: csrfToken, name: newName }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to rename')
      }
      toast({ title: t('nameUpdated') })
      setEditingName(false)
      fetchCluster()
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error || !cluster) {
    return (
      <div className="max-w-2xl mx-auto p-6 mt-12">
        <p className="text-red-600">{error || 'Cluster not found'}</p>
        <Link href={`/${lang}`} className="text-blue-600 hover:underline mt-4 inline-block">
          ← {t('back')}
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 mt-12">
      <Link href={`/${lang}`} className="text-blue-600 hover:underline text-sm mb-6 inline-block">
        ← {t('back')}
      </Link>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{cluster.name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {cluster.status === 'Formed' ? `✅ ${t('formed')}` : `⏳ ${t('inProgress')}`}
              {' · '}
              {cluster.member_count} {t('churches')}
            </p>
          </div>
          {isAuthenticated && (
            <Button variant="outline" size="sm" onClick={() => setEditingName(!editingName)}>
              {t('rename')}
            </Button>
          )}
        </div>

        {editingName && (
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              maxLength={50}
              minLength={3}
            />
            <Button size="sm" onClick={handleRename}>
              {t('save')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setEditingName(false); setNewName(cluster.name) }}>
              {t('cancel')}
            </Button>
          </div>
        )}

        <div className="mb-6 p-3 bg-gray-50 rounded-md border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">
            {t('joinCode')}
          </p>
          <code className="text-lg font-mono font-bold text-gray-900 tracking-widest">
            {cluster.code}
          </code>
        </div>

        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          {t('memberChurches')} ({cluster.members.length})
        </h2>
        <ul className="space-y-2 mb-6">
          {cluster.members.map((m) => (
            <li key={m.church_id} className="flex items-center justify-between text-sm">
              <Link
                href={`/${lang}/church/${m.church_id}`}
                className="text-blue-600 hover:underline"
              >
                {m.church_name}
              </Link>
              <span className="text-gray-400 text-xs">
                {new Date(m.joined_at).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>

        {isAuthenticated && (
          <div className="border-t border-gray-200 pt-4 mb-6 space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder={t('codePlaceholder')}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono tracking-widest uppercase"
                maxLength={6}
              />
              <Button size="sm" onClick={handleJoin} disabled={joining || joinCode.length !== 6}>
                {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : t('join')}
              </Button>
            </div>
            <div>
              <Button variant="outline" size="sm" onClick={handleLeave} className="text-red-600 border-red-300 hover:bg-red-50">
                {t('leaveCluster')}
              </Button>
            </div>
          </div>
        )}

        {cluster.history.length > 0 && (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              {t('history')}
            </h2>
            <ul className="space-y-2 text-sm text-gray-600">
              {cluster.history.map((h, i) => {
                const labels = HISTORY_LABELS[h.event_type] || { en: h.event_type, es: h.event_type }
                const label = lang === 'es' ? labels.es : labels.en
                let detail = ''
                if (h.event_type === 'name_change') {
                  detail = `: "${h.old_value}" → "${h.new_value}"`
                } else if (h.event_type === 'church_join' || h.event_type === 'church_leave') {
                  detail = `: ${h.new_value || h.old_value}`
                }
                return (
                  <li key={i} className="flex justify-between">
                    <span>{label}{detail}</span>
                    <span className="text-gray-400">{new Date(h.created_at).toLocaleDateString()}</span>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
