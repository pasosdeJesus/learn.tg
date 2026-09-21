import { describe, expect, it } from 'vitest'
import {
  KDF_ITERATIONS_CEILING,
  KDF_ITERATIONS_FLOOR,
  calibrateIterations,
  decryptSecret,
  encryptSecret,
  normalizePassword,
} from '../crypto'

describe('password normalization (R-#251)', () => {
  it('trims and applies NFKD', () => {
    expect(normalizePassword('  correct horse  ')).toBe('correct horse')
    expect(normalizePassword('café')).toBe('cafe\u0301')
    expect(normalizePassword('clave')).toBe('clave')
  })

  it('is idempotent', () => {
    const once = normalizePassword('  ñandú  ')
    expect(normalizePassword(once)).toBe(once)
  })
})

describe('KDF calibration (R-#251)', () => {
  it('never goes below the historical floor', async () => {
    // Una medida lenta proyecta un conteo menor: se queda en el piso.
    const slow = async () => 5000
    expect(await calibrateIterations(slow, 400)).toBe(KDF_ITERATIONS_FLOOR)
  })

  it('scales the count up to the budget on a fast device', async () => {
    // 100 ms por 600 k ⇒ con 400 ms de presupuesto caben 2.4 M.
    const fast = async () => 100
    expect(await calibrateIterations(fast, 400)).toBe(KDF_ITERATIONS_FLOOR * 4)
  })

  it('clamps at the ceiling so a slow phone cannot hang', async () => {
    const instant = async () => 0.01
    expect(await calibrateIterations(instant, 400)).toBe(KDF_ITERATIONS_CEILING)
  })

  it('falls back to the floor when the measurement fails', async () => {
    const broken = async () => { throw new Error('no crypto') }
    expect(await calibrateIterations(broken)).toBe(KDF_ITERATIONS_FLOOR)
    const nonsense = async () => 0
    expect(await calibrateIterations(nonsense)).toBe(KDF_ITERATIONS_FLOOR)
  })
})

describe('record work factor (R-#251)', () => {
  it('stores the iteration count it was asked for', async () => {
    const secret = await encryptSecret('{"v":1}', 'clave-de-prueba', 1234)
    expect(secret.kdf.iterations).toBe(1234)
    expect(await decryptSecret(secret, 'clave-de-prueba')).toBe('{"v":1}')
  })

  it('uses the historical count by default', async () => {
    const secret = await encryptSecret('{"v":1}', 'clave-de-prueba')
    expect(secret.kdf.iterations).toBe(KDF_ITERATIONS_FLOOR)
  })

  it('opens a record whose password was written with spaces or accents', async () => {
    const secret = await encryptSecret('{"v":1}', 'café con leche')
    expect(await decryptSecret(secret, '  café con leche  ')).toBe('{"v":1}')
    // Y sigue abriendo con la clave normalizada (NFKD) aunque el usuario escriba
    // el acento compuesto o descompuesto.
    expect(await decryptSecret(secret, 'cafe\u0301 con leche')).toBe('{"v":1}')
  })

  it('still rejects a wrong password', async () => {
    const secret = await encryptSecret('{"v":1}', 'clave-de-prueba')
    await expect(decryptSecret(secret, 'otra-clave')).rejects.toThrow(/Wrong password/)
  })
})
