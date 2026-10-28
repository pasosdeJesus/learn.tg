'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { useToast } from '@pasosdejesus/m/shadcn-components/ui/use-toast'

// Deps del core inyectadas por el host (https://gitlab.com/pasosdeJesus/m/-/work_items/35 §13.3, D2 para componentes):
// el motor no importa hooks del core ni next-auth. `lib/gdcluster-ui.tsx`
// (host) provee los valores reales.
export interface ClusterPageDeps {
  useAuthAddress: () => { address?: string }
  useSession: () => { data: { address?: string } | null }
  getCsrfToken: () => Promise<string | undefined>
  Button: ComponentType<any>
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
  clusterWallet: 'Cluster wallet',
  notConfigured: 'Not configured',
  copy: 'Copy',
  copied: 'Copied',
  changeWallet: 'Change',
  walletHint: 'Use a multisig wallet (for example a Safe) shared by the cluster pastors as signers. Set it before funds arrive: changing it later does not move funds already credited.',
  walletSaved: 'Cluster wallet saved',
  gdTitle: 'Global Disciples',
  gdIntro: 'When the cluster and every pastor meet the conditions, the initiator can ask pdJ to present it to Global Disciples (GD). pdJ is not GD staff: it asks GD for the contact of the nearest program director or the channel to continue, and the cluster then talks directly with GD.',
  gdRequest: 'Request the presentation to Global Disciples',
  gdRequestSend: 'Send request',
  gdRequested: 'Presentation requested',
  gdSent: 'pdJ wrote to GD',
  gdResponse: 'Answer from Global Disciples',
  gdContactEmail: 'Email or channel to continue',
  gdRequestSent: 'Request sent to pdJ',
  gdRequestError: 'Could not send the request',
  gdOk: 'Meets the conditions',
  gdMissingCourse: 'course not finished',
  gdMissingScore: 'profile score must be above 90',
  gdMissingInvitePastor: 'has not invited a pastor',
  gdMissingInviteMember: 'has not invited a member of their church',
  gdMissingNoPastor: 'no principal pastor registered',
  gdMissingActive: 'the cluster must be active',
  gdMissingMembers: 'at least 3 churches',
  gdMissingNoPastors: 'no pastors',
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
  clusterWallet: 'Billetera del clúster',
  notConfigured: 'Sin configurar',
  copy: 'Copiar',
  copied: 'Copiada',
  changeWallet: 'Cambiar',
  walletHint: 'Usa una billetera multisig (por ejemplo una Safe) con las billeteras de los pastores del clúster como firmantes. Configúrala antes de recibir fondos: cambiarla después no mueve los fondos ya acreditados.',
  walletSaved: 'Billetera del clúster guardada',
  gdTitle: 'Global Disciples',
  gdIntro: 'Cuando el clúster y cada pastor cumplen las condiciones, el iniciador puede pedirle a pdJ que lo presente a Global Disciples (GD). pdJ no es personal de GD: le pide a GD el contacto del director de programa más cercano o el canal para continuar, y después el clúster habla directamente con GD.',
  gdRequest: 'Solicitar la presentación a Global Disciples',
  gdRequestSend: 'Enviar solicitud',
  gdRequested: 'Presentación solicitada',
  gdSent: 'pdJ escribió a GD',
  gdResponse: 'Respuesta de Global Disciples',
  gdContactEmail: 'Correo o canal para continuar',
  gdRequestSent: 'Solicitud enviada a pdJ',
  gdRequestError: 'No se pudo enviar la solicitud',
  gdOk: 'Cumple las condiciones',
  gdMissingCourse: 'curso sin terminar',
  gdMissingScore: 'el perfil debe ser mayor a 90',
  gdMissingInvitePastor: 'no ha invitado a un pastor',
  gdMissingInviteMember: 'no ha invitado a un miembro de su iglesia',
  gdMissingNoPastor: 'sin pastor principal registrado',
  gdMissingActive: 'el clúster debe estar activo',
  gdMissingMembers: 'al menos 3 iglesias',
  gdMissingNoPastors: 'sin pastores',
}
const translations = { en: tEn, es: tEs }

const HISTORY_LABELS: Record<string, { en: string; es: string }> = {
  church_join: { en: 'Church joined', es: 'Iglesia se unió' },
  church_leave: { en: 'Church left', es: 'Iglesia salió' },
  initiator_transfer: { en: 'Initiator changed', es: 'Iniciador cambiado' },
  leader_transfer: { en: 'Initiator changed (legacy)', es: 'Iniciador cambiado (antiguo)' },
  name_change: { en: 'Name changed', es: 'Nombre cambiado' },
  cluster_wallet_change: { en: 'Cluster wallet changed', es: 'Billetera del clúster cambiada' },
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
  cluster_wallet: string | null
  isInitiator?: boolean
  members: ClusterMember[]
  history: ClusterHistory[]
}


interface PresentationPastor {
  church_name: string
  nombre: string | null
  guides_done: number
  guides_total: number
  profile_score: number
  invited_pastor: boolean
  invited_member: boolean
  missing: string[]
}

interface PresentationRequestView {
  requested_at: string | null
  sent_at: string | null
  response?: string | null
  contact_email?: string | null
}

interface PresentationView {
  ready: boolean
  pastors: PresentationPastor[]
  missing: string[]
  isInitiator: boolean
  request: PresentationRequestView | null
}

const PASTOR_MISSING: Record<string, keyof typeof tEn> = {
  course: 'gdMissingCourse',
  score: 'gdMissingScore',
  invite_pastor: 'gdMissingInvitePastor',
  invite_member: 'gdMissingInviteMember',
  no_pastor: 'gdMissingNoPastor',
}
const CLUSTER_MISSING: Record<string, keyof typeof tEn> = {
  cluster_active: 'gdMissingActive',
  cluster_members: 'gdMissingMembers',
  no_pastors: 'gdMissingNoPastors',
}

export function ClusterPage({ lang, id, deps }: { lang: string; id: string; deps: ClusterPageDeps }) {
  const t = (key: keyof typeof tEn) =>
    (lang === 'es' ? translations.es[key] : translations.en[key])
  const { toast } = useToast()
  const { data: session } = deps.useSession()
  const { address } = deps.useAuthAddress()
  const [cluster, setCluster] = useState<ClusterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [editingWallet, setEditingWallet] = useState(false)
  const [newWallet, setNewWallet] = useState('')
  const [savingWallet, setSavingWallet] = useState(false)
  const [presentation, setPresentation] = useState<PresentationView | null>(null)
  const [gdConfirmed, setGdConfirmed] = useState(false)
  const [requesting, setRequesting] = useState(false)

  const isAuthenticated = !!(address && session?.address && address.toLowerCase() === session.address.toLowerCase())

  const fetchCluster = useCallback(() => {
    // `walletAddress` (opcional) solo sirve para que el API indique si quien
    // consulta es el iniciador del clúster y pueda editar la billetera (R-#220).
    const viewer = address ? `?walletAddress=${encodeURIComponent(address)}` : ''
    fetch(`/api/cluster/${id}${viewer}`)
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
  }, [id, address])

  useEffect(() => { fetchCluster() }, [fetchCluster])

  const fetchPresentation = useCallback(() => {
    if (!address) { setPresentation(null); return }
    fetch(`/api/cluster/${id}/gd-presentation?walletAddress=${encodeURIComponent(address)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setPresentation(data))
      .catch(() => setPresentation(null))
  }, [id, address])

  useEffect(() => { fetchPresentation() }, [fetchPresentation])

  const handleJoin = async () => {
    if (!joinCode || joinCode.length !== 6) return
    setJoining(true)
    try {
      const res = await fetch('/api/cluster/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, code: joinCode }),
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
      const res = await fetch(`/api/cluster/${id}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address }),
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
      const res = await fetch(`/api/cluster/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, name: newName }),
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

  const handleWallet = async () => {
    setSavingWallet(true)
    try {
      const res = await fetch(`/api/cluster/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, clusterWallet: newWallet.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save the wallet')
      }
      toast({ title: t('walletSaved') })
      setEditingWallet(false)
      fetchCluster()
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
    } finally {
      setSavingWallet(false)
    }
  }

  const handlePresentationRequest = async () => {
    setRequesting(true)
    try {
      const res = await fetch(`/api/cluster/${id}/gd-presentation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || t('gdRequestError'))
      toast({ title: t('gdRequestSent') })
      setGdConfirmed(false)
      fetchPresentation()
      fetchCluster()
    } catch (e: any) {
      toast({ title: e.message || t('gdRequestError'), variant: 'destructive' })
    } finally {
      setRequesting(false)
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
              {cluster.status === 'active' || cluster.status === 'Formed' ? `✅ ${t('formed')}` : `⏳ ${t('inProgress')}`}
              {' · '}
              {cluster.member_count} {t('churches')}
            </p>
          </div>
          {isAuthenticated && (
            <deps.Button variant="outline" size="sm" onClick={() => setEditingName(!editingName)}>
              {t('rename')}
            </deps.Button>
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
            <deps.Button size="sm" onClick={handleRename}>
              {t('save')}
            </deps.Button>
            <deps.Button size="sm" variant="outline" onClick={() => { setEditingName(false); setNewName(cluster.name) }}>
              {t('cancel')}
            </deps.Button>
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

        <div className="mb-6 p-3 bg-gray-50 rounded-md border border-gray-200 text-left">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-sm text-gray-600">{t('clusterWallet')}</p>
            {cluster.isInitiator && !editingWallet && (
              <button
                type="button"
                onClick={() => { setEditingWallet(true); setNewWallet(cluster.cluster_wallet || '') }}
                className="text-xs text-blue-600 hover:underline shrink-0"
              >
                {t('changeWallet')}
              </button>
            )}
          </div>
          {editingWallet ? (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={newWallet}
                onChange={(e) => setNewWallet(e.target.value)}
                placeholder="0x…"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs font-mono"
              />
              <div className="flex gap-2">
                <deps.Button size="sm" onClick={handleWallet} disabled={savingWallet}>
                  {t('save')}
                </deps.Button>
                <deps.Button size="sm" variant="outline" onClick={() => setEditingWallet(false)}>
                  {t('cancel')}
                </deps.Button>
              </div>
            </div>
          ) : cluster.cluster_wallet ? (
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono break-all text-gray-900">{cluster.cluster_wallet}</code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(cluster.cluster_wallet!)
                  toast({ title: t('copied') })
                }}
                className="text-xs text-blue-600 hover:underline shrink-0"
              >
                {t('copy')}
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-500">{t('notConfigured')}</p>
          )}
          <p className="text-xs text-gray-500 mt-2">{t('walletHint')}</p>
        </div>

        {presentation && (
          <div className="mb-6 p-3 bg-gray-50 rounded-md border border-gray-200 text-left">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">{t('gdTitle')}</h3>
            <p className="text-xs text-gray-600 mb-2">{t('gdIntro')}</p>
            {presentation.pastors.length > 0 && (
              <ul className="text-xs space-y-1 mb-2">
                {presentation.pastors.map((pastor, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span>
                      {pastor.church_name}
                      {pastor.nombre ? ` · ${pastor.nombre}` : ''}
                    </span>
                    <span className={pastor.missing.length ? 'text-amber-700' : 'text-green-700'}>
                      {pastor.missing.length
                        ? pastor.missing.map((key) => t(PASTOR_MISSING[key] ?? 'gdMissingCourse')).join(', ')
                        : t('gdOk')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {presentation.missing.length > 0 && (
              <p className="text-xs text-amber-700 mb-2">
                {presentation.missing.map((key) => t(CLUSTER_MISSING[key] ?? 'gdMissingActive')).join(' · ')}
              </p>
            )}
            {presentation.request ? (
              <div className="text-xs text-gray-700 space-y-1">
                <p>
                  {t('gdRequested')}
                  {presentation.request.requested_at ? ` · ${new Date(presentation.request.requested_at).toLocaleDateString(lang)}` : ''}
                </p>
                {presentation.request.sent_at && (
                  <p>
                    {t('gdSent')}
                    {` · ${new Date(presentation.request.sent_at).toLocaleDateString(lang)}`}
                  </p>
                )}
                {presentation.request.response && (
                  <div className="mt-2 rounded border border-gray-200 bg-white p-2">
                    <p className="font-semibold mb-1">{t('gdResponse')}</p>
                    <p className="whitespace-pre-wrap">{presentation.request.response}</p>
                  </div>
                )}
                {presentation.request.contact_email && (
                  <p className="mt-1">
                    {t('gdContactEmail')}:{' '}
                    <code className="font-mono break-all">{presentation.request.contact_email}</code>
                  </p>
                )}
              </div>
            ) : presentation.isInitiator ? (
              <div className="flex flex-col gap-2">
                <label className="flex items-start gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={gdConfirmed}
                    onChange={(e) => setGdConfirmed(e.target.checked)}
                    disabled={!presentation.ready}
                  />
                  <span>{t('gdRequest')}</span>
                </label>
                <div>
                  <deps.Button
                    size="sm"
                    onClick={handlePresentationRequest}
                    disabled={!gdConfirmed || !presentation.ready || requesting}
                  >
                    {t('gdRequestSend')}
                  </deps.Button>
                </div>
              </div>
            ) : null}
          </div>
        )}

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
              <deps.Button size="sm" onClick={handleJoin} disabled={joining || joinCode.length !== 6}>
                {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : t('join')}
              </deps.Button>
            </div>
            <div>
              <deps.Button variant="outline" size="sm" onClick={handleLeave} className="text-red-600 border-red-300 hover:bg-red-50">
                {t('leaveCluster')}
              </deps.Button>
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
