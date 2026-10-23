import { describe, it, expect } from 'vitest'
import { classifyReferences } from '../wallet-handover'

// R-#288: the duplicate must be valueless. Anything outside the moved wallet and the
// rows that are deleted with the account makes the handover refuse, so money, on-chain
// proofs and church/referral data are never destroyed silently.
describe('classifyReferences (R-#288)', () => {
  it('accepts the wallets and the rows deleted with the duplicate', () => {
    expect(
      classifyReferences([
        { table: 'billetera_usuario', column: 'usuario_id', count: 1 },
        { table: 'billetera_invitada', column: 'usuario_id', count: 1 },
        { table: 'notifications', column: 'usuario_id', count: 3 },
        { table: 'referralcode', column: 'usuario_id', count: 1 },
        { table: 'verification_log', column: 'usuario_id', count: 2 },
      ]),
    ).toEqual({ ok: true })
  })

  it('accepts an account with no references at all', () => {
    expect(classifyReferences([])).toEqual({ ok: true })
  })

  it('refuses when the duplicate has transactions', () => {
    expect(
      classifyReferences([{ table: 'transaction', column: 'usuario_id', count: 1 }]),
    ).toEqual({ ok: false, code: 'duplicate-has-value', detail: 'transaction.usuario_id (1)' })
  })

  it('refuses when the duplicate holds credentials', () => {
    expect(
      classifyReferences([{ table: 'credential_emission', column: 'usuario_id', count: 1 }]),
    ).toEqual({
      ok: false,
      code: 'duplicate-has-value',
      detail: 'credential_emission.usuario_id (1)',
    })
  })

  it('refuses a church created or pastored by the duplicate', () => {
    expect(
      classifyReferences([{ table: 'church', column: 'created_by', count: 1 }]),
    ).toEqual({ ok: false, code: 'duplicate-has-value', detail: 'church.created_by (1)' })
  })

  it('refuses referral relationships (a verifier resolves them)', () => {
    expect(
      classifyReferences([{ table: 'referralrelationship', column: 'referred_id', count: 2 }]),
    ).toEqual({
      ok: false,
      code: 'duplicate-has-value',
      detail: 'referralrelationship.referred_id (2)',
    })
  })

  it('refuses an unknown reference instead of deleting it', () => {
    expect(
      classifyReferences([{ table: 'reputationevidence', column: 'recorded_by', count: 1 }]),
    ).toEqual({
      ok: false,
      code: 'duplicate-has-value',
      detail: 'reputationevidence.recorded_by (1)',
    })
  })
})
