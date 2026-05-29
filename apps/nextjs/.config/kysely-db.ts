import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import type { DB } from '@/db/db.d.ts'

/**
 * Creates a new Kysely DB connection from PG* environment variables.
 * No CLI dependencies — safe for Next.js server runtime.
 */
export function newKyselyPostgresql() {
  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({
        host: process.env.PGHOST,
        database: process.env.PGDATABASE,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        port: 5432,
      }),
    }),
  })
}
