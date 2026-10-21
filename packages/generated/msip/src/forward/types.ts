/**
 * Un paso de migración del modelo base (https://gitlab.com/pasosdeJesus/m/-/work_items/46 D11).
 *
 * El modelo base publica sus cambios como **fuente** en `msip/forward/`;
 * `eng:msip:setup` los escribe como migraciones Kysely del consumidor y el
 * consumidor las aplica con `bin/m db:migrate`. `m` nunca abre una conexión.
 */
export interface BaseModelMigration {
  /** Versión de la que parte (`'0.0.0'` para el baseline inicial). */
  from: string;
  /** Versión a la que llega. */
  to: string;
  /** Slug corto usado en el nombre del archivo generado. */
  slug: string;
  description: string;
  /** SQL de `up` (se ejecuta sentencia por sentencia). */
  upSql: string;
  /** SQL de `down`; debe revertir `upSql` (falla ruidosamente si es irreversible, D12). */
  downSql: string;
}
