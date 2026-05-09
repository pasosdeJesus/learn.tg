import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'

import { newKyselyPostgresql } from '@/.config/kysely.config'
import type { DB } from '@/db/db.d'

let _db: Kysely<DB> | null = null

export function getDb() {
  if (!_db) {
    _db = newKyselyPostgresql()
  }
  return _db
}
