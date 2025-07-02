import { PostgresDialect } from 'kysely'
import { defineConfig, getKnexTimestampPrefix } from 'kysely-ctl'
import 'dotenv/config'
import { Pool } from 'pg';

export default defineConfig({
  dialect: new PostgresDialect({
    pool: new Pool({
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: 5432,
    }),
  }),
  migrations: {
    migrationFolder: "migrations",
    getMigrationPrefix: getKnexTimestampPrefix,
  },
})
