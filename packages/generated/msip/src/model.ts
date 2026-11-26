/**
 * Modelo público del motor `msip`: forma `{ version, tables, migrations }`,
 * `DB`/`MsipDB` y los alias por tabla.
 *
 * Los tipos viven en `model.generated.ts` (los escribe `bin/m eng:types packages/msip`
 * desde `schema.generated.ts` y `m-engine.generated.ts`); este archivo añade el
 * `model` con las migraciones del motor, que el generador no conoce, y conserva el
 * subpath `@pasosdejesus/msip/model`.
 */

import { engine } from './m-engine.generated.js'
import { BASE_MODEL_MIGRATIONS } from './forward/index.js'

export * from './model.generated.js'

export const model = {
  version: BASE_MODEL_MIGRATIONS[BASE_MODEL_MIGRATIONS.length - 1]?.to ?? engine.version,
  tables: engine.model.tables,
  migrations: BASE_MODEL_MIGRATIONS,
} as const
