import { describe, it, expect } from 'vitest'
import { missingScholarshipTokens } from '../scholarship-records'

// R-#279 / R-#265: cuando la cadena da un token por pagado y la base no tiene su fila,
// hay que escribirla (para que el ícono del curso lo recuerde). La decisión es pura.
describe('missingScholarshipTokens', () => {
  const none = { usdt: false, slearn: false }
  const both = { usdt: true, slearn: true }

  it('no pide nada si la cadena no ha pagado', () => {
    expect(missingScholarshipTokens({ usdt: 0n, slearn: 0n }, none)).toEqual([])
  })

  it('pide el token que la cadena pagó y la base no registró', () => {
    expect(missingScholarshipTokens({ usdt: 680000n, slearn: 0n }, none)).toEqual(['usdt'])
    expect(missingScholarshipTokens({ usdt: 0n, slearn: 75n }, none)).toEqual(['slearn'])
  })

  it('pide ambos cuando la cadena pagó los dos y la base no tiene ninguno', () => {
    expect(missingScholarshipTokens({ usdt: 680000n, slearn: 75n }, none)).toEqual(['usdt', 'slearn'])
  })

  it('no repite lo ya registrado', () => {
    expect(missingScholarshipTokens({ usdt: 680000n, slearn: 75n }, both)).toEqual([])
    expect(missingScholarshipTokens({ usdt: 680000n, slearn: 75n }, { usdt: true, slearn: false })).toEqual(['slearn'])
    expect(missingScholarshipTokens({ usdt: 680000n, slearn: 75n }, { usdt: false, slearn: true })).toEqual(['usdt'])
  })
})
