import 'dotenv/config'
import { Kysely, PostgresDialect } from 'kysely'
import { defineConfig, getKnexTimestampPrefix } from 'kysely-ctl'
import { Pool } from 'pg'

import type { DB } from '@/db/db.d.ts'

// Re-export from the runtime-safe module for backward compatibility.
// Runtime code should import from '@/.config/kysely-db' directly to
// avoid pulling in kysely-ctl in Next.js server bundles.
export { newKyselyPostgresql } from './kysely-db'

export default defineConfig({
  dialect: new PostgresDialect({
    pool: new Pool({
      host: process.env.PGHOST,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      port: 5432,
    }),
  }),
  // `allowUnorderedMigrations`: el motor `wallet` trae su migracion con un sello fijo
  // temprano (`20260101000000_wallet_model.ts`) que ordena antes que migraciones ya
  // aplicadas; es idempotente (`IF NOT EXISTS`) y en bases existentes es una no-op.
  // https://github.com/pasosdeJesus/learn.tg/issues/265
  migrations: {
    migrationFolder: '../db/migrations',
    getMigrationPrefix: getKnexTimestampPrefix,
    allowUnorderedMigrations: true,
  },
})
