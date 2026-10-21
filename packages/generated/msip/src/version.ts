/**
 * Modelo base publicado por `m`.
 *
 * La versión y las tablas **se derivan** del baseline generado
 * (`baseline.generated.ts`), que a su vez sale del **esquema real** del motor
 * (`db/structure.sql`): no son listas a mano. El baseline es un artefacto de
 * build (https://gitlab.com/pasosdeJesus/m/-/work_items/46) y `BASE_MODEL_TABLES` no es la autoridad del modelo.
 *
 * El eje de versión es propio (no el de `@pasosdejesus/m`): un cambio en las
 * columnas del base es rupturista para los consumidores aunque la API de `m` no
 * cambie (D1 de https://gitlab.com/pasosdeJesus/m/-/work_items/46).
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

import { BASELINE_GENERATED_MANIFEST } from './baseline.generated.js';

/** Versión del modelo (del baseline generado). */
export const BASE_MODEL_VERSION = BASELINE_GENERATED_MANIFEST.version;

/**
 * Tablas del modelo: las del baseline generado (derivadas del esquema real).
 * `billetera_usuario` no está aquí: el motor `wallet` (`@pasosdejesus/wallet`)
 * es quien la declara (REQ/50 D4/D9).
 */
export const BASE_MODEL_TABLES: readonly string[] = Object.keys(BASELINE_GENERATED_MANIFEST.tables).sort();

export type BaseModelTable = string;

export function isBaseModelTable(name: string): name is BaseModelTable {
  return BASE_MODEL_TABLES.includes(name);
}
