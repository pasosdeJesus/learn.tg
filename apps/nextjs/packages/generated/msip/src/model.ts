/**
 * Forma **genérica** del modelo (https://gitlab.com/pasosdeJesus/m/-/work_items/39 §3.5): `{ version, tables, migrations }`.
 *
 * `tables` y `version` se **derivan** del esquema real del motor
 * (`db/structure.sql` → `src/m-engine.generated.ts`); el único **código a mano**
 * son las `migrations`. No hay símbolos por motor (`BASE_MODEL_TABLES` no es la
 * autoridad): lo que el motor exporta sale del generado `eng:sync`.
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

import { engine } from './m-engine.generated.js'
import { BASE_MODEL_MIGRATIONS } from './forward/index.js'

export const model = {
  version: BASE_MODEL_MIGRATIONS[BASE_MODEL_MIGRATIONS.length - 1]?.to ?? engine.version,
  tables: engine.model.tables,
  migrations: BASE_MODEL_MIGRATIONS,
} as const
