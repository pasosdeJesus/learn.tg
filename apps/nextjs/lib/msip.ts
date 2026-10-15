import { BASE_MODEL_VERSION, model } from 'generated-msip'

/**
 * R-#260 Part B / R-#285: the **msip engine** (`@pasosdejesus/msip`,
 * https://gitlab.com/pasosdeJesus/m/-/work_items/46) owns the base model
 * (`usuario` + the geographic catalogs). learn.tg consumes it **vendored**
 * (`packages/generated/msip`, `generated-msip`) because the engine is not
 * published to npm; `bin/m eng:check` measures the drift against its original.
 *
 * Recorded explicitly so a base bump cannot pass unnoticed:
 * `db/__tests__/msip.test.ts` fails when the engine publishes a new
 * `BASE_MODEL_VERSION`, and `make eng-check` (`bin/m eng:check`) verifies the live
 * database against it (it exits non-zero on drift).
 *
 * `db/migrations/20261010022121_alinear_modelo_base_msip.ts` aligned the three
 * restrictive drifts learn.tg had (see `doc/usuario-model.md`).
 */
export const BASE_MODEL_VERSION_IN_USE = '1.0.0'

/** The version the msip engine publishes today; it must match `BASE_MODEL_VERSION_IN_USE`. */
export const BASE_MODEL_VERSION_PUBLISHED = BASE_MODEL_VERSION

/**
 * The base tables the engine owns (its own derived model). The full inventory of
 * learn.tg's extensions lives in `doc/usuario-model.md` (the engine no longer
 * publishes a consumer-specific list).
 */
export const BASE_MODEL_TABLES_IN_USE = model.tables
