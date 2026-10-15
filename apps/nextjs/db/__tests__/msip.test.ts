import { describe, it, expect } from 'vitest'
import { BASE_MODEL_TABLES, isBaseModelTable, model } from 'generated-msip'
import {
  BASE_MODEL_VERSION_IN_USE,
  BASE_MODEL_VERSION_PUBLISHED,
} from '@/lib/msip'

// R-#260 Part B / R-#285: learn.tg declares the base model version it follows and
// keeps it in step with what the msip engine publishes. The conformance check
// against a live database is `make eng-check` (`bin/m eng:check`), which needs a
// database and exits non-zero on drift; these unit tests guard the declaration
// without a database.

describe('msip base model conformance (R-#260 Part B / R-#285)', () => {
  it('records the base model version learn.tg is on', () => {
    // When the engine publishes a new base version this fails on purpose: run
    // `make eng-check`, apply what is missing and update the constant.
    expect(BASE_MODEL_VERSION_IN_USE).toBe(BASE_MODEL_VERSION_PUBLISHED)
  })

  it('follows the base tables the engine owns', () => {
    // The engine owns `usuario` + the msip geographic/auxiliary tables; these are
    // the ones learn.tg reads.
    for (const table of ['usuario', 'msip_pais', 'msip_departamento', 'msip_municipio', 'msip_centropoblado']) {
      expect(BASE_MODEL_TABLES).toContain(table)
      expect(isBaseModelTable(table)).toBe(true)
    }
    // The engine's derived model (`m-engine.generated.ts`) is the table authority.
    expect([...model.tables].sort()).toEqual([...BASE_MODEL_TABLES].sort())
    // learn.tg's own tables are extensions, not base.
    expect(isBaseModelTable('credential_emission')).toBe(false)
    expect(isBaseModelTable('billetera_usuario')).toBe(false)
  })
})
