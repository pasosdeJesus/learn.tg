// Explorador de donaciones (REQ/223): resumen de una fila del ledger
// (`transaction`, type='donation') para la API pública y la página
// /[lang]/donations. Se descarta la metadata cruda (contiene direcciones y el
// desglose interno) y solo se expone: destino, comentario del donante (si lo
// hay), monto/cripto, hash y el nombre de usuario (`nusuario`, nunca el nombre
// real) del donante.

export interface DonationRowLike {
  id: number
  date: string | Date | null
  crypto: string
  amount: number | string
  hash: string | null
  subcategoria: string | null
  wallet?: string | null
  nusuario?: string | null
  metadata?: Record<string, any> | null
}

export interface DonationSummary {
  id: number
  date: string | Date | null
  crypto: string
  amount: number
  hash: string | null
  type: 'course' | 'cluster' | 'country' | 'campaign' | 'unknown'
  destination: string
  donor: string | null
  comment: string | null
}

export function donationType(subcategoria: string | null | undefined): DonationSummary['type'] {
  switch (subcategoria) {
    case 'course_vault': return 'course'
    case 'cluster': return 'cluster'
    case 'country': return 'country'
    case 'campaign': return 'campaign'
    default: return 'unknown'
  }
}

function shortWallet(wallet: string | null | undefined): string | null {
  return wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : null
}

/** Etiqueta del destino, sin exponer datos personales. */
export function donationDestinationLabel(row: DonationRowLike): string {
  const m = row.metadata || {}
  const type = donationType(row.subcategoria)
  switch (type) {
    case 'course': return `Course #${m.courseId ?? '?'}`
    case 'cluster': return `Cluster ${shortWallet(m.clusterWallet) || '?'}`
    case 'country': return `Country ${m.countryCode || '?'}`
    case 'campaign': return `Campaign ${m.campaign || '?'}`
    default: return row.subcategoria || 'unknown'
  }
}

export function summarizeDonation(row: DonationRowLike): DonationSummary {
  const m = row.metadata || {}
  return {
    id: row.id,
    date: row.date,
    crypto: row.crypto,
    amount: Number(row.amount),
    hash: row.hash,
    type: donationType(row.subcategoria),
    destination: donationDestinationLabel(row),
    donor: row.nusuario || shortWallet(row.wallet),
    comment: typeof m.comment === 'string' && m.comment ? m.comment : null,
  }
}
