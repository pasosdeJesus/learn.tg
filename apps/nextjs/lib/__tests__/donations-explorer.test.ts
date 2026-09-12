import { describe, it, expect } from 'vitest'
import { donationType, donationDestinationLabel, summarizeDonation } from '../donations-explorer'

// REQ/223 — explorador de donaciones: resumen por fila del ledger (destino sin
// datos personales, comentario del donante, monto/cripto/hash).

describe('donations-explorer', () => {
  it('mapea la subcategoría al tipo de donación', () => {
    expect(donationType('course_vault')).toBe('course')
    expect(donationType('cluster')).toBe('cluster')
    expect(donationType('country')).toBe('country')
    expect(donationType('campaign')).toBe('campaign')
    expect(donationType('other')).toBe('unknown')
    expect(donationType(null)).toBe('unknown')
  })

  it('etiqueta el destino según la metadata (sin exponer datos personales)', () => {
    expect(donationDestinationLabel({ id: 1, date: null, crypto: 'usdt', amount: 1, hash: null, subcategoria: 'course_vault', metadata: { courseId: 3 } })).toBe('Course #3')
    expect(donationDestinationLabel({ id: 1, date: null, crypto: 'celo', amount: 1, hash: null, subcategoria: 'country', metadata: { countryCode: 'SL' } })).toBe('Country SL')
    expect(donationDestinationLabel({ id: 1, date: null, crypto: 'usdt', amount: 1, hash: null, subcategoria: 'cluster', metadata: { clusterWallet: '0x9c7218a253d1565fc5f2149ba51f0f55f0f27f07' } })).toBe('Cluster 0x9c72…7f07')
    expect(donationDestinationLabel({ id: 1, date: null, crypto: 'usdt', amount: 1, hash: null, subcategoria: 'campaign', metadata: { campaign: 'lensenia' } })).toBe('Campaign lensenia')
  })

  it('expone el comentario del donante y el nusuario (nunca el nombre real)', () => {
    const row = summarizeDonation({
      id: 7, date: '2026-09-08T10:00:00Z', crypto: 'usdt', amount: 5, hash: '0x' + 'ab'.repeat(32),
      subcategoria: 'course_vault', wallet: '0x1111111111111111111111111111111111111111',
      nusuario: 'pastor_juan', metadata: { courseId: 3, comment: 'colecta en efectivo', nombre: 'Juan Perez' },
    })
    expect(row.comment).toBe('colecta en efectivo')
    expect(row.donor).toBe('pastor_juan')
    expect(row.destination).toBe('Course #3')
    expect(JSON.stringify(row)).not.toContain('Juan Perez')
  })

  it('sin comentario devuelve null; sin nusuario usa la billetera abreviada', () => {
    const row = summarizeDonation({
      id: 8, date: null, crypto: 'celo', amount: 0.5, hash: '0x' + 'cd'.repeat(32),
      subcategoria: 'country', wallet: '0x1234567890abcdef1234567890abcdef12345678', metadata: { countryCode: 'CO' },
    })
    expect(row.comment).toBeNull()
    expect(row.donor).toBe('0x1234…5678')
  })
})
