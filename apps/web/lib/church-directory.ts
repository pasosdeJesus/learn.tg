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

export type ReputationKey = 'good' | 'good_no_pastor' | 'not_recommended'

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
  reputationKey: ReputationKey
  activityScore: number | null
  amountMember: number | null
}

export type DirectorySortKey = 'reputation' | 'activity' | 'members' | 'church'

export interface DirectoryFilters {
  country?: string
  denominations?: string[]
  sort?: DirectorySortKey
  order?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface DirectoryResult {
  churches: DirectoryEntry[]
  total: number
  page: number
  limit: number
  countries: { alfa2: string; nombre: string }[]
  denominations: string[]
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
  has_lead_pastor: boolean | null
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
      sql<boolean>`EXISTS (SELECT 1 FROM usuario u WHERE u.church_id = ch.id AND u.church_relationship = 'pastor' AND u.verified_church_relationship = 'pastor')`.as('has_lead_pastor'),
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

function reputationKeyFor(score: number, hasLeadPastor: boolean, notRecommended: boolean): ReputationKey {
  if (notRecommended || score < 0) return 'not_recommended'
  return hasLeadPastor ? 'good' : 'good_no_pastor'
}

function toEntry(row: RawChurch, activityScore: number | null, notRecommended = false): DirectoryEntry {
  const score = Number(row.reputation_score ?? 0)
  return {
    id: Number(row.church_id),
    name: row.name,
    cityName: row.city_name,
    countryName: row.country_name,
    countryAlfa2: row.country_alfa2,
    denomination: row.denomination,
    pastorId: row.pastor_id,
    pastorName: row.pastor_nusuario,
    reputationScore: score,
    reputationKey: reputationKeyFor(score, !!row.has_lead_pastor, notRecommended),
    activityScore,
    amountMember: row.amount_member == null ? null : Number(row.amount_member),
  }
}

// Default order (R-#164): reputation, then activity, then members (descending),
// with the id ascending as the final tie-breaker. A chosen `sort` becomes the
// primary key; the rest follow the same chain.
function sortValue(key: DirectorySortKey | 'id', r: RawChurch, scores: Map<number, number>): number | string {
  switch (key) {
    case 'reputation': return Number(r.reputation_score ?? 0)
    case 'activity': return scores.get(Number(r.church_id)) ?? 0
    case 'members': return Number(r.amount_member ?? 0)
    case 'id': return Number(r.church_id)
    case 'church': return (r.name || '').toLowerCase()
  }
}

function orderRows(
  rows: RawChurch[],
  scores: Map<number, number>,
  sort: DirectorySortKey,
  order: 'asc' | 'desc',
): RawChurch[] {
  const chain: { key: DirectorySortKey | 'id'; dir: 'asc' | 'desc' }[] = []
  if (sort === 'church') chain.push({ key: 'church', dir: order })
  else chain.push({ key: sort, dir: order })
  for (const k of ['reputation', 'activity', 'members'] as const) {
    if (k !== sort) chain.push({ key: k, dir: 'desc' })
  }
  chain.push({ key: 'id', dir: 'asc' })

  return [...rows].sort((a, b) => {
    for (const { key, dir } of chain) {
      const va = sortValue(key, a, scores)
      const vb = sortValue(key, b, scores)
      const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)
      if (cmp !== 0) return dir === 'asc' ? cmp : -cmp
    }
    return 0
  })
}

/**
 * Paginated directory. The activity normalization is computed over the **whole**
 * main population (never the filtered view), then the filters, ordering and
 * pagination are applied — so a church's `activity_score` does not change with the
 * visit. The `countries`/`denominations` facets come from the whole population too
 * (the filter options do not shrink as you filter).
 */
export async function getDirectory(
  db: Kysely<DB>,
  filters: DirectoryFilters = {},
): Promise<DirectoryResult> {
  const { country, denominations, sort = 'reputation', order = 'desc', page = 1, limit = 24 } = filters
  const population = (await mainListQuery(db).execute()) as unknown as RawChurch[]
  const scores = computeActivityScores(population)

  const countriesMap = new Map<string, string>()
  const denominationsSet = new Set<string>()
  for (const r of population) {
    if (r.country_alfa2) countriesMap.set(r.country_alfa2, r.country_name || r.country_alfa2)
    if (r.denomination) denominationsSet.add(r.denomination)
  }
  const countries = [...countriesMap.entries()]
    .map(([alfa2, nombre]) => ({ alfa2, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
  const allDenominations = [...denominationsSet].sort((a, b) => a.localeCompare(b))

  let rows = population
  if (country) {
    const c = country.toLowerCase()
    rows = rows.filter((r) => (r.country_alfa2 || '').toLowerCase() === c || String(r.church_id) === country)
  }
  if (denominations && denominations.length > 0) {
    const set = new Set(denominations.map((d) => d.toLowerCase()))
    rows = rows.filter((r) => set.has((r.denomination || '').toLowerCase()))
  }
  rows = orderRows(rows, scores, sort, order)

  const total = rows.length
  const start = Math.max(0, (page - 1) * limit)
  const pageRows = rows.slice(start, start + limit)
  return {
    churches: pageRows.map((r) => toEntry(r, scores.get(Number(r.church_id)) ?? null)),
    total,
    page,
    limit,
    countries,
    denominations: allDenominations,
  }
}

/** The "not recommended" section: published, neutral, no activity/members. */
export async function getNotRecommended(db: Kysely<DB>): Promise<DirectoryEntry[]> {
  const rows = (await baseSelect(db)
    .where('ch.listing_reason', '=', 'not_recommended')
    .execute()) as unknown as RawChurch[]
  return rows
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .map((r) => ({ ...toEntry(r, null, true), reputationScore: 0, amountMember: null }))
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
    return { ...toEntry(row, null, true), reputationScore: 0, amountMember: null }
  }
  if (listingReason.registration_verified !== true || listingReason.is_listed !== true || listingReason.listing_reason) {
    return null
  }

  const population = (await mainListQuery(db).execute()) as unknown as RawChurch[]
  const scores = computeActivityScores(population)
  return toEntry(row, scores.get(Number(row.church_id)) ?? null)
}
