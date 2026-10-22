import { describe, it, expect } from 'vitest'
import { missingScholarshipTokens, paidToOtherWallet } from '../scholarship-records.js'

// R-#279 / R-#265: cuando la cadena da un token por pagado y la base no tiene su fila,
// hay que escribirla (para que el ícono del curso lo recuerde). La decisión es pura.
describe('missingScholarshipTokens', () => {
  const none = { usdt: false, slearn: false, wallets: [] }
  const both = { usdt: true, slearn: true, wallets: [] }

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
    expect(missingScholarshipTokens({ usdt: 680000n, slearn: 75n }, { usdt: true, slearn: false, wallets: [] })).toEqual(['slearn'])
    expect(missingScholarshipTokens({ usdt: 680000n, slearn: 75n }, { usdt: false, slearn: true, wallets: [] })).toEqual(['usdt'])
  })
})

// R-#265 §3.3 (decisión del operador, 2026-10-18): una guía se paga una sola vez por
// cuenta; la misma cuenta no puede cobrarla de nuevo con otra billetera.
describe('paidToOtherWallet', () => {
  const FIRST = '0x84272a6dd0d5fe9ea2ab28cf96e72f4f7da00c5c'
  const SECOND = '0x1111111111111111111111111111111111111111'

  it('no encuentra otra billetera cuando la beca se pagó a la conectada', () => {
    expect(paidToOtherWallet([FIRST], FIRST)).toBeNull()
    expect(paidToOtherWallet([FIRST.toUpperCase()], FIRST)).toBeNull()
    expect(paidToOtherWallet([], FIRST)).toBeNull()
  })

  it('detecta la billetera de la misma cuenta que ya cobró la guía', () => {
    expect(paidToOtherWallet([FIRST, SECOND], SECOND)).toBe(FIRST)
    expect(paidToOtherWallet([FIRST], SECOND)).toBe(FIRST)
    expect(paidToOtherWallet([SECOND.toUpperCase()], FIRST)).toBe(SECOND)
  })
})
