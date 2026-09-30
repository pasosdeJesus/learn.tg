// lib/referral-admin.ts — read and correct a user's referrer from the admin UI
// (https://github.com/pasosdeJesus/learn.tg/issues/163). The verifier can see the
// learner's own referral code (the one others type to be referred by them) and who
// referred them, and fix the relationship when the learner declared the wrong code or
// registered with another account.
//
// Not a column of `usuario`: the data lives in `referralcode` (the user's code) and
// `referralrelationship` (referrer -> referred, unique per referred user), so it does
// not go through `buildSafeUpdates` in the route.
import { Kysely, sql } from 'kysely'
import type { DB } from '@/db/db.d.ts'

export interface ReferrerSummary {
  id: number
  nusuario: string | null
  nombre: string | null
}

export interface ReferralInfo {
  /** The user's own code, i.e. the code others type to be referred by them. */
  code: string | null
  referrer: ReferrerSummary | null
  claimed_at: Date | string | null
  /**
   * Rewards already paid to the current referrer for this referred user. When > 0,
   * changing the referrer does not move them: the payout is keyed by `referred_id` in
   * `transaction.metadata`, so only the future ones go to the new referrer.
   */
  rewards_paid: { count: number; usdt: number; slearn: number }
}

export async function getReferralInfo(db: Kysely<DB>, userId: number): Promise<ReferralInfo> {
  const codeRow = await db
    .selectFrom('referralcode')
    .select('code')
    .where('usuario_id', '=', userId)
    .orderBy('id', 'desc')
    .executeTakeFirst()

  const rel = await db
    .selectFrom('referralrelationship as rr')
    .innerJoin('usuario as r', 'r.id', 'rr.referrer_id')
    .select(['rr.referrer_id', 'rr.referral_claimed_at', 'r.nusuario', 'r.nombre'])
    .where('rr.referred_id', '=', userId)
    .executeTakeFirst()

  const rewards_paid = { count: 0, usdt: 0, slearn: 0 }
  if (rel) {
    const rows = await db
      .selectFrom('transaction')
      .select(['crypto', 'amount'])
      .where('usuario_id', '=', rel.referrer_id)
      .where('categoria', '=', 'referral')
      .where(sql`metadata->>'referred_id'`, '=', String(userId))
      .execute()
    rewards_paid.count = rows.length
    for (const row of rows) {
      if (row.crypto === 'usdt') rewards_paid.usdt += Number(row.amount) || 0
      else if (row.crypto === 'slearn') rewards_paid.slearn += Number(row.amount) || 0
    }
  }

  return {
    code: codeRow?.code ?? null,
    referrer: rel
      ? { id: rel.referrer_id, nusuario: rel.nusuario ?? null, nombre: rel.nombre ?? null }
      : null,
    claimed_at: rel?.referral_claimed_at ?? null,
    rewards_paid,
  }
}

export type SetReferrerResult =
  | { ok: true; referrerId: number | null; changed: boolean }
  | { ok: false; error: string }

/**
 * Sets, changes or clears the referrer of `referredId`. `input` accepts the referrer's
 * user id (`123` or `#123`), their username (`nusuario`) or their referral code; an
 * empty value removes the relationship.
 *
 * The guards mirror `POST /api/referral/claim`: no self-referral and the referrer
 * account must not be newer than the referred one. The caller logs the change in
 * `verification_log`.
 */
export async function setReferrer(
  db: Kysely<DB>,
  referredId: number,
  input: string | number | null | undefined,
): Promise<SetReferrerResult> {
  const raw = input == null ? '' : String(input).trim()

  const current = await db
    .selectFrom('referralrelationship')
    .select('referrer_id')
    .where('referred_id', '=', referredId)
    .executeTakeFirst() as { referrer_id: number } | undefined

  if (raw === '') {
    if (!current) return { ok: true, referrerId: null, changed: false }
    await db.deleteFrom('referralrelationship').where('referred_id', '=', referredId).execute()
    return { ok: true, referrerId: null, changed: true }
  }

  let referrerId: number | null = null
  if (/^#?\d+$/.test(raw)) {
    referrerId = parseInt(raw.replace('#', ''), 10)
  } else {
    const byCode = await db
      .selectFrom('referralcode')
      .select('usuario_id')
      .where('code', 'ilike', raw)
      .executeTakeFirst() as { usuario_id: number } | undefined
    if (byCode) {
      referrerId = byCode.usuario_id
    } else {
      const byUsername = await db
        .selectFrom('usuario')
        .select('id')
        .where('nusuario', 'ilike', raw)
        .executeTakeFirst() as { id: number } | undefined
      if (byUsername) referrerId = byUsername.id
    }
  }

  if (referrerId == null) {
    return {
      ok: false,
      error: 'Referrer not found: use the user id, the username or an existing referral code',
    }
  }
  if (referrerId === referredId) return { ok: false, error: 'A user cannot refer themselves' }
  if (current?.referrer_id === referrerId) return { ok: true, referrerId, changed: false }

  const people = await db
    .selectFrom('usuario')
    .select(['id', 'fechacreacion'])
    .where('id', 'in', [referrerId, referredId])
    .execute() as Array<{ id: number; fechacreacion: Date | string | null }>
  const referrer = people.find((person) => person.id === referrerId)
  const referred = people.find((person) => person.id === referredId)
  if (!referrer) return { ok: false, error: 'Referrer not found' }
  if (!referred) return { ok: false, error: 'User not found' }
  // Same rule as the claim endpoint: an older user cannot be referred by a newer one.
  if (referrer.fechacreacion && referred.fechacreacion
    && new Date(referrer.fechacreacion) > new Date(referred.fechacreacion)) {
    return { ok: false, error: 'The referrer account is newer than the referred user' }
  }

  if (current) {
    await db
      .updateTable('referralrelationship')
      .set({ referrer_id: referrerId } as any)
      .where('referred_id', '=', referredId)
      .execute()
  } else {
    const code = await db
      .selectFrom('referralcode')
      .select('code')
      .where('usuario_id', '=', referrerId)
      .executeTakeFirst() as { code: string } | undefined
    await db.insertInto('referralrelationship').values({
      referrer_id: referrerId,
      referred_id: referredId,
      referral_code: code?.code ?? null,
      // `status` is informational (`pending` is the value the claim flow writes; no
      // CHECK constraint exists on the column).
      status: 'pending',
    } as any).execute()
  }

  return { ok: true, referrerId, changed: true }
}
