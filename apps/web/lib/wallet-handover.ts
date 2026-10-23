/**
 * R-#288: add the in-app wallet to an existing, verified account and delete the
 * duplicate account the in-app wallet created.
 *
 * The operator's data (2026-10-22): a duplicate holds no value. It has one wallet
 * in practice, at most a GoodDollar date and a proposed interview date (both
 * ignored) and never `transaction` rows, premium purchases or credentials. So the
 * operation does not merge anything: it moves the wallet and deletes the account.
 *
 * The operation is refused when the duplicate has any row that must not be
 * destroyed silently (money, on-chain proofs, church/reputation/cluster data,
 * referral relationships). The reference list is read from the live catalog
 * (`pg_constraint`), so a new foreign key to `usuario` cannot be forgotten.
 */
import { sql, type Kysely } from 'kysely'
import { isVerifiedAccount, type AccountTrust } from './wallet-invite-policy'

export type HandoverCode =
  | 'duplicate-not-found'
  | 'duplicate-verified'
  | 'duplicate-disabled'
  | 'duplicate-is-verifier'
  | 'duplicate-has-value'
  | 'survivor-not-found'
  | 'survivor-not-verified'
  | 'survivor-disabled'
  | 'same-account'
  | 'target-not-linked'
  | 'target-not-verified'
  | 'already-pending'
  | 'already-completed'
  | 'no-wallets'

export class HandoverError extends Error {
  code: HandoverCode
  detail?: string

  constructor(code: HandoverCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code)
    this.name = 'HandoverError'
    this.code = code
    this.detail = detail
  }
}

export interface HandoverAccount extends AccountTrust {
  id: number
  nusuario: string | null
  fechadeshabilitacion: string | Date | null
}

export interface AccountWalletRow {
  id: number
  usuario_id: number
  billetera: string
  linked_at?: string | Date | null
}

export interface ReferencingRow {
  table: string
  column: string
  count: number
}

export interface ReceivedHandover {
  id: number
  direccion_invitada: string
  expires_at: string | Date | null
  duplicate_id: number
  duplicate_nusuario: string | null
  /** The in-app wallet that asks to join (the duplicate's wallet). */
  duplicate_wallet: string | null
}

/** Columns deleted with the duplicate. Everything else makes the handover refuse. */
const DELETED_REFERENCES = new Set([
  'billetera_invitada.usuario_id',
  'notifications.usuario_id',
  'referralcode.usuario_id',
  'verification_log.usuario_id',
])

/** The wallets are moved, not deleted. */
const MOVED_REFERENCE = 'billetera_usuario.usuario_id'

/** Tables without a foreign key to `usuario`; they are cleaned with the duplicate. */
const DELETED_TABLES = [
  'guide_usuario',
  'notifications',
  'userevent',
  'verification_log',
  'referralcode',
  'billetera_invitada',
] as const

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

const ACCOUNT_COLUMNS = [
  'u.id',
  'u.nusuario',
  'u.profilescore',
  'u.passport_name',
  'u.verified_church_relationship',
  'u.fechadeshabilitacion',
]

export async function loadAccount(
  db: Kysely<any>,
  id: number,
): Promise<HandoverAccount | null> {
  const result = await sql<HandoverAccount>`
    SELECT ${sql.raw(ACCOUNT_COLUMNS.join(', '))}
      FROM usuario u
     WHERE u.id = ${id}
  `.execute(db)
  return result.rows[0] ?? null
}

export async function loadAccountByWallet(
  db: Kysely<any>,
  address: string,
): Promise<HandoverAccount | null> {
  const result = await sql<HandoverAccount>`
    SELECT ${sql.raw(ACCOUNT_COLUMNS.join(', '))}
      FROM usuario u
      JOIN billetera_usuario bu ON bu.usuario_id = u.id
     WHERE LOWER(bu.billetera) = ${address.toLowerCase()}
     LIMIT 1
  `.execute(db)
  return result.rows[0] ?? null
}

export async function isVerifierAccount(db: Kysely<any>, id: number): Promise<boolean> {
  const wallets = (process.env.NEXT_PUBLIC_VERIFIER_WALLET || '')
    .split(',')
    .map((wallet) => wallet.trim().toLowerCase())
    .filter(Boolean)
  if (wallets.length === 0) return false
  const result = await sql<{ billetera: string }>`
    SELECT billetera FROM billetera_usuario WHERE usuario_id = ${id}
  `.execute(db)
  return result.rows.some((row) => wallets.includes(row.billetera.toLowerCase()))
}

/**
 * Rows of every foreign key that points at `usuario`, with the count for `id`.
 * `billetera_usuario` is included: it is expected to have rows and they are moved.
 */
export async function referencesOf(
  db: Kysely<any>,
  id: number,
): Promise<ReferencingRow[]> {
  const fks = await sql<{ schema_name: string; table_name: string; column_name: string }>`
    SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
     WHERE con.contype = 'f'
       AND con.confrelid = 'usuario'::regclass
     ORDER BY 1, 2, 3
  `.execute(db)

  const rows: ReferencingRow[] = []
  for (const fk of fks.rows) {
    const count = await sql<{ n: number }>`
      SELECT count(*)::int AS n
        FROM ${sql.raw(`${quoteIdent(fk.schema_name)}.${quoteIdent(fk.table_name)}`)}
       WHERE ${sql.raw(quoteIdent(fk.column_name))} = ${id}
    `.execute(db)
    const n = Number(count.rows[0]?.n ?? 0)
    if (n > 0) rows.push({ table: fk.table_name, column: fk.column_name, count: n })
  }
  return rows
}

export type Eligibility =
  | { ok: true }
  | { ok: false; code: HandoverCode; detail?: string }

/** Decides from the live references whether the duplicate holds anything to preserve. */
export function classifyReferences(rows: ReferencingRow[]): Eligibility {
  for (const ref of rows) {
    const key = `${ref.table}.${ref.column}`
    if (key === MOVED_REFERENCE || DELETED_REFERENCES.has(key)) continue
    return { ok: false, code: 'duplicate-has-value', detail: `${key} (${ref.count})` }
  }
  return { ok: true }
}

export async function checkHandoverEligibility(
  db: Kysely<any>,
  args: { duplicateId: number; survivorId: number },
): Promise<Eligibility> {
  if (args.duplicateId === args.survivorId) return { ok: false, code: 'same-account' }

  const duplicate = await loadAccount(db, args.duplicateId)
  if (!duplicate) return { ok: false, code: 'duplicate-not-found' }
  if (duplicate.fechadeshabilitacion) return { ok: false, code: 'duplicate-disabled' }
  if (isVerifiedAccount(duplicate)) return { ok: false, code: 'duplicate-verified' }
  if (await isVerifierAccount(db, duplicate.id)) {
    return { ok: false, code: 'duplicate-is-verifier' }
  }

  const survivor = await loadAccount(db, args.survivorId)
  if (!survivor) return { ok: false, code: 'survivor-not-found' }
  if (survivor.fechadeshabilitacion) return { ok: false, code: 'survivor-disabled' }
  if (!isVerifiedAccount(survivor)) return { ok: false, code: 'survivor-not-verified' }

  const references = classifyReferences(await referencesOf(db, args.duplicateId))
  if (!references.ok) return references

  const wallets = await sql<{ n: number }>`
    SELECT count(*)::int AS n FROM billetera_usuario WHERE usuario_id = ${args.duplicateId}
  `.execute(db)
  if (Number(wallets.rows[0]?.n ?? 0) === 0) return { ok: false, code: 'no-wallets' }

  return { ok: true }
}

export interface HandoverResult {
  moved: number
  wallets: AccountWalletRow[]
}

/**
 * Moves every wallet of the duplicate to the survivor and deletes the duplicate
 * account, in one transaction. The eligibility is re-checked inside it.
 */
export async function handoverWallet(
  db: Kysely<any>,
  args: { duplicateId: number; survivorId: number },
): Promise<HandoverResult> {
  return db.transaction().execute(async (trx) => {
    const check = await checkHandoverEligibility(trx, args)
    if (!check.ok) throw new HandoverError(check.code, check.detail)

    const moved = await sql<{ billetera: string }>`
      UPDATE billetera_usuario
         SET usuario_id = ${args.survivorId}, updated_at = now()
       WHERE usuario_id = ${args.duplicateId}
      RETURNING billetera
    `.execute(trx)

    // A concurrent accept may have moved the wallets after our check and before the
    // update took its row locks. Nothing is ours to delete then: refuse cleanly.
    if (moved.rows.length === 0) {
      throw new HandoverError('already-completed', `usuario ${args.duplicateId}`)
    }

    const deleted: Record<string, number> = {}
    for (const table of DELETED_TABLES) {
      const result = await sql`
        DELETE FROM ${sql.raw(quoteIdent(table))}
         WHERE usuario_id = ${args.duplicateId}
      `.execute(trx)
      deleted[table] = Number(result.numAffectedRows ?? 0n)
    }

    await sql`
      INSERT INTO userevent (usuario_id, event_type, event_data, created_at)
      VALUES (
        ${args.survivorId},
        'account_handover',
        ${JSON.stringify({
          duplicate_usuario_id: args.duplicateId,
          wallets: moved.rows.map((row) => row.billetera.toLowerCase()),
          deleted,
        })}::jsonb,
        now()
      )
    `.execute(trx)

    await sql`
      INSERT INTO verification_log (usuario_id, action, details, performed_by, created_at)
      VALUES (
        ${args.survivorId},
        'wallet_handover',
        ${JSON.stringify({
          duplicate_usuario_id: args.duplicateId,
          wallets: moved.rows.map((row) => row.billetera.toLowerCase()),
          moved: moved.rows.length,
        })}::jsonb,
        ${args.survivorId},
        now()
      )
    `.execute(trx)

    await sql`UPDATE usuario SET session_epoch = session_epoch + 1 WHERE id = ${args.duplicateId}`.execute(trx)
    await sql`DELETE FROM usuario WHERE id = ${args.duplicateId}`.execute(trx)

    const wallets = await sql<AccountWalletRow>`
      SELECT id, usuario_id, billetera, linked_at
        FROM billetera_usuario
       WHERE usuario_id = ${args.survivorId}
       ORDER BY linked_at, id
    `.execute(trx)

    return { moved: moved.rows.length, wallets: wallets.rows }
  })
}

/** Creates a handover request from the duplicate to an address that already has an account. */
export async function createHandoverInvitation(
  db: Kysely<any>,
  args: { duplicateId: number; address: string },
): Promise<void> {
  const address = args.address.toLowerCase()
  try {
    await sql`
      INSERT INTO billetera_invitada (direccion_invitada, usuario_id, created_at, updated_at)
      VALUES (${address}, ${args.duplicateId}, now(), now())
    `.execute(db)
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') {
      throw new HandoverError('already-pending')
    }
    throw error
  }
}

/**
 * Cancels a handover request addressed to one of the account's wallets. The
 * account owns the addressed wallet, not the request, so the id alone is not
 * trusted: the address must belong to it. Idempotent.
 */
export async function cancelReceivedHandover(
  db: Kysely<any>,
  args: { accountId: number; requestId: number },
): Promise<boolean> {
  const result = await sql`
    UPDATE billetera_invitada
       SET cancelled_at = now(), updated_at = now()
     WHERE id = ${args.requestId}
       AND used_at IS NULL
       AND cancelled_at IS NULL
       AND direccion_invitada IN (
         SELECT billetera FROM billetera_usuario WHERE usuario_id = ${args.accountId}
       )
  `.execute(db)
  return Number(result.numAffectedRows ?? 0n) > 0
}

/**
 * Handover requests addressed to the account: pending invitations whose invited
 * address is one of its wallets ({@link billetera_invitada}.usuario_id is the
 * duplicate). Expired rows are left for the engine's own cleanup.
 */
export async function listReceivedHandovers(
  db: Kysely<any>,
  accountId: number,
): Promise<ReceivedHandover[]> {
  const result = await sql<ReceivedHandover>`
    SELECT i.id, i.direccion_invitada, i.expires_at, i.usuario_id AS duplicate_id,
           u.nusuario AS duplicate_nusuario,
           (SELECT bu.billetera
              FROM billetera_usuario bu
             WHERE bu.usuario_id = i.usuario_id
             ORDER BY bu.linked_at, bu.id
             LIMIT 1) AS duplicate_wallet
      FROM billetera_invitada i
      JOIN usuario u ON u.id = i.usuario_id
     WHERE i.used_at IS NULL
       AND i.cancelled_at IS NULL
       AND (i.expires_at IS NULL OR i.expires_at > now())
       AND i.direccion_invitada IN (
         SELECT billetera FROM billetera_usuario WHERE usuario_id = ${accountId}
       )
     ORDER BY i.created_at, i.id
  `.execute(db)
  return result.rows
}
