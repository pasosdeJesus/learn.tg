// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// `vitest.setup.ts` mockea `kysely` y `pg` para las rutas; aquí se prueba el pool
// real, así que se deshacen esos mocks en este archivo.
vi.unmock('kysely')
vi.unmock('pg')

import { Pool } from 'pg'
import { newKyselyPostgresql } from '@/.config/kysely-db'

// El pool vive en `globalThis` (sobrevive a recargas de `next dev`); la prueba lo
// limpia entre casos para no compartir estado con otras suites.
const g = globalThis as unknown as {
  __learntgPool?: Pool
  __learntgDb?: unknown
  __learntgPoolKey?: string
}

function reset() {
  delete g.__learntgPool
  delete g.__learntgDb
  delete g.__learntgPoolKey
}

describe('newKyselyPostgresql — un pool por proceso', () => {
  beforeEach(reset)

  afterEach(async () => {
    await g.__learntgPool?.end?.().catch(() => {})
    reset()
  })

  it('reutiliza el mismo pool y el mismo Kysely en llamadas sucesivas', () => {
    const first = newKyselyPostgresql()
    const second = newKyselyPostgresql()

    expect(second).toBe(first)
    expect(g.__learntgPool).toBeInstanceOf(Pool)
    expect(g.__learntgPool?.options.max).toBe(Number(process.env.PG_POOL_MAX ?? 10))
  })

  it('recrea el pool si cambian los ajustes de conexión', () => {
    const first = newKyselyPostgresql()
    const firstPool = g.__learntgPool
    const original = process.env.PGDATABASE_TEST

    process.env.PGDATABASE_TEST = `${original ?? 'learntg'}_otra`
    const second = newKyselyPostgresql()
    process.env.PGDATABASE_TEST = original

    expect(second).not.toBe(first)
    expect(g.__learntgPool).not.toBe(firstPool)
  })

  // Guardia de la regresión del 2026-10-19: `app/api/verify/route.ts` hacía
  // `await db.destroy()` en un `finally`, lo que destruía el driver **compartido** y
  // dejaba todas las rutas con base de datos en 500 ("driver has already been
  // destroyed") hasta reiniciar el proceso. Una ruta nunca debe destruir el pool.
  it('ninguna ruta de app/api destruye el pool compartido', () => {
    const routeFiles = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) return entry.name === '__tests__' ? [] : routeFiles(full)
        return entry.name === 'route.ts' ? [full] : []
      })

    const offenders = routeFiles(join(process.cwd(), 'app', 'api'))
      .filter((file) => /\.destroy\s*\(/.test(readFileSync(file, 'utf8')))
      .map((file) => file.replace(`${process.cwd()}/`, ''))

    expect(offenders).toEqual([])
  })
})
