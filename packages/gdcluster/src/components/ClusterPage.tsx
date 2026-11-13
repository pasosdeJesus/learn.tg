'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { useToast } from '@pasosdejesus/m/shadcn-components/ui/use-toast'
import { ClusterPresentationPanel } from './ClusterPresentationPanel.js'

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
  alias: 'Public alias',
  aliasHint: 'This is the public name of the cluster (lowercase letters, digits and hyphens). The cluster name is internal.',
  aliasSave: 'Save alias',
  aliasSaved: 'Alias updated',
  aliasInvalid: 'The alias must have 2 to 40 characters: lowercase letters, digits and single hyphens',
  aliasTaken: 'That alias is already in use. Try',
  save: 'Save',
  cancel: 'Cancel',
  pendingChurches: 'Invite two more churches; with three you can complete the budget, the director offer and the approvals.',
  memberChurches: 'Member Churches',
  invitations: 'Invitations',
  inviteIntro: 'Invite a pastor by wallet. Only the lead pastor of a verified church in your country can be invited.',
  inviteWallet: 'Pastor wallet',
  inviteSend: 'Invite',
  inviteSent: 'Invitation sent',
  reinvite: 'Invite again',
  invitationReinvited: 'Invitation sent again',
  invitationPending: 'Waiting for the answer',
  invitationAccepted: 'Accepted',
  invitationRejected: 'Rejected',
  invitationFinal: 'Rejected twice: final',
  candidates: 'Pastors you can invite',
  noCandidates: 'No pastors you can invite yet (referred pastors from your country with a verified church). You can type a wallet below.',
  referralsLink: 'Go to referrals',
  leaveCluster: 'Leave cluster',
  leftCluster: 'Left cluster',
  clusterDissolved: 'Cluster dissolved',
  history: 'History',
  clusterWallet: 'Cluster wallet',
  notConfigured: 'Not configured',
  copy: 'Copy',
  copied: 'Copied',
  changeWallet: 'Change',
  walletHint: 'Use a multisig wallet (for example a Safe) shared by the cluster pastors as signers. Set it before funds arrive: changing it later does not move funds already credited.',
  walletSaved: 'Cluster wallet saved',
  walletHasFunds: 'This cluster wallet already holds funds{{0}}. Changing it does NOT move them: the existing fund stays in the old address. Change it anyway?',
  gdTitle: 'Global Disciples',
  gdIntro: 'When the cluster and every pastor meet the conditions, the initiator can ask pdJ to present it to Global Disciples (GD). pdJ is not GD staff: it asks GD for the contact of the nearest program director or the channel to continue, and the cluster then talks directly with GD.',
  gdRequest: 'Request the presentation to Global Disciples',
  gdRequestSend: 'Send request',
  gdRequested: 'Presentation requested',
  gdReturned: 'Returned by pdJ with suggestions',
  gdApproved: 'Approved by pdJ',
  gdAnswered: 'Global Disciples answered',
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
  gdMissingWallet: 'the cluster wallet is not set',
  gdMissingApprovals: 'the pastors have not approved the data',
  noCluster: 'You are not a member of a cluster yet.',
  error: 'Something went wrong.',
}
const tEs: typeof tEn = {
  back: 'Volver al inicio',
  formed: 'Formado',
  inProgress: 'En Progreso',
  churches: 'iglesias',
  alias: 'Alias público',
  aliasHint: 'Es el nombre público del clúster (minúsculas, dígitos y guiones). El nombre del clúster es interno.',
  aliasSave: 'Guardar alias',
  aliasSaved: 'Alias actualizado',
  aliasInvalid: 'El alias debe tener de 2 a 40 caracteres: minúsculas, dígitos y guiones simples',
  aliasTaken: 'Ese alias ya está en uso. Prueba',
  save: 'Guardar',
  cancel: 'Cancelar',
  pendingChurches: 'Invita dos iglesias más; con tres podrás completar el presupuesto, la oferta del director y las aprobaciones.',
  memberChurches: 'Iglesias Miembros',
  invitations: 'Invitaciones',
  inviteIntro: 'Invita a un pastor por su billetera. Sólo se puede invitar al pastor principal de una iglesia verificada de tu país.',
  inviteWallet: 'Billetera del pastor',
  inviteSend: 'Invitar',
  inviteSent: 'Invitación enviada',
  reinvite: 'Invitar de nuevo',
  invitationReinvited: 'Invitación enviada de nuevo',
  invitationPending: 'Esperando respuesta',
  invitationAccepted: 'Aceptada',
  invitationRejected: 'Rechazada',
  invitationFinal: 'Rechazada dos veces: definitiva',
  candidates: 'Pastores que puedes invitar',
  noCandidates: 'Aún no tienes pastores invitables (referidos de tu país con iglesia verificada). Puedes escribir una billetera abajo.',
  referralsLink: 'Ir a referidos',
  leaveCluster: 'Abandonar clúster',
  leftCluster: 'Saliste del clúster',
  clusterDissolved: 'Clúster disuelto',
  history: 'Historial',
  clusterWallet: 'Billetera del clúster',
  notConfigured: 'Sin configurar',
  copy: 'Copiar',
  copied: 'Copiada',
  changeWallet: 'Cambiar',
  walletHint: 'Usa una billetera multisig (por ejemplo una Safe) con las billeteras de los pastores del clúster como firmantes. Configúrala antes de recibir fondos: cambiarla después no mueve los fondos ya acreditados.',
  walletSaved: 'Billetera del clúster guardada',
  walletHasFunds: 'Esta billetera del clúster ya tiene fondos{{0}}. Cambiarla NO los mueve: el fondo existente queda en la billetera anterior. ¿Cambiarla de todos modos?',
  gdTitle: 'Global Disciples',
  gdIntro: 'Cuando el clúster y cada pastor cumplen las condiciones, el iniciador puede pedirle a pdJ que lo presente a Global Disciples (GD). pdJ no es personal de GD: le pide a GD el contacto del director de programa más cercano o el canal para continuar, y después el clúster habla directamente con GD.',
  gdRequest: 'Solicitar la presentación a Global Disciples',
  gdRequestSend: 'Enviar solicitud',
  gdRequested: 'Presentación solicitada',
  gdReturned: 'Devuelta por pdJ con sugerencias',
  gdApproved: 'Aprobada por pdJ',
  gdAnswered: 'Global Disciples respondió',
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
  gdMissingWallet: 'la billetera del clúster no está configurada',
  gdMissingApprovals: 'los pastores no han aprobado los datos',
  gdMissingNoPastor: 'sin pastor principal registrado',
  gdMissingActive: 'el clúster debe estar activo',
  gdMissingMembers: 'al menos 3 iglesias',
  gdMissingNoPastors: 'sin pastores',
  noCluster: 'Todavía no perteneces a un clúster.',
  error: 'Algo salió mal.',
}
const translations = { en: tEn, es: tEs }

const HISTORY_LABELS: Record<string, { en: string; es: string }> = {
  church_join: { en: 'Church joined', es: 'Iglesia se unió' },
  church_leave: { en: 'Church left', es: 'Iglesia salió' },
  initiator_transfer: { en: 'Initiator changed', es: 'Iniciador cambiado' },
  leader_transfer: { en: 'Initiator changed (legacy)', es: 'Iniciador cambiado (antiguo)' },
  name_change: { en: 'Name changed', es: 'Nombre cambiado' },
  slug_change: { en: 'Public alias changed', es: 'Alias público cambiado' },
  invitation_sent: { en: 'Invitation sent', es: 'Invitación enviada' },
  invitation_accepted: { en: 'Invitation accepted', es: 'Invitación aceptada' },
  invitation_rejected: { en: 'Invitation rejected', es: 'Invitación rechazada' },
  invitation_reinvited: { en: 'Invitation sent again', es: 'Invitación enviada de nuevo' },
  cluster_wallet_change: { en: 'Cluster wallet changed', es: 'Billetera del clúster cambiada' },
  budget_updated: { en: 'First-year budget updated', es: 'Presupuesto del primer año actualizado' },
  director_updated: { en: 'Director offer updated', es: 'Oferta del director actualizada' },
  fund_withdraw_started: { en: 'Withdrawal started', es: 'Retiro iniciado' },
  fund_withdraw_vote: { en: 'Pastor approved the withdrawal', es: 'Pastor aprobó el retiro' },
  fund_released: { en: 'Cluster fund released', es: 'Fondo del clúster liberado' },
  country_fund_released: { en: 'Country fund delivered', es: 'Fondo del país entregado' },
  country_fund_redistributed: { en: 'Country fund distributed among the presented clusters', es: 'Fondo del país repartido entre los clústeres presentados' },
  fund_release_failed: { en: 'Fund release failed', es: 'Falló la liberación del fondo' },
  country_fund_failed: { en: 'Country fund could not be delivered', es: 'No se pudo entregar el fondo del país' },
  gd_presentation_requested: { en: 'Presentation requested', es: 'Presentación solicitada' },
  gd_presentation_returned: { en: 'Presentation returned by pdJ', es: 'Presentación devuelta por pdJ' },
  gd_presentation_approved: { en: 'Presentation approved', es: 'Presentación aprobada' },
  gd_presentation_sent: { en: 'Presentation sent to GD', es: 'Presentación enviada a GD' },
  gd_presentation_answered: { en: 'GD answered', es: 'GD respondió' },
  gd_presentation_cancelled: { en: 'Presentation cancelled', es: 'Presentación cancelada' },
}

const REASON_LABELS: Record<string, { en: string; es: string }> = {
  unknown_wallet: { en: 'That wallet is not a pastor of a verified church.', es: 'Esa billetera no es de un pastor de iglesia verificada.' },
  not_lead_pastor: { en: 'That wallet is not the lead pastor of a church.', es: 'Esa billetera no es del pastor principal de una iglesia.' },
  church_not_verified: { en: 'That pastor belongs to a church that is not verified yet.', es: 'Ese pastor pertenece a una iglesia que aún no está verificada.' },
  own_church: { en: 'You cannot invite yourself.', es: 'No puedes invitarte a ti mismo.' },
  wrong_country: { en: 'Clusters are only for pastors of the cluster country, in countries classified as type 1.', es: 'Los clústeres son sólo para pastores del país del clúster, en países clasificados como tipo 1.' },
  cluster_completed: { en: 'That church belonged to a cluster that already received its funds.', es: 'Esa iglesia perteneció a un clúster que ya recibió sus fondos.' },
  already_in_cluster: { en: 'That pastor already belongs to a cluster.', es: 'Ese pastor ya pertenece a un clúster.' },
  already_invited: { en: 'That pastor is already invited to this cluster.', es: 'Ese pastor ya está invitado a este clúster.' },
  invite_limit_reached: { en: 'That pastor already rejected this cluster twice: the invitation is final.', es: 'Ese pastor ya rechazó este clúster dos veces: la invitación es definitiva.' },
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

interface ClusterInvitationRow {
  id: number
  status: string
  invite_count: number
  origin: string
  invited_wallet: string | null
  created_at: string
  responded_at: string | null
  church_name: string
}

interface Candidate {
  usuario_id: number
  nombre: string | null
  nusuario: string
  church_id: number
  church_name: string
}

interface ClusterData {
  id: number
  name: string
  slug: string
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
  status?: string | null
  locked?: boolean
  requested_at: string | null
  sent_at: string | null
  returned_at?: string | null
  approved_at?: string | null
  answered_at?: string | null
  response?: string | null
  contact_email?: string | null
  evaluation?: string | null
  suggestions?: string | null
  first_year_budget?: number | null
  budget_draft_path?: string | null
  budget_fixed_at?: string | null
  director_offer_path?: string | null
  director_first_year_pay?: number | null
  director_first_year_hours?: number | null
  director_fixed_at?: string | null
}

interface PresentationView {
  ready: boolean
  pastors: PresentationPastor[]
  missing: string[]
  missing_data?: string[]
  isInitiator: boolean
  isMember?: boolean
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
  cluster_wallet: 'gdMissingWallet',
  approvals: 'gdMissingApprovals',
}

const MIN_CHURCHES = 3

export function ClusterPage({ lang, id, deps }: { lang: string; id?: string; deps: ClusterPageDeps }) {
  const t = (key: keyof typeof tEn) =>
    (lang === 'es' ? translations.es[key] : translations.en[key]) ?? String(key)
  const { toast } = useToast()
  const { data: session } = deps.useSession()
  const { address } = deps.useAuthAddress()
  const [clusterId, setClusterId] = useState<string | null>(id ?? null)
  const [cluster, setCluster] = useState<ClusterData | null>(null)
  const [invitations, setInvitations] = useState<ClusterInvitationRow[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newSlug, setNewSlug] = useState('')
  const [editingSlug, setEditingSlug] = useState(false)
  const [savingSlug, setSavingSlug] = useState(false)
  const [editingWallet, setEditingWallet] = useState(false)
  const [newWallet, setNewWallet] = useState('')
  const [savingWallet, setSavingWallet] = useState(false)
  const [inviteWallet, setInviteWallet] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMessage, setInviteMessage] = useState('')
  const [presentation, setPresentation] = useState<PresentationView | null>(null)
  const [gdConfirmed, setGdConfirmed] = useState(false)
  const [requesting, setRequesting] = useState(false)

  const isAuthenticated = !!(address && session?.address && address.toLowerCase() === session.address.toLowerCase())
  const isInitiator = !!cluster?.isInitiator
  const viewer = address ? `?walletAddress=${encodeURIComponent(address)}` : ''

  const fetchCluster = useCallback(() => {
    if (!clusterId) return Promise.resolve()
    // `walletAddress` (opcional) sólo sirve para que el API indique si quien
    // consulta es el iniciador del clúster y pueda editar el alias y la billetera (R-#220).
    return fetch(`/api/cluster/${clusterId}${viewer}`)
      .then((r) => {
        if (!r.ok) throw new Error('Cluster not found')
        return r.json()
      })
      .then((data) => {
        setCluster(data)
        setNewSlug(data.slug ?? '')
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [clusterId, viewer])

  // El estado del pastor resuelve su clúster (no hay `id` en la URL privada, R-#299 §6) y
  // trae las invitaciones del clúster cuando quien consulta es el iniciador.
  const fetchStatus = useCallback(() => {
    if (!address) return Promise.resolve()
    return fetch(`/api/cluster/status${viewer}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (!s) return
        setInvitations(s.invitations ?? [])
        if (!id && s.hasCluster && s.clusterId) setClusterId(String(s.clusterId))
      })
      .catch(() => null)
  }, [address, id, viewer])

  useEffect(() => { fetchStatus() }, [fetchStatus])
  useEffect(() => { fetchCluster() }, [fetchCluster])

  const refresh = useCallback(async () => {
    await fetchStatus()
    await fetchCluster()
  }, [fetchStatus, fetchCluster])

  const fetchCandidates = useCallback(() => {
    if (!address) return
    fetch(`/api/cluster/candidates${viewer}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setCandidates(data?.candidates ?? []))
      .catch(() => setCandidates([]))
  }, [address, viewer])

  useEffect(() => { if (isInitiator) fetchCandidates() }, [isInitiator, fetchCandidates])

  const fetchPresentation = useCallback(() => {
    if (!address || !clusterId) { setPresentation(null); return }
    fetch(`/api/cluster/${clusterId}/gd-presentation${viewer}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setPresentation(data))
      .catch(() => setPresentation(null))
  }, [clusterId, address, viewer])

  useEffect(() => { fetchPresentation() }, [fetchPresentation])

  const handleLeave = async () => {
    if (!clusterId) return
    try {
      const res = await fetch(`/api/cluster/${clusterId}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to leave')
      }
      const data = await res.json()
      toast({ title: data.dissolved ? t('clusterDissolved') : t('leftCluster') })
      setCluster(null)
      setClusterId(null)
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
    }
  }

  // R-#299: el formulario edita el **alias** (slug), nunca el `name` (interno, sólo lo
  // cambia el verificador). Un alias tomado responde 409 `slug_taken`.
  const handleSlug = async () => {
    if (!clusterId) return
    setSavingSlug(true)
    try {
      const res = await fetch(`/api/cluster/${clusterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, slug: newSlug }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data?.code === 'slug_invalid') throw new Error(t('aliasInvalid'))
        if (data?.code === 'slug_taken') {
          throw new Error(data.suggestion ? `${t('aliasTaken')} "${data.suggestion}"` : t('aliasTaken'))
        }
        throw new Error(data.error || t('error'))
      }
      toast({ title: t('aliasSaved') })
      setEditingSlug(false)
      await refresh()
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
    } finally {
      setSavingSlug(false)
    }
  }

  // El fondo de ClusterFundsV2 está indexado por la billetera: cambiarla con saldo deja
  // los fondos viejos huérfanos (R-#161 §riesgos). La API responde 409 con
  // `cluster_wallet_has_funds` y aquí se pide confirmación antes de reintentar.
  const handleWallet = async (confirmMigrate = false) => {
    if (!clusterId) return
    setSavingWallet(true)
    try {
      const res = await fetch(`/api/cluster/${clusterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          clusterWallet: newWallet.trim(),
          ...(confirmMigrate ? { confirmMigrate: true } : {}),
        }),
      })
      if (res.status === 409 && !confirmMigrate) {
        const data = await res.json().catch(() => ({}))
        if (data?.code === 'cluster_wallet_has_funds') {
          const funds = data.funds ? ` (${data.funds.usdt} USDT / ${data.funds.slearn} SLEARN)` : ''
          if (window.confirm(t('walletHasFunds').replace('{{0}}', funds))) {
            setSavingWallet(false)
            await handleWallet(true)
          }
          return
        }
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save the wallet')
      }
      toast({ title: t('walletSaved') })
      setEditingWallet(false)
      await refresh()
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
    } finally {
      setSavingWallet(false)
    }
  }

  const invite = async (body: Record<string, unknown>, okMessage: string) => {
    setInviting(true)
    setInviteMessage('')
    try {
      const res = await fetch('/api/cluster/invitation/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, ...body }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data?.code === 'not_invitable' && data.reason) {
          const label = REASON_LABELS[data.reason]
          throw new Error(label ? (lang === 'es' ? label.es : label.en) : data.error)
        }
        throw new Error(data.error || t('error'))
      }
      toast({ title: okMessage })
      setInviteWallet('')
      await refresh()
    } catch (e: any) {
      setInviteMessage(e.message)
    } finally {
      setInviting(false)
    }
  }

  const handlePresentationRequest = async () => {
    if (!clusterId) return
    setRequesting(true)
    try {
      const res = await fetch(`/api/cluster/${clusterId}/gd-presentation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        // El 400 del servidor trae los motivos en palabras: se muestran para que el
        // iniciador sepa qué falta en vez de leer sólo "not ready".
        const reasons: string[] = Array.isArray(data.reasons) ? data.reasons : []
        const head = data.error || t('gdRequestError')
        throw new Error(
          reasons.length ? `${head}: ${reasons.join('; ')}` : head,
        )
      }
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
        <p className="text-red-600">{error || t('noCluster')}</p>
        <Link href={`/${lang}`} className="text-blue-600 hover:underline mt-4 inline-block">
          ← {t('back')}
        </Link>
      </div>
    )
  }

  const complete = cluster.member_count >= MIN_CHURCHES || cluster.status === 'active'

  const invitationsCard = isAuthenticated && isInitiator && (
    <div className="mb-6 p-3 bg-gray-50 rounded-md border border-gray-200 text-left">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">{t('invitations')}</h3>
      <p className="text-xs text-gray-600 mb-2">{t('inviteIntro')}</p>

      {candidates.length > 0 ? (
        <>
          <p className="text-xs font-medium text-gray-600 mb-1">{t('candidates')}</p>
          <ul className="text-xs space-y-1 mb-2">
            {candidates.map((c) => {
              const already = invitations.some((i) => i.church_name === c.church_name)
              return (
                <li key={c.usuario_id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 break-words">{c.nombre || c.nusuario} — {c.church_name}</span>
                  {already ? (
                    <span className="text-gray-400 shrink-0">{t('invitationPending')}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => invite({ usuarioId: c.usuario_id }, t('inviteSent'))}
                      disabled={inviting}
                      className="text-blue-600 hover:underline shrink-0 disabled:opacity-50"
                    >
                      {t('inviteSend')}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <div className="space-y-1 mb-2">
          <p className="text-xs text-gray-500">{t('noCandidates')}</p>
          <a href={`/${lang}/referrals`} className="text-xs text-blue-600 hover:underline">
            {t('referralsLink')}
          </a>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className="text-xs text-gray-600">{t('inviteWallet')}</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={inviteWallet}
            onChange={(e) => setInviteWallet(e.target.value.trim())}
            placeholder="0x…"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-xs font-mono"
          />
          <deps.Button
            size="sm"
            onClick={() => invite({ invitedWallet: inviteWallet }, t('inviteSent'))}
            disabled={inviting || !/^0x[0-9a-fA-F]{40}$/.test(inviteWallet)}
          >
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('inviteSend')}
          </deps.Button>
        </div>
        {inviteMessage && <p className="text-xs text-red-600">{inviteMessage}</p>}
      </div>

      {invitations.length > 0 && (
        <ul className="text-xs space-y-1 mt-3">
          {invitations.map((inv) => {
            const rejected = inv.status === 'rejected'
            const final = rejected && Number(inv.invite_count ?? 1) >= 2
            const label = inv.status === 'accepted'
              ? t('invitationAccepted')
              : rejected
                ? (final ? t('invitationFinal') : t('invitationRejected'))
                : t('invitationPending')
            return (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-words">{inv.church_name} · <span className="text-gray-500">{label}</span></span>
                {rejected && !final && (
                  <button
                    type="button"
                    onClick={() => invite({ invitationId: inv.id }, t('invitationReinvited'))}
                    disabled={inviting}
                    className="text-blue-600 hover:underline disabled:opacity-50"
                  >
                    {t('reinvite')}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )

  const historyBlock = cluster.history.length > 0 && (
    <>
      <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('history')}</h2>
      <ul className="space-y-2 text-sm text-gray-600">
        {cluster.history.map((h, i) => {
          const labels = HISTORY_LABELS[h.event_type] || { en: h.event_type, es: h.event_type }
          const label = lang === 'es' ? labels.es : labels.en
          let detail = ''
          if (h.event_type === 'name_change' || h.event_type === 'slug_change') {
            detail = `: "${h.old_value}" → "${h.new_value}"`
          } else if (h.event_type === 'church_join' || h.event_type === 'church_leave') {
            detail = `: ${h.new_value || h.old_value}`
          } else if (h.event_type.startsWith('invitation_')) {
            detail = `: ${h.new_value || h.old_value || ''}`
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
  )

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
              {complete ? `✅ ${t('formed')}` : `⏳ ${t('inProgress')}`}
              {' · '}
              {cluster.member_count} {t('churches')}
            </p>
          </div>
          {isAuthenticated && isInitiator && (
            <deps.Button variant="outline" size="sm" onClick={() => { setEditingSlug(!editingSlug); setNewSlug(cluster.slug) }}>
              {t('alias')}
            </deps.Button>
          )}
        </div>

        <div className="mb-4 p-3 bg-gray-50 rounded-md border border-gray-200 text-left">
          <p className="text-xs text-gray-600 mb-1">{t('alias')}</p>
          {editingSlug ? (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value.toLowerCase())}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                maxLength={40}
                minLength={2}
              />
              <p className="text-xs text-gray-500">{t('aliasHint')}</p>
              <div className="flex gap-2">
                <deps.Button size="sm" onClick={handleSlug} disabled={savingSlug}>
                  {t('aliasSave')}
                </deps.Button>
                <deps.Button size="sm" variant="outline" onClick={() => { setEditingSlug(false); setNewSlug(cluster.slug) }}>
                  {t('cancel')}
                </deps.Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href={`/${lang}/clusters/${cluster.slug}`} className="text-sm font-mono text-blue-600 hover:underline break-all">
                {cluster.slug}
              </Link>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/${lang}/clusters/${cluster.slug}`)
                  toast({ title: t('copied') })
                }}
                className="text-xs text-blue-600 hover:underline shrink-0"
              >
                {t('copy')}
              </button>
            </div>
          )}
        </div>

        {invitationsCard}

        {complete && (
          <>
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
                    <deps.Button size="sm" onClick={() => handleWallet()} disabled={savingWallet}>
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
                      <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                        <span className="min-w-0 break-words">
                          {pastor.church_name}
                          {pastor.nombre ? ` · ${pastor.nombre}` : ''}
                        </span>
                        <span className={`min-w-0 break-words text-right ${pastor.missing.length ? 'text-amber-700' : 'text-green-700'}`}>
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
                {presentation.request?.status && presentation.request.status !== 'cancelled' ? (
                  <div className="text-xs text-gray-700 space-y-1">
                    <p>
                      {t('gdRequested')}
                      {presentation.request.requested_at ? ` · ${new Date(presentation.request.requested_at).toLocaleDateString(lang)}` : ''}
                    </p>
                    {presentation.request.returned_at && (
                      <p className="text-amber-700">
                        {t('gdReturned')}
                        {` · ${new Date(presentation.request.returned_at).toLocaleDateString(lang)}`}
                      </p>
                    )}
                    {presentation.request.approved_at && (
                      <p>
                        {t('gdApproved')}
                        {` · ${new Date(presentation.request.approved_at).toLocaleDateString(lang)}`}
                      </p>
                    )}
                    {presentation.request.sent_at && (
                      <p>
                        {t('gdSent')}
                        {` · ${new Date(presentation.request.sent_at).toLocaleDateString(lang)}`}
                      </p>
                    )}
                    {presentation.request.answered_at && (
                      <p>
                        {t('gdAnswered')}
                        {` · ${new Date(presentation.request.answered_at).toLocaleDateString(lang)}`}
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
                        disabled={!presentation.ready || (presentation.missing_data?.length ?? 0) > 0}
                      />
                      <span>{t('gdRequest')}</span>
                    </label>
                    <div>
                      <deps.Button
                        size="sm"
                        onClick={handlePresentationRequest}
                        disabled={!gdConfirmed || !presentation.ready || (presentation.missing_data?.length ?? 0) > 0 || requesting}
                      >
                        {t('gdRequestSend')}
                      </deps.Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {isAuthenticated && presentation && (presentation.isInitiator || presentation.isMember) && (
              <ClusterPresentationPanel
                lang={lang}
                clusterId={cluster.id}
                address={address || null}
                isInitiator={!!presentation.isInitiator}
                onChanged={fetchPresentation}
                Button={deps.Button}
              />
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
          </>
        )}

        <div className="border-t border-gray-200 pt-4 mb-6">
          <deps.Button variant="outline" size="sm" onClick={handleLeave} className="text-red-600 border-red-300 hover:bg-red-50">
            {t('leaveCluster')}
          </deps.Button>
        </div>

        {historyBlock}
      </div>
    </div>
  )
}
