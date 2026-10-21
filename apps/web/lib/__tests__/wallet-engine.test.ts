import { describe, it, expect, vi } from 'vitest'
import type { Kysely } from 'kysely'
import { kyselySqlExecutor } from '../wallet-engine'

// R-#265 / m#50: el motor `wallet` no abre conexiones; recibe un `SqlExecutor`
// (`query(text, params)`). Este puente adapta el `Kysely` de la app sin abrir un
// segundo pool. El test fija el contrato del adaptador (SQL + parámetros -> filas).
function fakeKysely(rows: unknown[] = []) {
  const executeQuery = vi.fn(async (_query: unknown) => ({ rows }))
  const db = { getExecutor: () => ({ executeQuery }) } as unknown as Kysely<any>
  return { db, executeQuery }
}

describe('kyselySqlExecutor', () => {
  it('ejecuta el SQL y devuelve las filas del motor', async () => {
    const { db, executeQuery } = fakeKysely([{ id: 7, billetera: '0xabc' }])
    const exec = kyselySqlExecutor(db)

    const result = await exec.query('SELECT id FROM billetera_usuario WHERE usuario_id = $1', [7])

    expect(result.rows).toEqual([{ id: 7, billetera: '0xabc' }])
    expect(executeQuery).toHaveBeenCalledTimes(1)
    const compiled = executeQuery.mock.calls[0][0] as { sql: string; parameters: unknown[] }
    expect(compiled.sql).toBe('SELECT id FROM billetera_usuario WHERE usuario_id = $1')
    expect(compiled.parameters).toEqual([7])
  })

  it('sin parámetros manda una lista vacía (nunca undefined)', async () => {
    const { db, executeQuery } = fakeKysely([])
    const exec = kyselySqlExecutor(db)

    await exec.query('SELECT 1')

    const compiled = executeQuery.mock.calls[0][0] as { parameters: unknown[] }
    expect(compiled.parameters).toEqual([])
  })
})
