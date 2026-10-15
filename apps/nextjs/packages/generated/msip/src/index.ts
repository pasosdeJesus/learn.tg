export { BASE_MODEL_VERSION, BASE_MODEL_TABLES, isBaseModelTable } from './version.js';
export type { BaseModelTable } from './version.js';
export * from './types.js';
export { parseStructureSql, normalizeType } from './parse-structure.js';
export { buildBaseline, buildInventory, renderBaselineSql, renderGeneratedModule } from './generate.js';
export {
  compareInventories, formatCheckReport, inventoryFromDb, inventoryFromParsed,
} from './check.js';
export {
  USUARIO_BASE_COLUMNS, SEARCH_TOWNS_SQL, siweNusuario, isSessionSubject,
  getUserById, readProfile, updateProfile, setVisibility,
  listCountries, listDepartments, listMunicipalities, searchTowns, catalogCounts,
  baseModelInfo,
} from './queries.js';
export { GUIDELINES, renderGuidelines, type Guideline } from './guidelines.js';
// Las tablas `billetera_usuario`/`billetera_invitada` y sus consultas **salieron** de
// `msip`: ahora son del motor `wallet` (`@pasosdejesus/wallet`, REQ/50 D4/D9).
// Migraciones hacia adelante (D11): pasos versionados que `eng:msip:setup` escribe
// como migraciones Kysely del consumidor.
export {
  BASE_MODEL_MIGRATIONS, migrationMarker, planSetup, renderMigrationFile, splitSqlStatements,
  checkMigrationPolicy,
} from './forward/index.js';
export type { BaseModelMigration, SetupPlan, MigrationPolicyViolation } from './forward/index.js';

// Forma genérica del modelo (https://gitlab.com/pasosdeJesus/m/-/work_items/39 §3.5): `{ version, tables, migrations }`.
export { model } from './model.js';

// Datos iniciales (seed): helpers puros; el CLI aporta la conexión (`eng:msip:seed`).
export { seedTables, seedIsLoaded, countStatement, truncateStatement } from './seed.js';

import { BASE_MODEL_VERSION } from './version.js';
import { BASELINE_INVENTORY, BASELINE_SQL, BASELINE_GENERATED_MANIFEST } from './baseline.generated.js';
import { compareInventories, formatCheckReport, inventoryFromDb } from './check.js';
import type { CheckReport, SqlExecutor } from './types.js';

export { BASELINE_INVENTORY, BASELINE_SQL, BASELINE_GENERATED_MANIFEST };

/**
 * Conformance check of a live database against the shipped baseline.
 * Extensions are reported as `extra` and never fail; missing or changed base
 * tables/columns are `drift`/`absent` and make the report not ok.
 */
export async function checkBaseModel(db: SqlExecutor): Promise<CheckReport> {
  const actual = await inventoryFromDb(db, Object.keys(BASELINE_INVENTORY.tables), BASE_MODEL_VERSION);
  return compareInventories(BASELINE_INVENTORY, actual);
}
