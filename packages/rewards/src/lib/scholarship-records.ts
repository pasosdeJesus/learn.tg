// Registro local de las becas pagadas por el crucigrama (una fila `transaction` por
// token: usdt y/o slearn).
//
// R-#279 (https://github.com/pasosdeJesus/learn.tg/issues/279) hizo que el ícono del
// curso (`app/api/guide-status`) y la comprobación "ya pagada" del handler lean
// `transaction`, no `guide_usuario.amountpaid` (esa columna mezcla tokens). El problema:
// los pagos hechos **antes** de ese registro, o migrados del vault V4 al V5, quedaron
// marcados como pagados **en la cadena** (`guidePaidUSDT`/`guidePaidSLEARN`) pero sin su
// fila local, así que la guía aparecía como *no pagada* y el handler llamaba al
// contrato para una transacción no-op (`ScholarshipAlreadyPaid`).
//
// Aquí, cuando la cadena dice que un token ya se pagó y no hay fila, se escribe. La
// cadena es la autoridad; esto sólo pone al día el registro local.

import type { Kysely } from 'kysely'

export type ScholarshipToken = 'usdt' | 'slearn'

export interface RecordedTokens {
  usdt: boolean
  slearn: boolean
}

export interface ScholarshipRow {
  crypto: ScholarshipToken
  amount: number
}

/**
 * Tokens que faltan registrar: la cadena los da por pagados (`getStudentGuideStatus`)
 * y la base todavía no tiene su fila de beca para esa guía. Pura, para poder probarla.
 */
export function missingScholarshipTokens(
  onChain: { usdt: bigint; slearn: bigint },
  recorded: RecordedTokens,
): ScholarshipToken[] {
  const missing: ScholarshipToken[] = []
  if (onChain.usdt > 0n && !recorded.usdt) missing.push('usdt')
  if (onChain.slearn > 0n && !recorded.slearn) missing.push('slearn')
  return missing
}

/**
 * Qué tokens ya tienen fila de beca (`type='scholarship'`) para (usuario, guía).
 *
 * El filtro por `metadata->>'guideId'` se hace en JS (no con `sql`) a propósito: así el
 * `dist` de esta lib **no importa `kysely` en runtime**, y se puede usar desde un script
 * suelto (`tsx`) sin que el motor tenga `node_modules` propio.
 */
export async function recordedScholarshipTokens(
  db: Kysely<any>,
  usuarioId: number,
  guideId: number,
): Promise<RecordedTokens> {
  const rows = await db
    .selectFrom('transaction')
    .select(['crypto', 'metadata'])
    .where('usuario_id', '=', usuarioId)
    .where('type', '=', 'scholarship')
    .where('crypto', 'in', ['usdt', 'slearn'])
    .execute()
  const cryptos = new Set(
    (rows as Array<{ crypto: string; metadata: unknown }>)
      .filter((row) => String((row.metadata as { guideId?: unknown } | null)?.guideId) === String(guideId))
      .map((row) => row.crypto),
  )
  return { usdt: cryptos.has('usdt'), slearn: cryptos.has('slearn') }
}

/** Entero con decimales → número (USDT 6, SLEARN 2). Sin `viem`, por el mismo motivo. */
function toDecimal(raw: bigint, decimals: number): number {
  const divisor = 10n ** BigInt(decimals)
  return Number(raw / divisor) + Number(raw % divisor) / Number(divisor)
}

export interface RecordMissingArgs {
  usuarioId: number
  wallet: string
  courseId: number
  /** `actividadpf_id` (el id que usa el contrato como `guideId`). */
  guideId: number
  /** Monto acumulado pagado en la cadena para (curso, guía, billetera). */
  onChain: { usdt: bigint; slearn: bigint }
  recorded: RecordedTokens
  /**
   * Hash de la transacción que pagó cada token, si se conoce (la prueba on-chain).
   * Un mismo pago puede mover los dos tokens en una sola tx, pero también pueden ser
   * pagos distintos (parciales): por eso es por token y no por (curso, guía).
   */
  hashes?: Partial<Record<ScholarshipToken, string | null>>
  usdtDecimals?: number
  slearnDecimals?: number
}

/**
 * Escribe las filas `transaction` que faltan para una guía ya pagada en la cadena.
 * Idempotente respecto a `recorded`: no duplica tokens ya registrados. El `hash` queda
 * nulo salvo que lo aporte el llamador (el pago original lo hizo un vault anterior); el
 * hash histórico lo completa `apps/nextjs/scripts/reconcile-scholarships.ts` por
 * dirección. Devuelve lo insertado.
 */
export async function recordMissingScholarshipRows(
  db: Kysely<any>,
  args: RecordMissingArgs,
): Promise<ScholarshipRow[]> {
  const missing = missingScholarshipTokens(args.onChain, args.recorded)
  if (missing.length === 0) return []
  const usdtDecimals = args.usdtDecimals ?? 6
  const slearnDecimals = args.slearnDecimals ?? 2
  const inserted: ScholarshipRow[] = []
  for (const token of missing) {
    const raw = token === 'usdt' ? args.onChain.usdt : args.onChain.slearn
    const decimals = token === 'usdt' ? usdtDecimals : slearnDecimals
    const amount = toDecimal(raw, decimals)
    await db
      .insertInto('transaction')
      .values({
        usuario_id: args.usuarioId,
        date: new Date(),
        type: 'scholarship',
        crypto: token,
        amount,
        balance_impact: amount,
        hash: args.hashes?.[token] ?? null,
        wallet: args.wallet,
        metadata: { courseId: args.courseId, guideId: args.guideId, source: 'chain' },
      })
      .execute()
    inserted.push({ crypto: token, amount })
  }
  return inserted
}
