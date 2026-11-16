/**
 * Modelo público del motor `msip`: forma `{ version, tables, migrations }`,
 * `DB`/`MsipDB` y los alias por tabla.
 *
 * El contenido vive en `model.generated.ts` (lo escribe
 * `pnpm -C packages/msip schema:types` desde `schema.generated.ts` y
 * `m-engine.generated.ts`); este archivo existe para conservar el subpath
 * `@pasosdejesus/msip/model` y no editar a mano código generado.
 */

export * from './model.generated.js'
