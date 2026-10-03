import { describe, it, expect, vi } from 'vitest'
import { Kysely, PostgresDialect } from 'kysely'
import { buildLeaderboardQuery, buildLeaderboardRankQuery } from '../leaderboard-queries'

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

  it('ranks by the canonical order by default (R-#278)', async () => {
    const { sql } = await compiled()

    // Puntaje en Guías, donaciones, puntaje de perfil, SLEARN y `id` como desempate: el mismo
    // orden con el que se calcula el puesto, para que la pagina se lea 1, 2, 3...
    expect(sql).toContain(
      'order by guide_score desc, donations_usdt desc, COALESCE(u.profilescore, -1) desc, slearn_balance desc, "u"."id" asc',
    )
  })

  it('honors the requested sort field, still broken by user id', async () => {
    const { sql } = await compiled({ sortBy: 'guide_approved' })

    expect(sql).toContain('order by guide_approved desc, "u"."id" asc')
  })

  it('exposes the canonical position as a window function (R-#278)', async () => {
    const { sql } = await compiled()

    expect(sql).toContain('ROW_NUMBER() OVER (ORDER BY')
    expect(sql).toContain('as "canonical_rank"')
    // El orden del puesto es el canonico, no el que pidio el visitante.
    expect(sql).toContain(
      `ROW_NUMBER() OVER (ORDER BY (COALESCE(gu_counts.approved, 0) + COALESCE(gu_counts.usdt, 0) + COALESCE(gu_counts.slearn, 0)) DESC`,
    )
    expect(sql).toMatch(/COALESCE\(u\.profilescore, -1\) DESC, COALESCE\(ROUND\(SUM\(CASE WHEN t\.crypto = 'slearn'/)
    expect(sql).toContain('u.id ASC) as "canonical_rank"')
  })

  it('computes one user rank from the same canonical order (R-#278)', async () => {
    const sql = (buildLeaderboardRankQuery(makeDb(), 631) as any).compile().sql as string

    // La base se envuelve y el usuario se filtra DESPUES de calcular el puesto: por eso
    // el parametro del usuario es el septimo ($1..$6 los consumen los predicados de
    // visibilidad de la base) y no el primero.
    expect(sql).toContain('as "lb"')
    expect(sql).toContain('where "lb"."usuario_id" = $7')
    expect(sql).toContain('select "lb"."canonical_rank" as "rank"')
    expect(sql).toContain('ROW_NUMBER() OVER (ORDER BY')
    expect(sql).toContain('guide_score')
    expect(sql).toContain('u.id ASC) as "canonical_rank"')
  })
})
