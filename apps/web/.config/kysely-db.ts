import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import type { DB } from '@/db/db.d.ts'

/**
 * Un solo pool de PostgreSQL por proceso.
 *
 * Antes esta función creaba un `pg.Pool` en **cada** llamada y las rutas la llaman
 * una vez por petición: bajo carga eso agota las conexiones de PostgreSQL y paga el
 * handshake en cada request (ver `@pasosdejesus/m` → `wba`, "Connection lifecycle").
 * Ahora el pool y el `Kysely` se crean una vez y se comparten; las rutas **no**
 * deben llamar `db.destroy()` (cerrarían el pool compartido y todas las peticiones
 * siguientes fallarían con `Cannot use a pool after calling end on the pool`).
 *
 * El pool vive en `globalThis` para sobrevivir a las recargas de módulos de `next dev`
 * (cada recarga reevalúa el módulo) y para compartirse entre los bundles de ruta;
 * en producción se crea una vez por proceso. Si cambian los ajustes de conexión
 * (por ejemplo al alternar la base de pruebas), se crea otro pool y se cierra el
 * anterior.
 */
type DbGlobals = {
  __learntgPool?: Pool
  __learntgDb?: Kysely<DB>
  __learntgPoolKey?: string
}

const globalForDb = globalThis as unknown as DbGlobals

function connectionSettings() {
  const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'
  return {
    host: process.env.PGHOST,
    database: isTest ? (process.env.PGDATABASE_TEST || process.env.PGDATABASE) : process.env.PGDATABASE,
    user: isTest ? (process.env.PGUSER_TEST || process.env.PGUSER) : process.env.PGUSER,
    password: isTest ? (process.env.PGPASSWORD_TEST || process.env.PGPASSWORD) : process.env.PGPASSWORD,
    port: 5432,
  }
}

export function newKyselyPostgresql(): Kysely<DB> {
  const settings = connectionSettings()
  const key = [settings.host, settings.database, settings.user, settings.port].join('|')

  if (globalForDb.__learntgDb && globalForDb.__learntgPoolKey === key) {
    return globalForDb.__learntgDb
  }

  if (globalForDb.__learntgPool) {
    void globalForDb.__learntgPool.end().catch(() => {})
  }

  const pool = new Pool({
    ...settings,
    max: Number(process.env.PG_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  })
  const db = new Kysely<DB>({ dialect: new PostgresDialect({ pool }) })

  globalForDb.__learntgPool = pool
  globalForDb.__learntgDb = db
  globalForDb.__learntgPoolKey = key
  return db
}
