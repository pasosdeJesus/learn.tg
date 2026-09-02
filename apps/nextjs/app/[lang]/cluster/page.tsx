'use client'

// Página /[lang]/cluster — formación de clústeres (https://github.com/pasosdeJesus/learn.tg/issues/220):
// 3 estados: sin clúster (crear), invitación pendiente (aceptar/rechazar),
// en un clúster (detalle + salir). El backend vive en el motor gdcluster
// (/api/cluster/status, /candidates, /invitation/*, /api/cluster).
import { useCallback, useEffect, useState } from 'react'
import { use } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { createComponentT } from '@/lib/hooks/useTranslation'

interface Candidate {
  usuario_id: number
  nombre: string | null
  nusuario: string
  church_id: number
  church_name: string
}

interface Invitation {
  id: number
  clustergd_id: number
  cluster_name: string
  inviter_name: string | null
}

export default function ClusterFormationPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params)
  const es = lang === 'es'
  const { address } = useAuthAddress()

  const t = createComponentT(lang, {
    en: {
      title: 'Cluster',
      loading: 'Loading…',
      noCluster: 'To form a cluster, you need to invite 2 trusted pastors.',
      guide2: 'Guide 2: Form Your Cluster',
      create: 'Create a cluster',
      createTitle: 'New cluster',
      name: 'Cluster name',
      pseudonym: 'Pseudonym (optional, shown publicly in the ranking)',
      candidates: 'Invite pastors (select up to 2)',
      noCandidates: 'You have no invitable pastors yet (referred pastors from the same country with a verified church). You can also share your 6-char cluster code after creating it.',
      creating: 'Creating…',
      invitePending: 'You have been invited to join cluster {{0}} by {{1}}.',
      accept: 'Accept invitation',
      reject: 'Reject invitation',
      inCluster: 'You are in cluster',
      members: 'Members',
      leader: 'Leader',
      leave: 'Leave cluster',
      leaveConfirm: 'Leave this cluster?',
      details: 'View cluster details',
      error: 'Something went wrong. Try again.',
      code: 'Cluster code',
    },
    es: {
      title: 'Clúster',
      loading: 'Cargando…',
      noCluster: 'Para formar un clúster necesitas invitar a 2 pastores de confianza.',
      guide2: 'Guía 2: Forma tu clúster',
      create: 'Crear un clúster',
      createTitle: 'Nuevo clúster',
      name: 'Nombre del clúster',
      pseudonym: 'Pseudónimo (opcional, se muestra públicamente en el ranking)',
      candidates: 'Invitar pastores (elige hasta 2)',
      noCandidates: 'Aún no tienes pastores invitables (referidos del mismo país con iglesia verificada). También puedes compartir el código de 6 caracteres del clúster tras crearlo.',
      creating: 'Creando…',
      invitePending: 'Has sido invitado a unirte al clúster {{0}} por {{1}}.',
      accept: 'Aceptar invitación',
      reject: 'Rechazar invitación',
      inCluster: 'Estás en el clúster',
      members: 'Miembros',
      leader: 'Líder',
      leave: 'Salir del clúster',
      leaveConfirm: '¿Salir de este clúster?',
      details: 'Ver detalles del clúster',
      error: 'Algo salió mal. Inténtalo de nuevo.',
      code: 'Código del clúster',
    },
  })

  const [status, setStatus] = useState<'loading' | 'none' | 'invited' | 'member'>('loading')
  const [cluster, setCluster] = useState<any>(null)
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [pseudonym, setPseudonym] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const authToken = () => (typeof window !== 'undefined' ? localStorage.getItem('learn.tg.authToken') || '' : '')
  const q = () => `walletAddress=${encodeURIComponent(address || '')}&token=${encodeURIComponent(authToken())}`

  const load = useCallback(async () => {
    if (!address) { setStatus('loading'); return }
    try {
      const [sRes, cRes] = await Promise.all([
        axios.get(`/api/cluster/status?${q()}`).catch(() => null),
        axios.get(`/api/cluster/candidates?${q()}`).catch(() => null),
      ])
      const s = sRes?.data
      if (!s) { setStatus('none'); return }
      if (s.hasCluster) {
        setCluster(s.cluster)
        setStatus('member')
      } else if (s.pendingInvitations?.length > 0) {
        setInvitations(s.pendingInvitations.map((i: any) => ({
          id: i.id, clustergd_id: i.clustergd_id, cluster_name: i.pseudonym || i.cluster_name, inviter_name: i.inviter_name,
        })))
        setStatus('invited')
      } else {
        setStatus('none')
      }
      setCandidates(cRes?.data?.candidates ?? [])
    } catch {
      setStatus('none')
    }
  }, [address])

  useEffect(() => { load() }, [load])

  const toggleCandidate = (id: number) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-2))
  }

  const create = async () => {
    if (!name || name.length < 3) { setError(t('name')); return }
    setBusy(true); setError('')
    try {
      const res = await axios.post('/api/cluster', {
        walletAddress: address, token: authToken(), name, pseudonym, inviteeIds: selected,
      })
      if (res.status === 201) {
        setShowCreate(false)
        await load()
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || t('error'))
    } finally { setBusy(false) }
  }

  const respond = async (invitationId: number, action: 'accept' | 'reject') => {
    setBusy(true); setError('')
    try {
      await axios.post(`/api/cluster/invitation/${action}`, {
        walletAddress: address, token: authToken(), invitationId,
      })
      await load()
    } catch (e: any) {
      setError(e?.response?.data?.error || t('error'))
    } finally { setBusy(false) }
  }

  const leave = async () => {
    if (!cluster?.id || !confirm(t('leaveConfirm'))) return
    setBusy(true); setError('')
    try {
      await axios.post(`/api/cluster/${cluster.id}/leave`, { walletAddress: address, token: authToken() })
      await load()
    } catch (e: any) {
      setError(e?.response?.data?.error || t('error'))
    } finally { setBusy(false) }
  }

  const guideHref = es ? `/${lang}/web3-e-ibu/guia2` : `/${lang}/web3-and-ubi/guide2`

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100">
      <div className="container mx-auto py-12 px-4 max-w-2xl">
        <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">🏘️ {t('title')}</h1>

          {status === 'loading' && <p className="text-gray-500">{t('loading')}</p>}

          {status === 'none' && (
            <div>
              <p className="text-gray-700 mb-4">{t('noCluster')}</p>
              <Link href={guideHref} className="inline-block text-blue-600 underline mb-6">
                {t('guide2')}
              </Link>
              <div>
                <button
                  onClick={() => setShowCreate((v) => !v)}
                  className="rounded bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
                >
                  {t('create')}
                </button>
              </div>

              {showCreate && (
                <div className="mt-6 text-left rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-4">
                  <h2 className="font-semibold text-gray-800">{t('createTitle')}</h2>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">{t('name')}</label>
                    <input value={name} onChange={(e) => setName(e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">{t('pseudonym')}</label>
                    <input value={pseudonym} onChange={(e) => setPseudonym(e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">{t('candidates')}</label>
                    {candidates.length === 0 ? (
                      <p className="text-xs text-gray-500">{t('noCandidates')}</p>
                    ) : (
                      <div className="space-y-1">
                        {candidates.map((c) => (
                          <label key={c.usuario_id} className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={selected.includes(c.usuario_id)}
                              onChange={() => toggleCandidate(c.usuario_id)} />
                            {c.nombre || c.nusuario} — {c.church_name}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <button onClick={create} disabled={busy}
                    className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                    {busy ? t('creating') : t('create')}
                  </button>
                </div>
              )}
            </div>
          )}

          {status === 'invited' && (
            <div className="space-y-4">
              {invitations.map((inv) => (
                <div key={inv.id} className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-left">
                  <p className="text-gray-700 mb-4">
                    {t('invitePending', inv.cluster_name, inv.inviter_name || '—')}
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => respond(inv.id, 'accept')} disabled={busy}
                      className="rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                      {t('accept')}
                    </button>
                    <button onClick={() => respond(inv.id, 'reject')} disabled={busy}
                      className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                      {t('reject')}
                    </button>
                  </div>
                </div>
              ))}
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          )}

          {status === 'member' && cluster && (
            <div className="text-left space-y-3">
              <p className="text-gray-700 font-medium">{t('inCluster')} <span className="font-bold">{cluster.pseudonym || cluster.name}</span></p>
              <p className="text-sm text-gray-500">{t('code')}: <span className="font-mono">{cluster.code}</span></p>
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-1">{t('members')} ({cluster.member_count})</p>
                <ul className="space-y-1 text-sm text-gray-700">
                  {cluster.members?.map((m: any, i: number) => (
                    <li key={i} className="rounded bg-gray-50 border px-3 py-1.5 flex justify-between">
                      <span>{m.church_name}</span>
                      {i === 0 && <span className="text-xs text-blue-600 font-medium">{t('leader')}</span>}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex gap-3">
                <Link href={`/${lang}/cluster/${cluster.id}`}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                  {t('details')}
                </Link>
                <button onClick={leave} disabled={busy}
                  className="rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                  {t('leave')}
                </button>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
