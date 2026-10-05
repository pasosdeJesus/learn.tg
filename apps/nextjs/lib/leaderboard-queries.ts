import { Kysely, sql } from 'kysely'
import type { DB } from '@/db/db.d'
import type { LeaderboardQueryParams } from '@/types/leaderboard'

// ── Campos de la base (L1) ───────────────────────────────────────────────
const SCHOLARSHIP_FIELD = sql<number>`COALESCE(ROUND(SUM(CASE WHEN t.type = 'scholarship' AND t.crypto = 'usdt' THEN t.amount ELSE 0 END), 2), 0)`.as('scholarship_usdt')
const SCHOLARSHIP_WHERE = sql<string>`COALESCE(ROUND(SUM(CASE WHEN t.type = 'scholarship' AND t.crypto = 'usdt' THEN t.amount ELSE 0 END), 2), 0)`
const UBI_FIELD = sql<number>`COALESCE(ROUND(SUM(CASE WHEN t.type = 'ubi-claim' AND t.crypto = 'celo' THEN t.amount ELSE 0 END), 2), 0)`.as('ubi_celo')
const UBI_WHERE = sql<string>`COALESCE(ROUND(SUM(CASE WHEN t.type = 'ubi-claim' AND t.crypto = 'celo' THEN t.amount ELSE 0 END), 2), 0)`
const DONATIONS_FIELD = sql<number>`COALESCE(ROUND(SUM(CASE WHEN t.type = 'donation' AND t.crypto = 'usdt' THEN t.amount ELSE 0 END), 2), 0)`.as('donations_usdt')
const DONATIONS_WHERE = sql<string>`COALESCE(ROUND(SUM(CASE WHEN t.type = 'donation' AND t.crypto = 'usdt' THEN t.amount ELSE 0 END), 2), 0)`
const SBT_FIELD = sql<number>`COALESCE(ce_counts.cnt, 0)`.as('sbt_count')
// Referidos (https://github.com/pasosdeJesus/learn.tg/issues/163): cuantos usuarios lo
// nombraron como referidor (el total, sin distinguir pendientes de completados).
const REFERRAL_COUNT_FIELD = sql<number>`COALESCE(rr_counts.cnt, 0)`.as('referral_count')
// R-#278 §2: los marcos que la pagina del curso dibuja frente a cada guia (chulo, beca
// USDT, beca SLEARN), contados por usuario. `guide_score` es su suma. Mismo criterio que
// `/api/guide-status` (`points > 0`, `amountpaid > 0`, y una transaccion
// `scholarship`/`slearn` con `metadata->>'guideId'` = actividadpf_id).
const GUIDE_APPROVED_FIELD = sql<number>`COALESCE(gu_counts.approved, 0)`.as('guide_approved')
const GUIDE_USDT_FIELD = sql<number>`COALESCE(gu_counts.usdt, 0)`.as('guide_usdt')
const GUIDE_SLEARN_FIELD = sql<number>`COALESCE(gu_counts.slearn, 0)`.as('guide_slearn')
const GUIDE_SCORE_WHERE = sql`(COALESCE(gu_counts.approved, 0) + COALESCE(gu_counts.usdt, 0) + COALESCE(gu_counts.slearn, 0))`
const GUIDE_SCORE_FIELD = sql<number>`${GUIDE_SCORE_WHERE}`.as('guide_score')
const SLEARN_FIELD = sql<number>`COALESCE(ROUND(SUM(CASE WHEN t.crypto = 'slearn' THEN t.balance_impact ELSE 0 END), 2), 0)`.as('slearn_balance')
const SLEARN_WHERE = sql<string>`COALESCE(ROUND(SUM(CASE WHEN t.crypto = 'slearn' THEN t.balance_impact ELSE 0 END), 2), 0)`
const SLEARN_USER_COUNT = sql<number>`COUNT(DISTINCT CASE WHEN t.crypto = 'slearn' AND t.balance_impact > 0 THEN u.id END)`.as('totalUsersWithSLEARN')
// Region del dueño de la fila (no la del visitante). Sin clasificar (`tipo_region` NULL)
// se trata como region tipo 1: no se oculta nada.
const TIPO_REGION_FIELD = sql<number>`COALESCE(p.tipo_region, 1)`.as('tipo_region')

// ── platform_score (§4) ────────────────────────────────────────────────
// Pesos de los seis componentes. Se interpolan como texto (`sql.raw`) para no
// introducir parametros en la lista de seleccion: eso desplazaria los `$1..$N` de los
// joins y romperia las aserciones sobre el SQL generado.
const W_GUIDE = sql.raw('0.35')
const W_REFERRAL = sql.raw('0.15')
const W_DONATIONS = sql.raw('0.15')
const W_SBT = sql.raw('0.15')
const W_SLEARN = sql.raw('0.10')
const W_PROFILE = sql.raw('0.10')
// Peso disponible cuando el dueño esta en region tipo 2: su puntaje omite
// `referral_count` y `profilescore`, que estan ocultos, y renormaliza para seguir en 0-100.
const W_VISIBLE_REGION_2 = sql.raw('0.75')

/**
 * Normaliza un componente a 0..1 con min-max sobre `ln(1 + x)`.
 *
 *   c(x) = ln(1 + max(x, 0))                                  (comprime la cola)
 *   n(x) = (c(x) - min c(x)) / (max c(x) - min c(x))
 *
 * Se eligio sobre `percent_rank()` porque en las variables sesgadas (referidos,
 * donaciones, SBT) el percentil convertia el peso en un bonus binario: el primer
 * referido saltaba al percentil maximo. `COALESCE(..., 0)` cubre el componente plano
 * (max = min) y la poblacion de una sola fila: aportan 0, no NaN.
 */
const normSql = (column: any) => sql<number>`COALESCE((ln(1 + GREATEST(${column}, 0)) - MIN(ln(1 + GREATEST(${column}, 0))) OVER ()) / NULLIF(MAX(ln(1 + GREATEST(${column}, 0))) OVER () - MIN(ln(1 + GREATEST(${column}, 0))) OVER (), 0), 0)`

const NORMALIZED_FIELDS = [
  normSql(sql`"lb"."guide_score"`).as('n_guide'),
  normSql(sql`"lb"."referral_count"`).as('n_referral'),
  normSql(sql`"lb"."donations_usdt"`).as('n_donations'),
  normSql(sql`"lb"."sbt_count"`).as('n_sbt'),
  normSql(sql`"lb"."slearn_balance"`).as('n_slearn'),
  normSql(sql`"lb"."profilescore"`).as('n_profile'),
]

/**
 * `platform_score`: suma ponderada (0-100) de los seis componentes normalizados.
 * Es el criterio principal del ranking. En region tipo 2 omite los componentes ocultos
 * (`referral_count`, `profilescore`) y renormaliza, para que el orden publicado de esa
 * fila no dependa de datos que la plataforma no publica.
 */
const platformScoreSql = () => sql<number>`ROUND((100 * (CASE WHEN "lb"."tipo_region" = 2
  THEN (${W_GUIDE} * "lb"."n_guide" + ${W_DONATIONS} * "lb"."n_donations" + ${W_SBT} * "lb"."n_sbt" + ${W_SLEARN} * "lb"."n_slearn") / ${W_VISIBLE_REGION_2}
  ELSE (${W_GUIDE} * "lb"."n_guide" + ${W_REFERRAL} * "lb"."n_referral" + ${W_DONATIONS} * "lb"."n_donations" + ${W_SBT} * "lb"."n_sbt" + ${W_SLEARN} * "lb"."n_slearn" + ${W_PROFILE} * "lb"."n_profile")
END))::numeric, 2)`

// ── L1: agregados por usuario ────────────────────────────────────────────
// Poblacion del tablero (`excluir_leaderboard IS NOT TRUE`), o incluyendo a los
// excluidos (`includeOptedOut`) para poder publicar su puntaje en guias en el perfil.
// **Sin filtro de pais**: el filtro se aplica despues de las ventanas, para que el
// puntaje y el puesto de un estudiante no dependan del filtro del visitante.
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
      // R-#278 §2: los conteos de guias por usuario. Misma regla de visibilidad que
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
    TIPO_REGION_FIELD,
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
  ]

  const groupFields: any[] = [
    'u.id', 'u.nusuario', 'p.alfa2', 'p.nombre', 'p.tipo_region', 'u.profilescore',
    'ce_counts.cnt', 'gu_counts.approved', 'gu_counts.usdt', 'gu_counts.slearn',
    'rr_counts.cnt',
  ]

  if (includeReligion) {
    selectFields.push('r.nombre as religion_nombre')
    groupFields.push('r.nombre')
  }

  query = query.select(selectFields).groupBy(groupFields)

  // El tablero deja fuera a quien se excluyo del ranking; el perfil necesita su puntaje
  // en guias de todas formas, por eso la opcion.
  if (!includeOptedOut) {
    query = query.where('u.excluir_leaderboard', 'is not', true)
  }

  return query
}

// ── L2: normalizacion de los seis componentes (§4) ──────────────────────
// Las ventanas se calculan sobre la poblacion completa de L1, antes de cualquier filtro.
function normalizedLeaderboardQuery(
  db: Kysely<DB>,
  includeReligion: boolean,
  opts: { includeOptedOut?: boolean } = {},
) {
  const base: any = baseLeaderboardQuery(db, includeReligion, opts)
  return db.selectFrom(base.as('lb')).selectAll('lb').select(NORMALIZED_FIELDS)
}

// ── L3: platform_score y puesto canonico ────────────────────────────────
// El puesto es la posicion global en el orden canonico
// (`platform_score DESC, usuario_id ASC`), asi que no depende de la columna por la que
// el visitante ordene ni del filtro de pais.
function scoredLeaderboardQuery(
  db: Kysely<DB>,
  includeReligion: boolean,
  opts: { includeOptedOut?: boolean } = {},
) {
  const normalized: any = normalizedLeaderboardQuery(db, includeReligion, opts)
  return db
    .selectFrom(normalized.as('lb'))
    .selectAll('lb')
    .select([
      platformScoreSql().as('platform_score'),
      sql<number>`ROW_NUMBER() OVER (ORDER BY ${platformScoreSql()} DESC, "lb"."usuario_id" ASC)`.as('canonical_rank'),
    ])
}

// ── L4: la consulta del tablero ─────────────────────────────────────────
export async function buildLeaderboardQuery(
  db: Kysely<DB>,
  params: LeaderboardQueryParams,
  includeReligion: boolean = false
) {
  const { sortBy = 'platform_score', sortOrder = 'desc', country, page = 1, limit = 50 } = params
  const offset = (page - 1) * limit

  const scored: any = scoredLeaderboardQuery(db, includeReligion)

  let query: any = db
    .selectFrom(scored.as('lb'))
    .selectAll('lb')
    .select(sql<number>`COUNT(*) OVER()`.as('total_count'))

  if (country) {
    query = query.where('pais_alfa2', '=', country)
  }

  // Lista blanca explicita: el nombre recibido no se interpola crudo (la ruta lo valida
  // con zod, pero la funcion tambien se usa desde los tests). `profilescore` y
  // `referral_count` no estan: no se publican por fila (§4.1), asi que tampoco se ordena
  // por ellos (el orden los revelaria).
  const SORT_FIELDS: Record<string, any> = {
    platform_score: sql`platform_score`,
    guide_score: sql`guide_score`,
    guide_approved: sql`guide_approved`,
    guide_usdt: sql`guide_usdt`,
    guide_slearn: sql`guide_slearn`,
    slearn_balance: sql`slearn_balance`,
    scholarship_usdt: sql`scholarship_usdt`,
    ubi_celo: sql`ubi_celo`,
    donations_usdt: sql`donations_usdt`,
    sbt_count: sql`sbt_count`,
  }
  query = query.orderBy(SORT_FIELDS[sortBy] ?? SORT_FIELDS.platform_score, sortOrder)

  // Desempate determinista: sin el, el orden entre empates lo decide el planificador y la
  // paginacion puede repetir o saltar usuarios.
  query = query.orderBy(sql`usuario_id`, 'asc')

  query = query.limit(limit).offset(offset)

  return query
}

// ── Perfil ──────────────────────────────────────────────────────────────
// Puesto y puntaje en guias de un usuario: la misma consulta del tablero, filtrada al
// usuario DESPUES de calcular las ventanas (si el filtro fuera dentro, el puesto seria 1).
// El `platform_score` no se devuelve: solo ordena (R-#278 §4.1).
export function buildUserLeaderboardStatsQuery(db: Kysely<DB>, userId: number): any {
  const scored: any = scoredLeaderboardQuery(db, false)

  return db
    .selectFrom(scored.as('lb'))
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

// Puntaje en guias de un usuario que se excluyo del tablero: no tiene puesto (no esta en
// la poblacion) pero su trabajo si se publica. Es la unica cifra del tablero que no
// depende de la poblacion, asi que se puede leer sola.
export async function getUserGuideScore(db: Kysely<DB>, userId: number): Promise<number> {
  const base: any = baseLeaderboardQuery(db, false, { includeOptedOut: true })
  const row = await db
    .selectFrom(base.as('lb'))
    .select([sql<number>`"lb"."guide_score"`.as('guide_score')])
    .where(sql<boolean>`"lb"."usuario_id" = ${userId}`)
    .executeTakeFirst()

  return Number(row?.guide_score ?? 0)
}

// ── Catalogos y totales ─────────────────────────────────────────────────
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
      // Referidos (R-#163): el total de la plataforma (o del pais filtrado) es el unico
      // lugar donde el numero se publica; por fila ya no sale (R-#278 §4.1).
      sql<number>`(SELECT COUNT(*) FROM referralrelationship rr
        INNER JOIN usuario ur ON ur.id = rr.referrer_id
        LEFT JOIN msip_pais up ON up.id = ur.pais_id
        WHERE ur.excluir_leaderboard IS NOT TRUE${country ? sql` AND up.alfa2 = ${country}` : sql``})`.as('totalReferrals'),
    ])
    .executeTakeFirst()

  return {
    totalUsers: Number(result?.totalUsers || 0),
    totalUsersWithSLEARN: Number(result?.totalUsersWithSLEARN || 0),
    totalSLEARNBalance: Number(result?.totalSLEARNBalance || 0),
    totalScholarshipUSDT: Number(result?.totalScholarshipUSDT || 0),
    totalUBICELO: Number(result?.totalUBICELO || 0),
    totalDonationsUSDT: Number(result?.totalDonationsUSDT || 0),
    totalReferrals: Number(result?.totalReferrals || 0),
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
        slearn_balance: Number(row.slearn_balance),
        scholarship_usdt: Number(row.scholarship_usdt),
        ubi_celo: Number(row.ubi_celo),
        donations_usdt: Number(row.donations_usdt),
        sbt_count: Number(row.sbt_count),
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
