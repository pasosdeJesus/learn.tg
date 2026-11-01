'use client'

import { useCallback, useEffect, useState } from 'react'

// Presupuesto del primer año, oferta del director y retiro del fondo del clúster
// (https://github.com/pasosdeJesus/learn.tg/issues/161). El motor `gdcluster` expone el
// estado de la presentación con los datos fijos y las claves de lo que falta; este panel
// edita esos datos mientras no estén fijos y registra el Withdraw de cada pastor.
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
    first_year_budget?: number | null
    budget_draft_path?: string | null
    budget_fixed_at?: string | null
    director_offer_path?: string | null
    director_first_year_pay?: number | null
    director_first_year_hours?: number | null
    director_fixed_at?: string | null
  } | null
}

type WithdrawState = {
  can_vote?: boolean
  votes: {
    pastors: number
    voted: number
    all_voted: boolean
    votes: { usuario_id: number; nombre: string | null; created_at: string | null }[]
  }
  wallet: string | null
  gd_status?: string | null
  armed?: boolean
  ranking_exited_at: string | null
  fund_released_at: string | null
  release: {
    votes_complete: boolean
    budget_reached: boolean
    release_ready: boolean
    budget: number | null
    usdt: string | null
    slearn: string | null
  }
}

const LABELS: Record<string, { en: string; es: string }> = {
  budget: { en: 'First-year budget', es: 'Presupuesto del primer año' },
  budgetHint: {
    en: 'Upload the draft budget (PDF) and enter the total for the first year. Both stay editable until you request the presentation.',
    es: 'Sube el borrador del presupuesto (PDF) y escribe el total del primer año. Ambos siguen editables hasta que solicites la presentación.',
  },
  budgetTotal: { en: 'Total for the first year (USDT)', es: 'Total del primer año (USDT)' },
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
  withdraw: { en: 'Withdraw the cluster fund', es: 'Retirar el fondo del clúster' },
  withdrawHint: {
    en: 'The withdrawal is total and happens when every pastor has pressed Withdraw; the buttons are enabled when Global Disciples answers. The first one takes the cluster out of the ranking (irreversible), but the 10% of purchases and scholarships keeps arriving until the fund is released.',
    es: 'El retiro es total y procede cuando todos los pastores han pulsado Retirar; los botones se habilitan cuando Global Disciples responde. El primero saca al clúster del ranking (irreversible), pero el 10% de compras y becas sigue llegando hasta que el fondo se libere.',
  },
  armedHint: {
    en: 'The Withdraw buttons are enabled when Global Disciples answers.',
    es: 'Los botones de Retirar se habilitan cuando Global Disciples responde.',
  },
  releasedAt: { en: 'Fund released', es: 'Fondo liberado' },
  withdrawVotes: { en: '{{0}} of {{1}} pastors have pressed Withdraw', es: '{{0}} de {{1}} pastores han pulsado Withdraw' },
  withdrawCast: { en: 'Press Withdraw', es: 'Pulsar Withdraw' },
  withdrawDone: { en: 'Your Withdraw is recorded', es: 'Tu Withdraw quedó registrado' },
  releasedHint: {
    en: 'The fund was transferred to the cluster wallet. From now on the 10% of purchases and scholarships of these churches goes to the country fund.',
    es: 'El fondo se entregó a la billetera del clúster. Desde ahora el 10% de compras y becas de estas iglesias va al fondo del país.',
  },
  rankingExit: { en: 'Out of the ranking since', es: 'Fuera del ranking desde' },
  balance: { en: 'Fund balance', es: 'Saldo del fondo' },
  missingData: {
    en: 'To request the presentation the budget and the director offer must be complete:',
    es: 'Para solicitar la presentación el presupuesto y la oferta del director deben estar completos:',
  },
  cancel: { en: 'Cancel the request', es: 'Cancelar la solicitud' },
  cancelHint: {
    en: 'You can cancel while pdJ has not reviewed it; the data are unlocked again.',
    es: 'Puedes cancelar mientras pdJ no la haya revisado; los datos se desbloquean otra vez.',
  },
  evaluation: { en: 'pdJ evaluation', es: 'Evaluación de pdJ' },
  suggestions: { en: 'Suggestions', es: 'Sugerencias' },
  error: { en: 'Could not save', es: 'No se pudo guardar' },
  upload: { en: 'Upload', es: 'Subir' },
  remove: { en: 'Remove', es: 'Quitar' },
}

const MISSING: Record<string, { en: string; es: string }> = {
  budget_total: { en: 'the total for the first year', es: 'el total del primer año' },
  budget_pdf: { en: 'the draft budget PDF', es: 'el PDF del borrador del presupuesto' },
  director_offer_pdf: { en: 'the job offer PDF', es: 'el PDF de la oferta de trabajo' },
  director_pay: { en: 'the total pay for the first year', es: 'el pago total del primer año' },
  director_hours: { en: 'the expected hours for the first year', es: 'las horas esperadas del primer año' },
}

export function ClusterPresentationPanel({
  lang,
  clusterId,
  address,
  isInitiator,
  onChanged,
  Button,
}: {
  lang: string
  clusterId: number
  address: string | null
  isInitiator: boolean
  onChanged?: () => void
  Button: any
}) {
  const tr = (key: keyof typeof LABELS, ...args: string[]) => {
    const value = (lang === 'es' ? LABELS[key].es : LABELS[key].en) as string
    return args.reduce((acc, arg, index) => acc.replace(`{{${index}}}`, arg), value)
  }

  const [presentation, setPresentation] = useState<Presentation | null>(null)
  const [withdraw, setWithdraw] = useState<WithdrawState | null>(null)
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
      const [presentationRes, withdrawRes] = await Promise.all([
        fetch(`/api/cluster/${clusterId}/gd-presentation${query}`),
        fetch(`/api/cluster/${clusterId}/withdraw${query}`),
      ])
      const presentationData = presentationRes.ok ? await presentationRes.json() : null
      setPresentation(presentationData)
      setWithdraw(withdrawRes.ok ? await withdrawRes.json() : null)
      setBudget(presentationData?.request?.first_year_budget != null ? String(presentationData.request.first_year_budget) : '')
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
      setWithdraw(null)
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
        ? { walletAddress: address, ...(budget ? { firstYearBudget: Number(budget) } : {}) }
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

  const vote = async () => {
    if (!address) return
    setBusy('withdraw')
    setError(null)
    try {
      const res = await fetch(`/api/cluster/${clusterId}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || tr('error'))
      setWithdraw(await res.json())
      setNotice(tr('withdrawDone'))
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
    <div className="border-t border-gray-200 pt-4 mb-6 space-y-4">
      {isInitiator && missingData.length > 0 && !locked && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-semibold mb-1">{tr('missingData')}</p>
          <ul className="list-disc ml-4">
            {missingData.map((key) => (
              <li key={key}>{lang === 'es' ? MISSING[key]?.es : MISSING[key]?.en}</li>
            ))}
          </ul>
        </div>
      )}

      {request && (request.evaluation || request.suggestions) && (
        <div className="rounded border border-gray-200 bg-white p-3 text-xs text-gray-700 space-y-1">
          {request.evaluation && (
            <p><span className="font-semibold">{tr('evaluation')}:</span> {request.evaluation}</p>
          )}
          {request.suggestions && (
            <p className="whitespace-pre-wrap"><span className="font-semibold">{tr('suggestions')}:</span> {request.suggestions}</p>
          )}
        </div>
      )}

      <section>
        <h3 className="text-sm font-semibold text-gray-900">{tr('budget')}</h3>
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
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-900">{tr('director')}</h3>
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
      </section>

      {isInitiator && request?.status === 'requested' && (
        <section>
          <p className="text-xs text-gray-600 mb-1">{tr('cancelHint')}</p>
          <Button variant="outline" size="sm" onClick={cancel} disabled={busy === 'cancel'} className="text-red-600 border-red-300 hover:bg-red-50">
            {tr('cancel')}
          </Button>
        </section>
      )}

      <section>
        <h3 className="text-sm font-semibold text-gray-900">{tr('withdraw')}</h3>
        <p className="text-xs text-gray-600 mb-2">{tr('withdrawHint')}</p>
        {withdraw && (
          <div className="text-xs text-gray-700 space-y-1">
            <p>{tr('withdrawVotes', String(withdraw.votes.voted), String(withdraw.votes.pastors))}</p>
            {withdraw.ranking_exited_at && (
              <p className="text-amber-700">
                {tr('rankingExit')} {new Date(withdraw.ranking_exited_at).toLocaleDateString(lang)}
              </p>
            )}
            {withdraw.release.usdt !== null && (
              <p>{tr('balance')}: {withdraw.release.usdt} USDT / {withdraw.release.slearn} SLEARN</p>
            )}
            {withdraw.fund_released_at ? (
              <p className="font-semibold text-green-700">
                {tr('releasedAt')}: {new Date(withdraw.fund_released_at).toLocaleDateString(lang)}. <span className="font-normal">{tr('releasedHint')}</span>
              </p>
            ) : !withdraw.armed ? (
              <p className="text-gray-500">{tr('armedHint')}</p>
            ) : null}
            {withdraw.can_vote && (
              <div className="pt-1">
                <Button size="sm" onClick={vote} disabled={busy === 'withdraw'}>
                  {tr('withdrawCast')}
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      {notice && <p className="text-xs text-green-700">{notice}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
