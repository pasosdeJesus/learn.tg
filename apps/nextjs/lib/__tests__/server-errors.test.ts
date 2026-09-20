import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { logServerError, devErrorDetail, serverErrorLogPath } from '../server-errors'

// Un 500 en `next dev` puede quedar sin causa visible (el overlay de errores
// falla al pintarlo). Estas pruebas fijan el contrato del helper que lo
// registra: archivo configurable, datos de Postgres y detalle solo fuera de
// producción. Ver doc/e2e-testing.md.

let dir: string
let logFile: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'server-errors-'))
  logFile = path.join(dir, 'errores.log')
  process.env.SERVER_ERROR_LOG = logFile
})

afterEach(() => {
  delete process.env.SERVER_ERROR_LOG
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('serverErrorLogPath', () => {
  it('usa SERVER_ERROR_LOG', () => {
    expect(serverErrorLogPath()).toBe(logFile)
  })
})

describe('logServerError', () => {
  it('escribe el error con contexto, sql, detail y stack', () => {
    const error: any = new Error('insert failed')
    error.sql = 'insert into verification_log ...'
    error.detail = 'Key (id)=(21) already exists.'
    error.code = '23505'

    logServerError(error, {
      source: 'PATCH /api/admin/church/[id]',
      method: 'PATCH',
      url: 'http://localhost:4000/api/admin/church/21',
      routePath: '/api/admin/church/21',
      extra: { churchId: 21, bodyKeys: ['registration_verified'] },
    })

    const text = fs.readFileSync(logFile, 'utf8')
    expect(text).toContain('PATCH /api/admin/church/[id]')
    expect(text).toContain('PATCH http://localhost:4000/api/admin/church/21')
    expect(text).toContain('route: /api/admin/church/21')
    expect(text).toContain('"churchId":21')
    expect(text).toContain('Error: insert failed')
    expect(text).toContain('sql: insert into verification_log')
    expect(text).toContain('detail: Key (id)=(21) already exists.')
    expect(text).toContain('code: 23505')
    expect(text).toContain('server-errors.test.ts')
  })

  it('no lanza si el archivo no se puede escribir', () => {
    process.env.SERVER_ERROR_LOG = path.join(dir, 'sin-directorio', 'errores.log')
    expect(() => logServerError(new Error('x'), { source: 'test' })).not.toThrow()
  })

  it('acepta valores que no son Error', () => {
    logServerError({ motivo: 'objeto suelto' }, { source: 'unhandledRejection' })
    const text = fs.readFileSync(logFile, 'utf8')
    expect(text).toContain('unhandledRejection')
    expect(text).toContain('objeto suelto')
  })
})

describe('devErrorDetail', () => {
  it('devuelve nombre y mensaje fuera de producción', () => {
    expect(devErrorDetail(new TypeError('boom'))).toBe('TypeError: boom')
  })

  it('no filtra detalles en producción', () => {
    const previo = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    expect(devErrorDetail(new Error('secreto'))).toBeUndefined()
    process.env.NODE_ENV = previo
  })
})
