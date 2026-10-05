import { describe, it, expect, vi } from 'vitest'
import { Kysely, PostgresDialect } from 'kysely'
import { buildLeaderboardQuery, buildUserLeaderboardStatsQuery } from '../leaderboard-queries'

// `vitest.setup.ts` mockea `kysely` para toda la suite; aquí se necesita el real para
// **compilar** el SQL (no se ejecuta contra ninguna base).
vi.unmock('kysely')

// El ranking es una superficie pública más: los conteos (SBTs y ahora los marcos por
// guía de R-#278) deben aplicar la misma regla de visibilidad
// (https://github.com/pasosdeJesus/learn.tg/issues/259). La consulta real depende de
// PostgreSQL, pero Kysely **compila** el SQL sin conectarse, así que aquí se verifica
// el SQL generado en vez de la base de datos.

function makeDb(): any {
  return new Kysely({ dialect: new PostgresDialect({ pool: {} as any }) })
}

async function compiled(params: Record<string, unknown> = {}) {
  const query = await buildLeaderboardQuery(makeDb(), { page: 1, limit: 50, ...params } as any)
  return query.compile() as { sql: string }
}

describe('buildLeaderboardQuery — privacy and the guide counts (R-#278)', () => {
  it('applies the R-#259 visibility rule to the SBT count', async () => {
    const { sql } = await compiled()

    expect(sql).toContain('"e"."revoked_at" is null')
    expect(sql).toContain('"u2"."mostrar_cursos_publico" = $1')
    expect(sql).toContain('"u2"."mostrar_cursos_sensibles_publico" = $3')
  })

  it('applies the same rule to the guide counts', async () => {
    const { sql } = await compiled()

    expect(sql).toContain('from "guide_usuario" as "gu"')
    expect(sql).toContain('"u2"."mostrar_cursos_publico" = $4')
    expect(sql).toContain('"u2"."mostrar_cursos_sensibles_publico" = $6')
  })

  it('counts the three guide marks and sums them in "guide_score"', async () => {
    const { sql } = await compiled()

    expect(sql).toContain('COUNT(DISTINCT gu.actividadpf_id) FILTER (WHERE gu.points > 0) as "approved"')
    expect(sql).toContain('COUNT(DISTINCT gu.actividadpf_id) FILTER (WHERE gu.amountpaid > 0) as "usdt"')
    expect(sql).toMatch(/t2\.type = 'scholarship' AND t2\.crypto = 'slearn'/)
    expect(sql).toMatch(/t2\.metadata->>'guideId' = gu\.actividadpf_id::text/)
    expect(sql).toContain(
      '(COALESCE(gu_counts.approved, 0) + COALESCE(gu_counts.usdt, 0) + COALESCE(gu_counts.slearn, 0)) as "guide_score"',
    )
  })

  it('counts the referrals of each student, apart from the aggregates (R-#163)', async () => {
    const { sql } = await compiled()

    // Conteo propio, agrupado por referidor: no puede fanear los demas agregados.
    expect(sql).toContain('from "referralrelationship" as "rr"')
    expect(sql).toContain('group by "rr"."referrer_id"')
    expect(sql).toContain('as "rr_counts"')
    expect(sql).toContain('COALESCE(rr_counts.cnt, 0) as "referral_count"')
  })

  it('leaves the opted-out users out of the board (R-#278)', async () => {
    const { sql } = await compiled()

    expect(sql).toContain('"u"."excluir_leaderboard" is not true')
  })

  it('normalizes the six components with min-max over ln(1 + x) (R-#278 §10)', async () => {
    const { sql } = await compiled()

    // Un solo criterio de normalizacion para los seis componentes.
    for (const col of ['guide_score', 'referral_count', 'donations_usdt', 'sbt_count', 'slearn_balance', 'profilescore']) {
      expect(sql).toContain(`ln(1 + GREATEST("lb"."${col}", 0))`)
      expect(sql).toContain(`MIN(ln(1 + GREATEST("lb"."${col}", 0))) OVER ()`)
      expect(sql).toContain(`MAX(ln(1 + GREATEST("lb"."${col}", 0))) OVER ()`)
    }
    // Los pesos, y el caso de region tipo 2 que renormaliza sobre los visibles (0.75).
    expect(sql).toContain('0.35 * "lb"."n_guide"')
    expect(sql).toContain('0.15 * "lb"."n_referral"')
    expect(sql).toContain('0.10 * "lb"."n_profile"')
    expect(sql).toContain('CASE WHEN "lb"."tipo_region" = 2')
    expect(sql).toContain('/ 0.75')
    expect(sql).toContain('as "platform_score"')
  })

  it('leaves the region of the owner in the row, with NULL as region type 1 (R-#278 §10.4)', async () => {
    const { sql } = await compiled()

    expect(sql).toContain('COALESCE(p.tipo_region, 1) as "tipo_region"')
  })

  it('ranks by platform_score, tie-broken by the user id (R-#278 §10.3)', async () => {
    const { sql } = await compiled()

    expect(sql).toContain('order by platform_score desc, usuario_id asc')
  })

  it('honors the requested sort field, still broken by user id', async () => {
    const { sql } = await compiled({ sortBy: 'guide_approved' })

    expect(sql).toContain('order by guide_approved desc, usuario_id asc')
  })

  it('exposes the canonical position as a window function (R-#278 §10.3)', async () => {
    const { sql } = await compiled()

    expect(sql).toContain('ROW_NUMBER() OVER (ORDER BY')
    expect(sql).toContain('as "canonical_rank"')
    // El puesto ordena por el puntaje de plataforma (el mismo que la columna), y el `id`
    // es el unico desempate.
    expect(sql).toContain('ASC) as "canonical_rank"')
    expect(sql).toContain('DESC, "lb"."usuario_id" ASC) as "canonical_rank"')
  })

  it('computes the rank, the guide score and the platform score of one user (R-#278 §10)', async () => {
    const sql = (buildUserLeaderboardStatsQuery(makeDb(), 631) as any).compile().sql as string

    // El usuario se filtra DESPUES de las ventanas: si el filtro fuera dentro, su puesto
    // seria 1. Por eso el parametro del usuario es el septimo ($1..$6 los consumen los
    // predicados de visibilidad de la base).
    expect(sql).toContain('as "lb"')
    expect(sql).toContain('where "lb"."usuario_id" = $7')
    expect(sql).toContain('"lb"."canonical_rank" as "rank", "lb"."guide_score" as "guide_score", "lb"."platform_score" as "platform_score"')
    // La poblacion del perfil es la del tablero: la misma consulta, sin el filtro de pais.
    expect(sql).toContain('"u"."excluir_leaderboard" is not true')
    expect(sql).not.toContain('limit')
  })
})
