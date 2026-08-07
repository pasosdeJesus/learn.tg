import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import type { DB } from '@/db/db.d.ts'

/**
 * Creates a new Kysely DB connection from PG* environment variables.
 * Prefers PG*_TEST variants in test environments (NODE_ENV=test or vitest).
 * No CLI dependencies — safe for Next.js server runtime.
 */
export function newKyselyPostgresql() {
  const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'
  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({
        host: process.env.PGHOST,
        database: isTest ? (process.env.PGDATABASE_TEST || process.env.PGDATABASE) : process.env.PGDATABASE,
        user: isTest ? (process.env.PGUSER_TEST || process.env.PGUSER) : process.env.PGUSER,
        password: isTest ? (process.env.PGPASSWORD_TEST || process.env.PGPASSWORD) : process.env.PGPASSWORD,
        port: 5432,
      }),
    }),
  })
}
