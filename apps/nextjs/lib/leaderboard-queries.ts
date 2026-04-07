import { Kysely, sql } from 'kysely'
import type { DB } from '@/db/db.d'
import type { LeaderboardQueryParams } from '@/types/leaderboard'

/**
 * Construye la consulta base del leaderboard con filtros y ordenamiento
 * Devuelve la consulta Kysely para que el llamador pueda ejecutarla
 */
export async function buildLeaderboardQuery(
  db: Kysely<DB>,
  params: LeaderboardQueryParams,
  includeReligion: boolean = false
) {
  const { sortBy = 'learningpoints', sortOrder = 'desc', country, page = 1, limit = 50 } = params
  const offset = (page - 1) * limit

  // Construir consulta base
  let query: any = db
    .selectFrom('usuario as u')
    .leftJoin('msip_pais as p', 'u.pais_id', 'p.id')
    .leftJoin('transaction as t', 'u.id', 't.usuario_id')
  
  if (includeReligion) {
    query = query.leftJoin('religion as r', 'u.religion_id', 'r.id')
  }

  let selectFields: any[] = [
    'u.id as usuario_id',
    'u.nusuario as username',
    'p.alfa2 as pais_alfa2',
    'p.nombre as pais_nombre',
    sql<number>`COALESCE(SUM(CASE WHEN t.crypto = 'learningpoints' THEN t.impacto_balance ELSE 0 END), 0)`.as('learningpoints'),
    sql<number>`COALESCE(SUM(CASE WHEN t.tipo = 'scholarship' AND t.crypto = 'usdt' THEN t.cantidad ELSE 0 END), 0)`.as('scholarship_usdt'),
    sql<number>`COALESCE(SUM(CASE WHEN t.tipo = 'ubi-claim' AND t.crypto = 'celo' THEN t.cantidad ELSE 0 END), 0)`.as('ubi_celo'),
    sql<number>`COALESCE(SUM(CASE WHEN t.tipo = 'donation' AND t.crypto = 'usdt' THEN t.cantidad ELSE 0 END), 0)`.as('donations_usdt'),
    sql<number>`COUNT(*) OVER()`.as('total_count'),
  ]

  let groupFields: any[] = ['u.id', 'u.nusuario', 'p.alfa2', 'p.nombre']

  if (includeReligion) {
    selectFields.push('r.nombre as religion_nombre')
    groupFields.push('r.nombre')
  }

  query = query
    .select(selectFields)
    .groupBy(groupFields)
    .where('u.excluir_leaderboard', 'is not', true)

  // Aplicar filtro por país si existe
  if (country) {
    query = query.where('p.alfa2', '=', country)
  }

  // Ordenamiento
  const orderByField = sortBy === 'learningpoints' ? sql`learningpoints` :
                      sortBy === 'scholarship_usdt' ? sql`scholarship_usdt` :
                      sortBy === 'ubi_celo' ? sql`ubi_celo` :
                      sql`donations_usdt`

  query = query.orderBy(orderByField, sortOrder)

  // Paginación
  query = query.limit(limit).offset(offset)

  return query
}

/**
 * Obtiene la lista de países únicos para el filtro (solo países con código alfa2)
 */
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

/**
 * Ejecuta la consulta del leaderboard y devuelve los resultados formateados
 * Incluye paginación y lista de países
 */
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

  return {
    data: rows.map((row: any) => ({
      usuario_id: row.usuario_id,
      username: row.username,
      pais_alfa2: row.pais_alfa2,
      pais_nombre: row.pais_nombre,
      learningpoints: Number(row.learningpoints),
      scholarship_usdt: Number(row.scholarship_usdt),
      ubi_celo: Number(row.ubi_celo),
      donations_usdt: Number(row.donations_usdt),
      religion: (row as any).religion_nombre,
    })),
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