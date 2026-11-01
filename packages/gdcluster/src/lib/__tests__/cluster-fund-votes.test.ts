import { describe, it, expect } from 'vitest'
import { computeRelease, type ClusterFundVoteState } from '../cluster-fund-votes.js'

// Retiro del fondo del clúster (R-#161): el fondo se libera cuando todos los pastores
// votaron o cuando el saldo alcanzó el 100 % del presupuesto del primer año.

const votes = (pastors: number, voted: number): ClusterFundVoteState => ({
  pastors,
  voted,
  all_voted: pastors > 0 && voted >= pastors,
  votes: Array.from({ length: voted }, (_, index) => ({
    usuario_id: index + 1,
    nombre: `Pastor ${index + 1}`,
    church_id: index + 1,
    created_at: null,
  })),
})

describe('computeRelease (R-#161)', () => {
  it('is ready when every pastor voted', () => {
    const release = computeRelease(votes(3, 3), 500, { usdt: 10_000_000n, slearn: 0n })
    expect(release.votes_complete).toBe(true)
    expect(release.release_ready).toBe(true)
    expect(release.usdt).toBe('10.00')
  })

  it('is ready when the fund reached the first-year budget even without all votes', () => {
    const release = computeRelease(votes(3, 1), 500, { usdt: 500_000_000n, slearn: 0n })
    expect(release.votes_complete).toBe(false)
    expect(release.budget_reached).toBe(true)
    expect(release.release_ready).toBe(true)
  })

  it('is not ready with partial votes and a fund below the budget', () => {
    const release = computeRelease(votes(3, 1), 500, { usdt: 1_000_000n, slearn: 0n })
    expect(release.budget_reached).toBe(false)
    expect(release.release_ready).toBe(false)
  })

  it('handles an unreadable balance and an unset budget', () => {
    const release = computeRelease(votes(2, 0), null, null)
    expect(release.release_ready).toBe(false)
    expect(release.usdt).toBeNull()
    expect(release.slearn).toBeNull()
  })
})
