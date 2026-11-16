'use client'

import { useCallback, useEffect, useState } from 'react'

// Presupuesto del primer año, oferta del director y retiro del fondo del clúster
// (https://github.com/pasosdeJesus/learn.tg/issues/161). El motor `gdcluster` expone el
// estado de la presentación con los datos fijos y las claves de lo que falta; este panel
// edita esos datos mientras no estén fijos y recoge la aprobación de cada pastor con la que
// se solicita la revisión de pdJ (la liberación es automática cuando GD responde).
//
// Los PDF se suben a `/api/cluster/[id]/document` (el servidor los guarda fuera de
// `public/`); el total y los números se envían a `/api/cluster/[id]/budget|director`.
// El retiro solo se **registra**: `ClusterFundsV2.releaseClusterFunds` es onlyOwner, así
// que la transferencia la ejecuta el operador cuando `release_ready` es verdadero.

type Presentation = {
  missing_data: string[]
  request: {
    status: string | null
    locked: boolean
    evaluation?: string | null
    suggestions?: string | null
    fourth_year_budget?: number | null
    budget_draft_path?: string | null
    budget_fixed_at?: string | null
    director_offer_path?: string | null
    director_first_year_pay?: number | null
    director_first_year_hours?: number | null
    director_fixed_at?: string | null
  } | null
  wallet?: string | null
  can_approve?: boolean
  wallet_approvals?: {
    pastors: number
    approved: number
    all_approved: boolean
    voters: number[]
  } | null
  approvals?: {
    pastors: number
    approved: number
    all_approved: boolean
    voters: number[]
  }
}


const LABELS: Record<string, { en: string; es: string }> = {
  budget: { en: 'Fourth year budget', es: 'Presupuesto del cuarto año' },
  budgetHint: {
    en: 'Global Disciples funds the first three years: this is the budget for the fourth year, when the cluster stands on its own. Upload the draft budget (PDF) and enter the total; both stay editable until you request the presentation.',
    es: 'Global Disciples financia los tres primeros años: este es el presupuesto del cuarto año, cuando el clúster camina solo. Sube el borrador del presupuesto (PDF) y escribe el total; ambos siguen editables hasta que solicites la presentación.',
  },
  budgetTotal: { en: 'Total for the fourth year (USDT)', es: 'Total del cuarto año (USDT)' },
  budgetPdf: { en: 'Draft budget (PDF)', es: 'Borrador del presupuesto (PDF)' },
  director: { en: 'Program director', es: 'Director del programa' },
  directorHint: {
    en: 'Upload the job offer with the months-vs-functions matrix, the total pay for the first year and the expected hours.',
    es: 'Sube la oferta de trabajo con la matriz de meses y funciones, el pago total del primer año y las horas esperadas.',
  },
  directorPdf: { en: 'Job offer (PDF)', es: 'Oferta de trabajo (PDF)' },
  directorPay: { en: 'Total pay, first year (USDT)', es: 'Pago total, primer año (USDT)' },
  directorHours: { en: 'Expected hours, first year', es: 'Horas esperadas, primer año' },
  save: { en: 'Save', es: 'Guardar' },
  saved: { en: 'Saved', es: 'Guardado' },
  locked: {
    en: 'The presentation was requested: these data are fixed.',
    es: 'La presentación fue solicitada: estos datos están fijos.',
  },
  viewPdf: { en: 'View PDF', es: 'Ver PDF' },
  approvals: { en: 'Pastors approval', es: 'Aprobación de los pastores' },
  approvalsHint: {
    en: 'Each pastor presses the button to confirm that they know and approve what will be sent to Global Disciples (first-year budget and director offer) and the cluster wallet. With every approval the initiator can request pdJ review.',
    es: 'Cada pastor pulsa el botón para confirmar que conoce y aprueba lo que se enviará a Global Disciples (presupuesto del primer año y oferta del director) y la billetera del clúster. Con todas las aprobaciones el iniciador puede pedir la revisión de pdJ.',
  },
  approvalsCount: { en: '{{0}} of {{1}} pastors approved', es: '{{0}} de {{1}} pastores aprobaron' },
  approve: { en: 'I know and approve the data and the wallet', es: 'Conozco y apruebo los datos y la billetera' },
  approvedNotice: { en: 'Your approval is recorded', es: 'Tu aprobación quedó registrada' },
  approvalsComplete: { en: 'All the pastors approved the data: the initiator can ask pdJ to review it.', es: 'Todos los pastores aprobaron los datos: el iniciador puede pedir la revisión de pdJ.' },
  walletApprovalsPending: {
    en: 'The pastors have not approved the cluster wallet yet: the fund does not exist until they do, and the data approval comes after that.',
    es: 'Los pastores aún no aprueban la billetera del clúster: el fondo no existe hasta que lo hagan, y la aprobación de los datos viene después.',
  },
  walletPending: { en: 'The cluster wallet is not set.', es: 'La billetera del clúster no está configurada.' },
  cancel: { en: 'Cancel the request', es: 'Cancelar la solicitud' },
  cancelHint: {
    en: 'You can cancel while pdJ has not reviewed it; the data are unlocked again.',
    es: 'Puedes cancelar mientras pdJ no la haya revisado; los datos se desbloquean otra vez.',
  },
  evaluation: { en: 'pdJ evaluation', es: 'Evaluación de pdJ' },
  suggestions: { en: 'Suggestions', es: 'Sugerencias' },
  missingData: {
    en: 'Before requesting the presentation you must complete:',
    es: 'Antes de solicitar la presentación debes completar:',
  },
  error: { en: 'Could not save', es: 'No se pudo guardar' },
  upload: { en: 'Upload', es: 'Subir' },
  remove: { en: 'Remove', es: 'Quitar' },
}

const MISSING: Record<string, { en: string; es: string }> = {
  budget_total: { en: 'the total for the fourth year', es: 'el total del cuarto año' },
  budget_pdf: { en: 'the draft budget PDF', es: 'el PDF del borrador del presupuesto' },
  director_offer_pdf: { en: 'the job offer PDF', es: 'el PDF de la oferta de trabajo' },
  director_pay: { en: 'the total pay for the first year', es: 'el pago total del primer año' },
  director_hours: { en: 'the expected hours for the first year', es: 'las horas esperadas del primer año' },
}

type PanelSection = 'all' | 'budget' | 'director' | 'approvals' | 'cancel'

export function ClusterPresentationPanel({
  lang,
  clusterId,
  address,
  isInitiator,
  onChanged,
  Button,
  section = 'all',
}: {
  lang: string
  clusterId: number
  address: string | null
  isInitiator: boolean
  onChanged?: () => void
  Button: any
  /**
   * Qué parte se pinta. La página del clúster usa una tarjeta por sección, en el orden
   * presupuesto → director → aprobación → solicitud (R-#299 follow-up); con `'all'`
   * (por defecto) se pintan todas juntas y cada una con su encabezado.
   */
  section?: PanelSection
}) {
  const shows = (name: Exclude<PanelSection, 'all'>) => section === 'all' || section === name
  const ownHeading = section === 'all'
  const tr = (key: keyof typeof LABELS, ...args: string[]) => {
    const labels = LABELS[key] ?? { en: String(key), es: String(key) }
    const value = (lang === 'es' ? labels.es : labels.en) as string
    return args.reduce((acc, arg, index) => acc.replace(`{{${index}}}`, arg), value)
  }

  const [presentation, setPresentation] = useState<Presentation | null>(null)
  const [budget, setBudget] = useState('')
  const [directorPay, setDirectorPay] = useState('')
  const [directorHours, setDirectorHours] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!address) return
    const query = `?walletAddress=${encodeURIComponent(address)}`
    try {
      const presentationRes = await fetch(`/api/cluster/${clusterId}/gd-presentation${query}`)
      const presentationData = presentationRes.ok ? await presentationRes.json() : null
      setPresentation(presentationData)
      setBudget(presentationData?.request?.fourth_year_budget != null ? String(presentationData.request.fourth_year_budget) : '')
      setDirectorPay(
        presentationData?.request?.director_first_year_pay != null ? String(presentationData.request.director_first_year_pay) : '',
      )
      setDirectorHours(
        presentationData?.request?.director_first_year_hours != null
          ? String(presentationData.request.director_first_year_hours)
          : '',
      )
    } catch {
      setPresentation(null)
    }
  }, [address, clusterId])

  useEffect(() => { load() }, [load])

  const request = presentation?.request ?? null
  const locked = !!request?.locked
  const missingData = presentation?.missing_data ?? []

  const save = async (kind: 'budget' | 'director') => {
    if (!address) return
    setBusy(kind)
    setError(null)
    setNotice(null)
    try {
      const body = kind === 'budget'
        ? { walletAddress: address, ...(budget ? { fourthYearBudget: Number(budget) } : {}) }
        : {
            walletAddress: address,
            ...(directorPay ? { directorFirstYearPay: Number(directorPay) } : {}),
            ...(directorHours ? { directorFirstYearHours: Number(directorHours) } : {}),
          }
      const res = await fetch(`/api/cluster/${clusterId}/${kind}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || tr('error'))
      setNotice(tr('saved'))
      await load()
      onChanged?.()
    } catch (err: any) {
      setError(err.message || tr('error'))
    } finally {
      setBusy(null)
    }
  }

  const upload = async (side: 'budget' | 'director', file: File | null) => {
    if (!address || !file) return
    setBusy(`upload-${side}`)
    setError(null)
    setNotice(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('side', side)
      form.append('walletAddress', address)
      const res = await fetch(`/api/cluster/${clusterId}/document`, { method: 'POST', body: form })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || tr('error'))
      await load()
      onChanged?.()
    } catch (err: any) {
      setError(err.message || tr('error'))
    } finally {
      setBusy(null)
    }
  }

  const approve = async () => {
    if (!address) return
    setBusy('approve')
    setError(null)
    try {
      const res = await fetch(`/api/cluster/${clusterId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || tr('error'))
      setNotice(tr('approvedNotice'))
      await load()
      onChanged?.()
    } catch (err: any) {
      setError(err.message || tr('error'))
    } finally {
      setBusy(null)
    }
  }

  const cancel = async () => {
    if (!address) return
    setBusy('cancel')
    setError(null)
    try {
      const res = await fetch(`/api/cluster/${clusterId}/gd-presentation?walletAddress=${encodeURIComponent(address)}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || tr('error'))
      await load()
      onChanged?.()
    } catch (err: any) {
      setError(err.message || tr('error'))
    } finally {
      setBusy(null)
    }
  }

  const pdfUrl = (side: 'budget' | 'director') =>
    `/api/cluster/${clusterId}/document?side=${side}${address ? `&walletAddress=${encodeURIComponent(address)}` : ''}`

  return (
    <div className="space-y-4">
      {isInitiator && missingData.length > 0 && !locked && (section === 'all' || section === 'cancel') && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-semibold mb-1">{tr('missingData')}</p>
          <ul className="list-disc ml-4">
            {missingData.map((key) => (
              <li key={key}>{lang === 'es' ? MISSING[key]?.es ?? key : MISSING[key]?.en ?? key}</li>
            ))}
          </ul>
        </div>
      )}

      {/* La evaluación y las sugerencias de pdJ pertenecen a la tarjeta «Present to
          Global Disciples»: sin el filtro se repetían en las cuatro tarjetas. */}
      {(section === 'all' || section === 'cancel') && request && (request.evaluation || request.suggestions) && (
        <div className="rounded border border-gray-200 bg-white p-3 text-xs text-gray-700 space-y-1">
          {request.evaluation && (
            <p><span className="font-semibold">{tr('evaluation')}:</span> {request.evaluation}</p>
          )}
          {request.suggestions && (
            <p className="whitespace-pre-wrap"><span className="font-semibold">{tr('suggestions')}:</span> {request.suggestions}</p>
          )}
        </div>
      )}

      {shows('budget') && <section>
        {ownHeading && <h3 className="text-sm font-semibold text-gray-900">{tr('budget')}</h3>}
        <p className="text-xs text-gray-600 mb-2">{locked ? tr('locked') : tr('budgetHint')}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-gray-700">
            {tr('budgetTotal')}
            <input
              type="number"
              min="0"
              step="0.01"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              disabled={locked || !isInitiator}
              className="mt-1 w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
            />
          </label>
          <div className="text-xs text-gray-700">
            {tr('budgetPdf')}
            <div className="mt-1 flex items-center gap-2">
              {request?.budget_draft_path ? (
                <a href={pdfUrl('budget')} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {tr('viewPdf')}
                </a>
              ) : (
                <span className="text-gray-400">—</span>
              )}
              {isInitiator && !locked && (
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => upload('budget', e.target.files?.[0] ?? null)}
                  className="text-xs"
                />
              )}
            </div>
          </div>
        </div>
        {isInitiator && !locked && (
          <div className="mt-2">
            <Button size="sm" onClick={() => save('budget')} disabled={busy === 'budget'}>
              {tr('save')}
            </Button>
          </div>
        )}
      </section>}

      {shows('director') && <section>
        {ownHeading && <h3 className="text-sm font-semibold text-gray-900">{tr('director')}</h3>}
        <p className="text-xs text-gray-600 mb-2">{locked ? tr('locked') : tr('directorHint')}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="text-xs text-gray-700">
            {tr('directorPay')}
            <input
              type="number"
              min="0"
              step="0.01"
              value={directorPay}
              onChange={(e) => setDirectorPay(e.target.value)}
              disabled={locked || !isInitiator}
              className="mt-1 w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
            />
          </label>
          <label className="text-xs text-gray-700">
            {tr('directorHours')}
            <input
              type="number"
              min="0"
              step="0.01"
              value={directorHours}
              onChange={(e) => setDirectorHours(e.target.value)}
              disabled={locked || !isInitiator}
              className="mt-1 w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
            />
          </label>
          <div className="text-xs text-gray-700">
            {tr('directorPdf')}
            <div className="mt-1 flex items-center gap-2">
              {request?.director_offer_path ? (
                <a href={pdfUrl('director')} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {tr('viewPdf')}
                </a>
              ) : (
                <span className="text-gray-400">—</span>
              )}
              {isInitiator && !locked && (
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => upload('director', e.target.files?.[0] ?? null)}
                  className="text-xs"
                />
              )}
            </div>
          </div>
        </div>
        {isInitiator && !locked && (
          <div className="mt-2">
            <Button size="sm" onClick={() => save('director')} disabled={busy === 'director'}>
              {tr('save')}
            </Button>
          </div>
        )}
      </section>}

      {shows('cancel') && isInitiator && request?.status === 'requested' && (
        <section>
          <p className="text-xs text-gray-600 mb-1">{tr('cancelHint')}</p>
          <Button variant="outline" size="sm" onClick={cancel} disabled={busy === 'cancel'} className="text-red-600 border-red-300 hover:bg-red-50">
            {tr('cancel')}
          </Button>
        </section>
      )}

      {shows('approvals') && <section>
        {ownHeading && <h3 className="text-sm font-semibold text-gray-900">{tr('approvals')}</h3>}
        <p className="text-xs text-gray-600 mb-2">{tr('approvalsHint')}</p>
        {presentation && (
          <div className="text-xs text-gray-700 space-y-1">
            {!presentation.wallet && <p className="text-amber-700">{tr('walletPending')}</p>}
            {presentation.wallet_approvals && !presentation.wallet_approvals.all_approved && (
              <p className="text-amber-700">{tr('walletApprovalsPending')}</p>
            )}
            {presentation.approvals && (
              <p>{tr('approvalsCount', String(presentation.approvals.approved), String(presentation.approvals.pastors))}</p>
            )}
            {presentation.approvals?.all_approved ? (
              <p className="font-semibold text-green-700">{tr('approvalsComplete')}</p>
            ) : presentation.can_approve ? (
              <div className="pt-1">
                <Button
                  size="sm"
                  onClick={approve}
                  disabled={
                    busy === 'approve'
                    || !presentation.wallet
                    || !presentation.wallet_approvals?.all_approved
                  }
                >
                  {tr('approve')}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </section>}

      {notice && <p className="text-xs text-green-700">{notice}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
