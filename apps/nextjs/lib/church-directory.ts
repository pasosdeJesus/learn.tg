import { Kysely, sql } from 'kysely'
import type { DB } from '@/db/db.d'
import { computeActivityScores } from './church-activity'

// R-#164 Fase 1 — directorio público de iglesias.
//
// Privacidad (§1.1/§1.2/header):
//   - una iglesia en región tipo 2 (`msip_pais.tipo_region = 2`) NUNCA se publica;
//   - "under review" (caso negativo en proceso) → no publicada;
//   - "not recommended" (caso cerrado con evidencia fuerte) → publicada en su propia
//     sección, sin número de posición y con `activity_score`/`amount_member` ocultos;
//   - el resto (registrada/verificada, listada, sin caso activo) → lista principal.

export interface DirectoryEntry {
  id: number
  name: string
  cityName: string | null
  countryName: string | null
  countryAlfa2: string | null
  denomination: string | null
  pastorId: number | null
  pastorName: string | null
  reputationScore: number
  activityScore: number | null
  amountMember: number | null
}

export interface DirectoryFilters {
  country?: string
  denomination?: string
  page?: number
  limit?: number
}

interface RawChurch {
  church_id: number
  name: string
  city_name: string | null
  country_name: string | null
  country_alfa2: string | null
  denomination: string | null
  pastor_id: number | null
  pastor_nusuario: string | null
  reputation_score: number | null
  amount_member: number | null
  guide_score_sum: number | string | null
  referral_count_sum: number | string | null
  donations_usdt_sum: number | string | null
  sbt_count_sum: number | string | null
  slearn_balance_sum: number | string | null
  profilescore_sum: number | string | null
}

function baseSelect(db: Kysely<DB>) {
  return db
    .selectFrom('church as ch')
    .leftJoin('msip_pais as p', 'p.id', 'ch.country_id')
    .leftJoin('usuario as pastor', 'pastor.id', 'ch.pastor_id')
    .leftJoin('churchreputation as cr', 'cr.church_id', 'ch.id')
    .leftJoin('churchactivitycache as cac', 'cac.church_id', 'ch.id')
    .select([
      'ch.id as church_id', 'ch.name', 'ch.city_name',
      'p.nombre as country_name', 'p.alfa2 as country_alfa2',
      'ch.denomination', 'ch.pastor_id', 'pastor.nusuario as pastor_nusuario',
      'cr.reputation_score', 'cac.amount_member',
      'cac.guide_score_sum', 'cac.referral_count_sum', 'cac.donations_usdt_sum',
      'cac.sbt_count_sum', 'cac.slearn_balance_sum', 'cac.profilescore_sum',
    ])
    .where('ch.deleted_at', 'is', null)
    .where(sql<boolean>`COALESCE(p.tipo_region, 1) <> 2`)
}

/** Churches shown in the main directory (region 1, verified, listed, reputation >= 0). */
function mainListQuery(db: Kysely<DB>) {
  return baseSelect(db)
    .where('ch.registration_verified', '=', true)
    .where('ch.is_listed', '=', true)
    .where('ch.listing_reason', 'is', null)
    .where(sql<boolean>`COALESCE(cr.reputation_score, 0) >= 0`)
}

function toEntry(row: RawChurch, activityScore: number | null): DirectoryEntry {
  return {
    id: Number(row.church_id),
    name: row.name,
    cityName: row.city_name,
    countryName: row.country_name,
    countryAlfa2: row.country_alfa2,
    denomination: row.denomination,
    pastorId: row.pastor_id,
    pastorName: row.pastor_nusuario,
    reputationScore: Number(row.reputation_score ?? 0),
    activityScore,
    amountMember: row.amount_member == null ? null : Number(row.amount_member),
  }
}

/**
 * Paginated directory. The activity normalization is computed over the **whole**
 * main population (never the filtered view), then the filters and pagination are
 * applied — so a church's `activity_score` does not change with the visit.
 */
export async function getDirectory(
  db: Kysely<DB>,
  filters: DirectoryFilters = {},
): Promise<{ churches: DirectoryEntry[]; total: number; page: number; limit: number }> {
  const { country, denomination, page = 1, limit = 24 } = filters
  const population = (await mainListQuery(db).execute()) as unknown as RawChurch[]
  const scores = computeActivityScores(population)

  let rows = population
  if (country) {
    const c = country.toLowerCase()
    rows = rows.filter((r) => (r.country_alfa2 || '').toLowerCase() === c || String(r.church_id) === country)
  }
  if (denomination) {
    const d = denomination.toLowerCase()
    rows = rows.filter((r) => (r.denomination || '').toLowerCase().includes(d))
  }
  rows = [...rows].sort((a, b) => (a.name || '').localeCompare(b.name || ''))

  const total = rows.length
  const start = Math.max(0, (page - 1) * limit)
  const pageRows = rows.slice(start, start + limit)
  return {
    churches: pageRows.map((r) => toEntry(r, scores.get(Number(r.church_id)) ?? null)),
    total,
    page,
    limit,
  }
}

/** The "not recommended" section: published, neutral, no activity/members. */
export async function getNotRecommended(db: Kysely<DB>): Promise<DirectoryEntry[]> {
  const rows = (await baseSelect(db)
    .where('ch.listing_reason', '=', 'not_recommended')
    .execute()) as unknown as RawChurch[]
  return rows
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .map((r) => ({ ...toEntry(r, null), reputationScore: 0, amountMember: null }))
}

/**
 * One church for the detail page, applying the same privacy. Returns `null` when
 * the church must not be published (region type 2, unverified, under review).
 */
export async function getChurchDetail(db: Kysely<DB>, id: number): Promise<DirectoryEntry | null> {
  const row = (await baseSelect(db).where('ch.id', '=', id).executeTakeFirst()) as unknown as RawChurch | undefined
  if (!row) return null

  const listingReason = await db
    .selectFrom('church')
    .select(['listing_reason', 'is_listed', 'registration_verified'])
    .where('id', '=', id)
    .executeTakeFirst()
  if (!listingReason) return null

  if (listingReason.listing_reason === 'not_recommended') {
    return { ...toEntry(row, null), reputationScore: 0, amountMember: null }
  }
  if (listingReason.registration_verified !== true || listingReason.is_listed !== true || listingReason.listing_reason) {
    return null
  }

  const population = (await mainListQuery(db).execute()) as unknown as RawChurch[]
  const scores = computeActivityScores(population)
  return toEntry(row, scores.get(Number(row.church_id)) ?? null)
}
