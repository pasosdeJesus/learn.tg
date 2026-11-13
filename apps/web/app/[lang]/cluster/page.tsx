'use client'

// Página /[lang]/cluster — la **única** página privada del clúster (R-#299 §6).
// Resuelve el clúster del pastor con /api/cluster/status y muestra: creación +
// invitaciones (sin clúster), Sí/No (invitación pendiente) o el clúster completo
// (ClusterPageHost, sin `id` en la URL). El detalle vive en el motor gdcluster.
import { useCallback, useEffect, useState } from 'react'
import { use } from 'react'
import Link from 'next/link'
import { suggestSlug } from '@learn-tg/gdcluster/lib/slug'
import { useAuthedApi } from '@/lib/hooks/useAuthedApi'
import { useAuthAddress } from '@/lib/hooks/useAuthAddress'
import { createComponentT } from '@/lib/hooks/useTranslation'
import { ClusterPageHost } from '@/lib/gdcluster-ui'

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
  slug: string
  inviter_name: string | null
}

export default function ClusterPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params)
  const es = lang === 'es'
  const { address } = useAuthAddress()
  const { authedGet, authedPost } = useAuthedApi()

  const t = createComponentT(lang, {
    en: {
      title: 'Cluster',
      loading: 'Loading…',
      noCluster: 'To form a cluster, you need to invite 2 trusted pastors.',
      guide2: 'Guide 2: Form Your Cluster',
      create: 'Create a cluster',
      createTitle: 'New cluster',
      name: 'Cluster name (internal)',
      slug: 'Public alias',
      slugHint: 'This is the public name of the cluster: lowercase letters, digits and hyphens. It is suggested from the cluster name and you can change it.',
      candidates: 'Invite pastors (select up to 2)',
      noCandidatesHelp: 'Candidates come from your referrals: pastors you invited to learn.tg or the pastor who invited you, in your country, with a verified church.',
      referralsLink: 'Go to referrals',
      noCandidates: 'You have no invitable pastors yet (referred pastors from the same country with a verified church). You can invite by wallet from the cluster page after creating it.',
      creating: 'Creating…',
      invitePending: 'You have been invited to join cluster {{0}} by {{1}}.',
      accept: 'Accept invitation',
      reject: 'Reject invitation',
      error: 'Something went wrong. Try again.',
      notPastor: 'Only lead pastors of a verified church can create a cluster.',
    },
    es: {
      title: 'Clúster',
      loading: 'Cargando…',
      noCluster: 'Para formar un clúster necesitas invitar a 2 pastores de confianza.',
      guide2: 'Guía 2: Forma tu clúster',
      create: 'Crear un clúster',
      createTitle: 'Nuevo clúster',
      name: 'Nombre del clúster (interno)',
      slug: 'Alias público',
      slugHint: 'Es el nombre público del clúster: minúsculas, dígitos y guiones. Se sugiere a partir del nombre del clúster y lo puedes cambiar.',
      candidates: 'Invitar pastores (elige hasta 2)',
      noCandidatesHelp: 'Los candidatos salen de tus referidos: pastores que invitaste a learn.tg o el pastor que te invitó, en tu país, con iglesia verificada.',
      referralsLink: 'Ir a referidos',
      noCandidates: 'Aún no tienes pastores invitables (referidos del mismo país con iglesia verificada). Puedes invitar por billetera desde la página del clúster después de crearlo.',
      creating: 'Creando…',
      invitePending: 'Has sido invitado a unirte al clúster {{0}} por {{1}}.',
      accept: 'Aceptar invitación',
      reject: 'Rechazar invitación',
      error: 'Algo salió mal. Inténtalo de nuevo.',
      notPastor: 'Sólo el pastor principal de una iglesia verificada puede crear un clúster.',
    },
  })

  const [status, setStatus] = useState<'loading' | 'none' | 'invited' | 'member'>('loading')
  const [clusterId, setClusterId] = useState<string | null>(null)
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!address) { setStatus('loading'); return }
    try {
      const [sRes, cRes] = await Promise.all([
        authedGet<any>('/api/cluster/status').catch(() => null),
        authedGet<any>('/api/cluster/candidates').catch(() => null),
      ])
      const s = sRes?.data
      if (!s) { setStatus('none'); return }
      if (s.hasCluster && s.clusterId) {
        setClusterId(String(s.clusterId))
        setStatus('member')
      } else if (s.pendingInvitations?.length > 0) {
        setInvitations(s.pendingInvitations.map((i: any) => ({
          id: i.id, clustergd_id: i.clustergd_id, cluster_name: i.slug || i.cluster_name, slug: i.slug, inviter_name: i.inviter_name,
        })))
        setStatus('invited')
      } else {
        setStatus('none')
      }
      setCandidates(cRes?.data?.candidates ?? [])
    } catch {
      setStatus('none')
    }
  }, [address, authedGet])

  useEffect(() => { load() }, [load])

  // El alias se sugiere con las iniciales del nombre (R-#299 §4) y el iniciador lo puede
  // editar antes de crear el clúster; si lo editó, no se vuelve a recalcular.
  const onNameChange = (value: string) => {
    setName(value)
    if (!slugEdited) setSlug(suggestSlug(value))
  }

  const toggleCandidate = (id: number) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-2))
  }

  const create = async () => {
    if (!name || name.length < 3) { setError(t('name')); return }
    setBusy(true); setError('')
    try {
      const res = await authedPost('/api/cluster', { name, slug: slug || undefined, inviteeIds: selected })
      if (res.status === 201) {
        setShowCreate(false)
        await load()
      }
    } catch (e: any) {
      const data = e?.response?.data ?? {}
      if (data.code === 'slug_taken') setError(`${t('slug')}: ${data.error}`)
      else setError(data.error || t('error'))
    } finally { setBusy(false) }
  }

  const respond = async (invitationId: number, action: 'accept' | 'reject') => {
    setBusy(true); setError('')
    try {
      await authedPost(`/api/cluster/invitation/${action}`, { invitationId })
      await load()
    } catch (e: any) {
      setError(e?.response?.data?.error || t('error'))
    } finally { setBusy(false) }
  }

  const guideHref = es ? `/${lang}/redgd/guia2` : `/${lang}/gdcluster/guide2`

  if (status === 'member' && clusterId) {
    return <ClusterPageHost lang={lang} />
  }

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
                    <input value={name} onChange={(e) => onNameChange(e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">{t('slug')}</label>
                    <input
                      value={slug}
                      onChange={(e) => { setSlug(e.target.value.toLowerCase()); setSlugEdited(true) }}
                      maxLength={40}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono" />
                    <p className="text-xs text-gray-500 mt-1">{t('slugHint')}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">{t('candidates')}</label>
                    {candidates.length === 0 ? (
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">{t('noCandidates')}</p>
                        <p className="text-xs text-gray-600">{t('noCandidatesHelp')}</p>
                        <a href={`/${lang}/referrals`} className="text-xs text-blue-600 hover:underline">
                          {t('referralsLink')}
                        </a>
                      </div>
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
                    {t('invitePending', inv.slug || inv.cluster_name, inv.inviter_name || '—')}
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
        </div>
      </div>
    </div>
  )
}
