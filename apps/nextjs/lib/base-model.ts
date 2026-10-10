import { BASE_MODEL_VERSION } from '@pasosdejesus/m/base-model'

/**
 * R-#260 Part B: base model version that learn.tg's database conforms to
 * (`@pasosdejesus/m/base-model`, https://gitlab.com/pasosdeJesus/m/-/work_items/46).
 *
 * Recorded explicitly so a base bump cannot pass unnoticed:
 * `db/__tests__/base-model.test.ts` fails when `m` publishes a new
 * `BASE_MODEL_VERSION`, and `make db-check` (`bin/m db:check`) verifies the live
 * database against it (it exits non-zero on drift).
 *
 * `db/migrations/20261010022121_alinear_modelo_base_msip.ts` aligned the three
 * restrictive drifts learn.tg had (see `doc/usuario-model.md`).
 */
export const BASE_MODEL_VERSION_IN_USE = '1.0.0'

/** The version `m` publishes today; it must match `BASE_MODEL_VERSION_IN_USE`. */
export const BASE_MODEL_VERSION_PUBLISHED = BASE_MODEL_VERSION
