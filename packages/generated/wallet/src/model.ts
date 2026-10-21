/**
 * Forma **genérica** del modelo del motor `wallet` (https://gitlab.com/pasosdeJesus/m/-/work_items/39 §3.5):
 * `{ version, tables, migrations }`.
 *
 * `version`/`tables` se **derivan** del esquema de referencia (`db/structure.sql` →
 * `src/m-engine.generated.ts`); el código a mano son las `migrations`
 * (`db/migrations/`, que `eng:setup wallet` escribe en el consumidor).
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

import { engine } from './m-engine.generated.js'

export const model = {
  version: engine.version,
  tables: engine.model.tables,
  migrations: engine.model.migrations,
} as const
