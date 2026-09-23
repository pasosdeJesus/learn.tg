import { describe, it, expect } from 'vitest'
import { buildLeaderboardQuery } from '../leaderboard-queries'

// El ranking es una superficie pública más: `sbt_count` cuenta solo las
// credenciales que el dueño publica
// (https://github.com/pasosdeJesus/learn.tg/issues/259 §3.2). La consulta real
// depende de PostgreSQL, así que aquí se verifica el contrato del SQL con un
// grabador mínimo de la cadena de Kysely (el helper recibe `db` por parámetro,
// lo que permite inyectarlo sin base de datos).

interface SubRecorder {
  eb: any
  whereCalls: any[][]
  orCalls: any[][]
  selected: any
}

function makeSub(): SubRecorder {
  const whereCalls: any[][] = []
  const orCalls: any[][] = []
  const w: any = (col: string, op: string, val: any) => {
    orCalls.push([col, op, val])
    return { __or: [col, op, val] }
  }
  w.or = (expressions: any[]) => ({ __orGroup: expressions })
  const recorder: SubRecorder = { eb: null, whereCalls, orCalls, selected: null }
  const eb: any = {
    selectFrom: () => eb,
    innerJoin: () => eb,
    leftJoin: () => eb,
    select: (fields: any) => { recorder.selected = fields; return eb },
    where: (...args: any[]) => {
      if (typeof args[0] === 'function') {
        args[0](w, eb)
      } else {
        whereCalls.push(args)
      }
      return eb
    },
    groupBy: () => eb,
    as: (alias: string) => ({ alias }),
    fn: { countAll: () => ({ as: (alias: string) => ({ alias }) }) },
  }
  recorder.eb = eb
  return recorder
}

function makeDb(sub: SubRecorder) {
  const joins: any[] = []
  const db: any = {
    selectFrom: () => db,
    leftJoin: (target: any) => {
      joins.push(typeof target === 'function' ? '<subquery>' : target)
      if (typeof target === 'function') target(sub.eb)
      return db
    },
    innerJoin: () => db,
    select: () => db,
    where: () => db,
    groupBy: () => db,
    orderBy: () => db,
    limit: () => db,
    offset: () => db,
  }
  return { db, joins }
}

async function build() {
  const sub = makeSub()
  const { db, joins } = makeDb(sub)
  await buildLeaderboardQuery(db, { page: 1, limit: 50 })
  return { sub, joins }
}

describe('buildLeaderboardQuery — privacy of the SBT count', () => {
  it('joins the credentials through the privacy rule', async () => {
    const { sub, joins } = await build()

    expect(joins).toContain('<subquery>')
    expect(sub.whereCalls).toContainEqual(['e.revoked_at', 'is', null])
    expect(sub.whereCalls).toContainEqual(['u2.mostrar_cursos_publico', '=', true])
  })

  it('accepts a non-Christian course OR the Christian opt-in', async () => {
    const { sub } = await build()

    expect(sub.orCalls).toEqual([
      ['c.contenido_cristiano', '=', false],
      ['u2.mostrar_cursos_cristianos_publico', '=', true],
    ])
  })
})
