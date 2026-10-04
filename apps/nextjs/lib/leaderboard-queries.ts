import { Kysely, sql } from 'kysely'
import type { DB } from '@/db/db.d'
import type { LeaderboardQueryParams } from '@/types/leaderboard'

// Shared SQL field definitions used across leaderboard queries
const SCHOLARSHIP_FIELD = sql<number>`COALESCE(ROUND(SUM(CASE WHEN t.type = 'scholarship' AND t.crypto = 'usdt' THEN t.amount ELSE 0 END), 2), 0)`.as('scholarship_usdt')
const SCHOLARSHIP_WHERE = sql<string>`COALESCE(ROUND(SUM(CASE WHEN t.type = 'scholarship' AND t.crypto = 'usdt' THEN t.amount ELSE 0 END), 2), 0)`
const UBI_FIELD = sql<number>`COALESCE(ROUND(SUM(CASE WHEN t.type = 'ubi-claim' AND t.crypto = 'celo' THEN t.amount ELSE 0 END), 2), 0)`.as('ubi_celo')
const UBI_WHERE = sql<string>`COALESCE(ROUND(SUM(CASE WHEN t.type = 'ubi-claim' AND t.crypto = 'celo' THEN t.amount ELSE 0 END), 2), 0)`
const DONATIONS_FIELD = sql<number>`COALESCE(ROUND(SUM(CASE WHEN t.type = 'donation' AND t.crypto = 'usdt' THEN t.amount ELSE 0 END), 2), 0)`.as('donations_usdt')
const DONATIONS_WHERE = sql<string>`COALESCE(ROUND(SUM(CASE WHEN t.type = 'donation' AND t.crypto = 'usdt' THEN t.amount ELSE 0 END), 2), 0)`
const SBT_FIELD = sql<number>`COALESCE(ce_counts.cnt, 0)`.as('sbt_count')
// Referidos (https://github.com/pasosdeJesus/learn.tg/issues/163): cuantos usuarios lo
// nombraron como referidor (el total, sin distinguir pendientes de completados). Es un
// conteo, no un monto, y no forma parte del orden canonico: el puesto sigue siendo el de
// guias (`guide_score`).
const REFERRAL_COUNT_FIELD = sql<number>`COALESCE(rr_counts.cnt, 0)`.as('referral_count')
// R-#278: los marcos que la pagina del curso dibuja frente a cada guia (chulo,
// beca USDT, beca SLEARN), contados por usuario. `guide_score` es la suma de los tres y
// es la medida principal del ranking. Mismo criterio que `/api/guide-status`
// (`points > 0`, `amountpaid > 0`, y una transaccion `scholarship`/`slearn` con
// `metadata->>'guideId'` = actividadpf_id).
const GUIDE_APPROVED_FIELD = sql<number>`COALESCE(gu_counts.approved, 0)`.as('guide_approved')
const GUIDE_USDT_FIELD = sql<number>`COALESCE(gu_counts.usdt, 0)`.as('guide_usdt')
const GUIDE_SLEARN_FIELD = sql<number>`COALESCE(gu_counts.slearn, 0)`.as('guide_slearn')
const GUIDE_SCORE_WHERE = sql`(COALESCE(gu_counts.approved, 0) + COALESCE(gu_counts.usdt, 0) + COALESCE(gu_counts.slearn, 0))`
const GUIDE_SCORE_FIELD = sql<number>`${GUIDE_SCORE_WHERE}`.as('guide_score')

const SLEARN_FIELD = sql<number>`COALESCE(ROUND(SUM(CASE WHEN t.crypto = 'slearn' THEN t.balance_impact ELSE 0 END), 2), 0)`.as('slearn_balance')
const SLEARN_WHERE = sql<string>`COALESCE(ROUND(SUM(CASE WHEN t.crypto = 'slearn' THEN t.balance_impact ELSE 0 END), 2), 0)`
const SLEARN_USER_COUNT = sql<number>`COUNT(DISTINCT CASE WHEN t.crypto = 'slearn' AND t.balance_impact > 0 THEN u.id END)`.as('totalUsersWithSLEARN')

// Orden canonico del ranking (R-#278): una sola definicion, compartida por la
// columna Rank del tablero y por el puesto del perfil (`/api/user/[id]`), para que los
// dos numeros no puedan divergir. `u.id` es unico, asi que el orden es total: dentro de
// un empate la pagina ya no depende del planificador y la paginacion no repite ni salta
// usuarios. `COALESCE(profilescore, -1)` equivale a `DESC NULLS LAST`.
const CANONICAL_ORDER_SQL = sql`${GUIDE_SCORE_WHERE} DESC, ${DONATIONS_WHERE} DESC, COALESCE(u.profilescore, -1) DESC, ${SLEARN_WHERE} DESC, u.id ASC`
const CANONICAL_RANK_FIELD = sql<number>`ROW_NUMBER() OVER (ORDER BY ${CANONICAL_ORDER_SQL})`.as('canonical_rank')

// Igual, pero sobre un conjunto que incluye a quienes se excluyeron del tablero: la
// particion los separa, asi que el puesto de quien si aparece no cambia y el de quien se
// excluyo queda aparte (la ruta del perfil lo publica como `null`). El perfil lo necesita
// para poder publicar el puntaje en guias tambien de un usuario excluido.
const CANONICAL_RANK_ANY_FIELD = sql<number>`ROW_NUMBER() OVER (PARTITION BY (u.excluir_leaderboard IS NOT TRUE) ORDER BY ${CANONICAL_ORDER_SQL})`.as('canonical_rank')

// Base del ranking: los usuarios con sus agregados, la regla de visibilidad (R-#259) y
// el puesto canonico. La comparten el tablero y el puesto del perfil, para que un cambio
// en las reglas o en el orden no pueda aplicarse a uno y no al otro.
function baseLeaderboardQuery(
  db: Kysely<DB>,
  includeReligion: boolean,
  { includeOptedOut = false }: { includeOptedOut?: boolean } = {},
) {
  let query: any = db
    .selectFrom('usuario as u')
    .leftJoin('msip_pais as p', 'u.pais_id', 'p.id')
    .leftJoin('transaction as t', 'u.id', 't.usuario_id')
    .leftJoin(
      // `sbt_count` cuenta solo lo que el dueño publica (R-#259): credenciales no
      // revocadas, de cursos que el estudiante permite mostrar (y, en los marcados
      // `contenido_sensible`, solo si habilitó esa categoría). El ranking es una
      // superficie pública como cualquier otra.
      (eb) => eb.selectFrom('credential_emission as e')
        .innerJoin('usuario as u2', 'u2.id', 'e.usuario_id')
        .leftJoin('cor1440_gen_proyectofinanciero as c', 'c.id', 'e.course_id')
        .select(['e.usuario_id', eb.fn.countAll<number>().as('cnt')])
        .where('e.revoked_at', 'is', null)
        .where('u2.mostrar_cursos_publico', '=', true)
        .where((w) => w.or([
          w('c.contenido_sensible', '=', false),
          w('u2.mostrar_cursos_sensibles_publico', '=', true),
        ]))
        .groupBy('e.usuario_id')
        .as('ce_counts'),
      (join) => join.onRef('ce_counts.usuario_id', '=', 'u.id')
    )
    .leftJoin(
      // R-#278: los conteos de guias por usuario. Misma regla de visibilidad que
      // `ce_counts` (R-#259): un curso de categoria B solo cuenta si el dueno
      // publica esa categoria.
      (eb) => eb.selectFrom('guide_usuario as gu')
        .innerJoin('cor1440_gen_actividadpf as a', 'a.id', 'gu.actividadpf_id')
        .leftJoin('cor1440_gen_proyectofinanciero as c', 'c.id', 'a.proyectofinanciero_id')
        .innerJoin('usuario as u2', 'u2.id', 'gu.usuario_id')
        .select([
          'gu.usuario_id',
          sql<number>`COUNT(DISTINCT gu.actividadpf_id) FILTER (WHERE gu.points > 0)`.as('approved'),
          sql<number>`COUNT(DISTINCT gu.actividadpf_id) FILTER (WHERE gu.amountpaid > 0)`.as('usdt'),
          sql<number>`COUNT(DISTINCT gu.actividadpf_id) FILTER (WHERE EXISTS (SELECT 1 FROM transaction t2 WHERE t2.usuario_id = gu.usuario_id AND t2.type = 'scholarship' AND t2.crypto = 'slearn' AND t2.metadata->>'guideId' = gu.actividadpf_id::text))`.as('slearn'),
        ])
        .where('u2.mostrar_cursos_publico', '=', true)
        .where((w) => w.or([
          w('c.contenido_sensible', '=', false),
          w('u2.mostrar_cursos_sensibles_publico', '=', true),
        ]))
        .groupBy('gu.usuario_id')
        .as('gu_counts'),
      (join) => join.onRef('gu_counts.usuario_id', '=', 'u.id')
    )
    .leftJoin(
      // Los referidos se cuentan en su propia subconsulta (agrupada por referidor) para no
      // fanear los demas agregados: el join con `transaction` ya multiplica filas.
      (eb) => eb.selectFrom('referralrelationship as rr')
        .select(['rr.referrer_id', eb.fn.countAll<number>().as('cnt')])
        .groupBy('rr.referrer_id')
        .as('rr_counts'),
      (join) => join.onRef('rr_counts.referrer_id', '=', 'u.id')
    )

  if (includeReligion) {
    query = query.leftJoin('religion as r', 'u.religion_id', 'r.id')
  }

  let selectFields: any[] = [
    'u.id as usuario_id',
    'u.nusuario as username',
    'p.alfa2 as pais_alfa2',
    'p.nombre as pais_nombre',
    'u.profilescore',
    SLEARN_FIELD,
    SCHOLARSHIP_FIELD,
    UBI_FIELD,
    DONATIONS_FIELD,
    SBT_FIELD,
    REFERRAL_COUNT_FIELD,
    GUIDE_APPROVED_FIELD,
    GUIDE_USDT_FIELD,
    GUIDE_SLEARN_FIELD,
    GUIDE_SCORE_FIELD,
    includeOptedOut ? CANONICAL_RANK_ANY_FIELD : CANONICAL_RANK_FIELD,
    sql<number>`COUNT(*) OVER()`.as('total_count'),
  ]

  let groupFields: any[] = [
    'u.id', 'u.nusuario', 'p.alfa2', 'p.nombre', 'u.profilescore', 'ce_counts.cnt',
    'gu_counts.approved', 'gu_counts.usdt', 'gu_counts.slearn', 'rr_counts.cnt',
  ]

  if (includeReligion) {
    selectFields.push('r.nombre as religion_nombre')
    groupFields.push('r.nombre')
  }

  query = query
    .select(selectFields)
    .groupBy(groupFields)

  // El tablero deja fuera a quien se excluyo del ranking; el perfil necesita su puntaje en
  // guias de todas formas, por eso la opcion.
  if (!includeOptedOut) {
    query = query.where('u.excluir_leaderboard', 'is not', true)
  }

  return query
}

export async function buildLeaderboardQuery(
  db: Kysely<DB>,
  params: LeaderboardQueryParams,
  includeReligion: boolean = false
) {
  const { sortBy = 'guide_score', sortOrder = 'desc', country, page = 1, limit = 50 } = params
  const offset = (page - 1) * limit

  let query: any = baseLeaderboardQuery(db, includeReligion)

  if (country) {
    query = query.where('p.alfa2', '=', country)
  }

  if (sortBy === 'guide_score' && sortOrder !== 'asc') {
    // El orden por defecto de la pagina es el canonico (R-#278): asi los puestos de la
    // columna Rank se leen 1, 2, 3... y el orden visible coincide con el orden del puesto.
    query = query
      .orderBy(sql`guide_score`, 'desc')
      .orderBy(sql`donations_usdt`, 'desc')
      .orderBy(sql`COALESCE(u.profilescore, -1)`, 'desc')
      .orderBy(sql`slearn_balance`, 'desc')
  } else if (sortBy === 'profilescore') {
    query = query.orderBy(sql`profilescore`, sortOrder === 'asc' ? sql`asc nulls first` : sql`desc nulls last`)
  } else {
    const orderByField = sortBy === 'slearn_balance' ? sql`slearn_balance` :
                        sortBy === 'scholarship_usdt' ? sql`scholarship_usdt` :
                        sortBy === 'ubi_celo' ? sql`ubi_celo` :
                        sortBy === 'sbt_count' ? sql`sbt_count` :
                        sortBy === 'guide_approved' ? sql`guide_approved` :
                        sortBy === 'guide_usdt' ? sql`guide_usdt` :
                        sortBy === 'guide_slearn' ? sql`guide_slearn` :
                        sortBy === 'guide_score' ? sql`guide_score` :
                        sql`donations_usdt`
    query = query.orderBy(orderByField, sortOrder)
  }

  // Desempate determinista (R-#278): sin el, el orden entre empates lo decide el
  // planificador y la paginacion puede repetir o saltar usuarios.
  query = query.orderBy('u.id', 'asc')

  query = query.limit(limit).offset(offset)

  return query
}

// Puesto canonico y puntaje en guias de un usuario. La base se envuelve para poder filtrar
// al usuario DESPUES de calcular `ROW_NUMBER()`: si el filtro fuera dentro de la base el
// puesto seria siempre 1. Asi el perfil usa exactamente el mismo orden y las mismas reglas
// de visibilidad (R-#259) que el tablero, y el puntaje no se puede calcular de dos formas
// distintas. Es una sola consulta para las dos cifras.
export function buildUserLeaderboardStatsQuery(db: Kysely<DB>, userId: number): any {
  const base: any = baseLeaderboardQuery(db, false, { includeOptedOut: true })

  return db
    .selectFrom(base.as('lb'))
    .select([
      sql<number>`"lb"."canonical_rank"`.as('rank'),
      sql<number>`"lb"."guide_score"`.as('guide_score'),
    ])
    .where(sql<boolean>`"lb"."usuario_id" = ${userId}`)
}

export async function getUserLeaderboardStats(
  db: Kysely<DB>,
  userId: number
): Promise<{ rank: number | null; guideScore: number }> {
  const row = await buildUserLeaderboardStatsQuery(db, userId).executeTakeFirst()
  return {
    rank: row?.rank == null ? null : Number(row.rank),
    guideScore: Number(row?.guide_score ?? 0),
  }
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
      SLEARN_USER_COUNT,
      SLEARN_WHERE.as('totalSLEARNBalance'),
      SCHOLARSHIP_WHERE.as('totalScholarshipUSDT'),
      UBI_WHERE.as('totalUBICELO'),
      DONATIONS_WHERE.as('totalDonationsUSDT'),
    ])
    .executeTakeFirst()

  return {
    totalUsers: Number(result?.totalUsers || 0),
    totalUsersWithSLEARN: Number(result?.totalUsersWithSLEARN || 0),
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
      SLEARN_USER_COUNT,
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
    totalUsersWithSLEARN: Number(row.totalUsersWithSLEARN || 0),
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
      profilescore: row.profilescore != null ? Number(row.profilescore) : null,
      slearn_balance: Number(row.slearn_balance),
      scholarship_usdt: Number(row.scholarship_usdt),
      ubi_celo: Number(row.ubi_celo),
      donations_usdt: Number(row.donations_usdt),
      sbt_count: Number(row.sbt_count),
      referral_count: Number(row.referral_count),
      guide_approved: Number(row.guide_approved),
      guide_usdt: Number(row.guide_usdt),
      guide_slearn: Number(row.guide_slearn),
      guide_score: Number(row.guide_score),
      canonical_rank: Number(row.canonical_rank),
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
