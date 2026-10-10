import { describe, it, expect } from 'vitest'
import { BASE_MODEL_TABLES, isBaseModelTable } from '@pasosdejesus/m/base-model'
import {
  BASE_MODEL_VERSION_IN_USE,
  BASE_MODEL_VERSION_PUBLISHED,
} from '@/lib/base-model'

// R-#260 Part B: learn.tg declares the base model version it follows and keeps it
// in step with what `m` publishes. The conformance check against a live database is
// `make db-check` (`bin/m db:check`), which needs a database and exits non-zero on
// drift; these unit tests guard the declaration without a database.

describe('base model conformance (R-#260 Part B)', () => {
  it('records the base model version learn.tg is on', () => {
    // When `m` publishes a new base version this fails on purpose: run
    // `make db-check`, apply what is missing and update the constant.
    expect(BASE_MODEL_VERSION_IN_USE).toBe(BASE_MODEL_VERSION_PUBLISHED)
  })

  it('follows the five base tables', () => {
    for (const table of ['usuario', 'msip_pais', 'msip_departamento', 'msip_municipio', 'msip_centropoblado']) {
      expect(BASE_MODEL_TABLES).toContain(table)
      expect(isBaseModelTable(table)).toBe(true)
    }
    // learn.tg's own tables are extensions, not base.
    expect(isBaseModelTable('credential_emission')).toBe(false)
    expect(isBaseModelTable('billetera_usuario')).toBe(false)
  })
})
