import { Kysely, sql } from 'kysely'
import type { DB } from '@/db/db.d'
import type { LeaderboardQueryParams } from '@/types/leaderboard'

// Shared SQL field definitions used across leaderboard queries
const LP_FIELD = sql<number>`COALESCE(ROUND(SUM(CASE WHEN t.crypto = 'learningpoints' THEN t.impacto_balance ELSE 0 END), 2), 0)`.as('learningpoints')
const LP_WHERE = sql<string>`COALESCE(ROUND(SUM(CASE WHEN t.crypto = 'learningpoints' THEN t.impacto_balance ELSE 0 END), 2), 0)`
const SCHOLARSHIP_FIELD = sql<number>`COALESCE(ROUND(SUM(CASE WHEN t.tipo = 'scholarship' AND t.crypto = 'usdt' THEN t.cantidad ELSE 0 END), 2), 0)`.as('scholarship_usdt')
const SCHOLARSHIP_WHERE = sql<string>`COALESCE(ROUND(SUM(CASE WHEN t.tipo = 'scholarship' AND t.crypto = 'usdt' THEN t.cantidad ELSE 0 END), 2), 0)`
const UBI_FIELD = sql<number>`COALESCE(ROUND(SUM(CASE WHEN t.tipo = 'ubi-claim' AND t.crypto = 'celo' THEN t.cantidad ELSE 0 END), 2), 0)`.as('ubi_celo')
const UBI_WHERE = sql<string>`COALESCE(ROUND(SUM(CASE WHEN t.tipo = 'ubi-claim' AND t.crypto = 'celo' THEN t.cantidad ELSE 0 END), 2), 0)`
const DONATIONS_FIELD = sql<number>`COALESCE(ROUND(SUM(CASE WHEN t.tipo = 'donation' AND t.crypto = 'usdt' THEN t.cantidad ELSE 0 END), 2), 0)`.as('donations_usdt')
const DONATIONS_WHERE = sql<string>`COALESCE(ROUND(SUM(CASE WHEN t.tipo = 'donation' AND t.crypto = 'usdt' THEN t.cantidad ELSE 0 END), 2), 0)`
const SBT_FIELD = sql<number>`COALESCE(ce_counts.cnt, 0)`.as('sbt_count')
const SLEARN_FIELD = sql<number>`COALESCE(ROUND(SUM(CASE WHEN t.crypto = 'slearn' THEN t.impacto_balance ELSE 0 END), 2), 0)`.as('slearn_balance')
const SLEARN_WHERE = sql<string>`COALESCE(ROUND(SUM(CASE WHEN t.crypto = 'slearn' THEN t.impacto_balance ELSE 0 END), 2), 0)`
const SLEARN_USER_COUNT = sql<number>`COUNT(DISTINCT CASE WHEN t.crypto = 'slearn' AND t.impacto_balance > 0 THEN u.id END)`.as('totalUsersWithSLEARN')
const LP_USER_COUNT = sql<number>`COUNT(DISTINCT CASE WHEN t.crypto = 'learningpoints' AND t.impacto_balance > 0 THEN u.id END)`.as('totalUsersWithLP')

export async function buildLeaderboardQuery(
  db: Kysely<DB>,
  params: LeaderboardQueryParams,
  includeReligion: boolean = false
) {
  const { sortBy = 'learningpoints', sortOrder = 'desc', country, page = 1, limit = 50 } = params
  const offset = (page - 1) * limit

  let query: any = db
    .selectFrom('usuario as u')
    .leftJoin('msip_pais as p', 'u.pais_id', 'p.id')
    .leftJoin('transaction as t', 'u.id', 't.usuario_id')
    .leftJoin(
      (eb) => eb.selectFrom('credential_emission')
        .select(['usuario_id', eb.fn.countAll<number>().as('cnt')])
        .groupBy('usuario_id')
        .as('ce_counts'),
      (join) => join.onRef('ce_counts.usuario_id', '=', 'u.id')
    )

  if (includeReligion) {
    query = query.leftJoin('religion as r', 'u.religion_id', 'r.id')
  }

  let selectFields: any[] = [
    'u.id as usuario_id',
    'u.nusuario as username',
    'p.alfa2 as pais_alfa2',
    'p.nombre as pais_nombre',
    LP_FIELD,
    SLEARN_FIELD,
    SCHOLARSHIP_FIELD,
    UBI_FIELD,
    DONATIONS_FIELD,
    SBT_FIELD,
    sql<number>`COUNT(*) OVER()`.as('total_count'),
  ]

  let groupFields: any[] = ['u.id', 'u.nusuario', 'p.alfa2', 'p.nombre', 'ce_counts.cnt']

  if (includeReligion) {
    selectFields.push('r.nombre as religion_nombre')
    groupFields.push('r.nombre')
  }

  query = query
    .select(selectFields)
    .groupBy(groupFields)
    .where('u.excluir_leaderboard', 'is not', true)

  if (country) {
    query = query.where('p.alfa2', '=', country)
  }

  const orderByField = sortBy === 'learningpoints' ? sql`learningpoints` :
                      sortBy === 'slearn_balance' ? sql`slearn_balance` :
                      sortBy === 'scholarship_usdt' ? sql`scholarship_usdt` :
                      sortBy === 'ubi_celo' ? sql`ubi_celo` :
                      sortBy === 'sbt_count' ? sql`sbt_count` :
                      sql`donations_usdt`

  query = query.orderBy(orderByField, sortOrder)
  query = query.limit(limit).offset(offset)

  return query
}

export async function getCountriesQuery(db: Kysely<DB>) {
  return db
    .selectFrom('msip_pais as p')
    .innerJoin('usuario as u', 'u.pais_id', 'p.id')
    .where('p.alfa2', 'is not', null)
    .where('u.excluir_leaderboard', 'is not', true)
    .select(['p.alfa2', 'p.nombre'])
    .distinct()
    .orderBy('p.nombre', 'asc')
}

export async function getLeaderboardTotals(db: Kysely<DB>, country?: string) {
  let query: any = db
    .selectFrom('usuario as u')
    .leftJoin('transaction as t', 'u.id', 't.usuario_id')
    .where('u.excluir_leaderboard', 'is not', true)

  if (country) {
    query = query
      .leftJoin('msip_pais as p', 'u.pais_id', 'p.id')
      .where('p.alfa2', '=', country)
  }

  const result = await query
    .select([
      sql<number>`COUNT(DISTINCT u.id)`.as('totalUsers'),
      LP_USER_COUNT,
      SLEARN_USER_COUNT,
      LP_WHERE.as('totalLearningPoints'),
      SLEARN_WHERE.as('totalSLEARNBalance'),
      SCHOLARSHIP_WHERE.as('totalScholarshipUSDT'),
      UBI_WHERE.as('totalUBICELO'),
      DONATIONS_WHERE.as('totalDonationsUSDT'),
    ])
    .executeTakeFirst()

  return {
    totalUsers: Number(result?.totalUsers || 0),
    totalUsersWithLP: Number(result?.totalUsersWithLP || 0),
    totalUsersWithSLEARN: Number(result?.totalUsersWithSLEARN || 0),
    totalLearningPoints: Number(result?.totalLearningPoints || 0),
    totalSLEARNBalance: Number(result?.totalSLEARNBalance || 0),
    totalScholarshipUSDT: Number(result?.totalScholarshipUSDT || 0),
    totalUBICELO: Number(result?.totalUBICELO || 0),
    totalDonationsUSDT: Number(result?.totalDonationsUSDT || 0),
  }
}

export async function getLeaderboardTotalsByCountry(db: Kysely<DB>) {
  const results = await db
    .selectFrom('usuario as u')
    .leftJoin('transaction as t', 'u.id', 't.usuario_id')
    .leftJoin('msip_pais as p', 'u.pais_id', 'p.id')
    .where('u.excluir_leaderboard', 'is not', true)
    .select([
      sql<string>`COALESCE(p.alfa2, 'ZZ')`.as('alfa2'),
      sql<string>`COALESCE(p.nombre, 'Sin pa\u00eds')`.as('nombre'),
      sql<number>`COUNT(DISTINCT u.id)`.as('totalUsers'),
      LP_USER_COUNT,
      SLEARN_USER_COUNT,
      LP_WHERE.as('totalLearningPoints'),
      SLEARN_WHERE.as('totalSLEARNBalance'),
      SCHOLARSHIP_WHERE.as('totalScholarshipUSDT'),
      UBI_WHERE.as('totalUBICELO'),
      DONATIONS_WHERE.as('totalDonationsUSDT'),
    ])
    .groupBy([sql`COALESCE(p.alfa2, 'ZZ')`, sql`COALESCE(p.nombre, 'Sin pa\u00eds')`])
    .orderBy(sql`COALESCE(p.nombre, 'Sin pa\u00eds')`, 'asc')
    .execute()

  return results.map(row => ({
    alfa2: row.alfa2,
    nombre: row.nombre,
    totalUsers: Number(row.totalUsers || 0),
    totalUsersWithLP: Number(row.totalUsersWithLP || 0),
    totalUsersWithSLEARN: Number(row.totalUsersWithSLEARN || 0),
    totalLearningPoints: Number(row.totalLearningPoints || 0),
    totalSLEARNBalance: Number(row.totalSLEARNBalance || 0),
    totalScholarshipUSDT: Number(row.totalScholarshipUSDT || 0),
    totalUBICELO: Number(row.totalUBICELO || 0),
    totalDonationsUSDT: Number(row.totalDonationsUSDT || 0),
  }))
}

export async function getLeaderboardData(
  db: Kysely<DB>,
  params: LeaderboardQueryParams,
  includeReligion: boolean = false
) {
  const query = await buildLeaderboardQuery(db, params, includeReligion)
  const rows = await query.execute()

  const total = rows.length > 0 ? Number(rows[0].total_count) : 0
  const limit = params.limit ?? 50
  const page = params.page ?? 1
  const totalPages = Math.ceil(total / limit)

  const countriesQuery = await getCountriesQuery(db)
  const countries = await countriesQuery.execute()

  const totals = await getLeaderboardTotals(db, params.country)

  return {
    data: rows.map((row: any) => ({
      usuario_id: row.usuario_id,
      username: row.username,
      pais_alfa2: row.pais_alfa2,
      pais_nombre: row.pais_nombre,
      learningpoints: Number(row.learningpoints),
      slearn_balance: Number(row.slearn_balance),
      scholarship_usdt: Number(row.scholarship_usdt),
      ubi_celo: Number(row.ubi_celo),
      donations_usdt: Number(row.donations_usdt),
      sbt_count: Number(row.sbt_count),
      religion: row.religion_nombre,
    })),
    totals,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
    countries: countries.map(c => ({
      alfa2: c.alfa2!,
      nombre: c.nombre,
    })),
  }
}
