import { describe, it, expect } from 'vitest'
import { checkWalletControl } from '../cluster-wallet.js'

// Control de la billetera del clúster (R-#161): una cuenta normal tiene que ser una
// billetera registrada del iniciador; una multisig (Safe) tiene que tener **un dueño por
// pastor** del clúster y cada dueño una billetera registrada de ESE pastor. Sin mover
// fondos: `getCode` + `getOwners`.

const INITIATOR = '0x84272a6dd0D5fE9ea2Ab28Cf96e72f4F7da00C5C'
const PASTOR_B = '0x1234567890123456789012345678901234567890'
const STRANGER = '0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72'

function client({ code = '0x', owners }: { code?: string | null; owners?: string[] | Error }) {
  return {
    getCode: async () => code,
    readContract: async () => {
      if (owners instanceof Error) throw owners
      return owners ?? []
    },
  }
}

const pastors = [[INITIATOR.toLowerCase()], [PASTOR_B.toLowerCase()]]

describe('checkWalletControl (R-#161)', () => {
  it('accepts an account that is one of the initiator wallets', async () => {
    const result = await checkWalletControl(client({ code: '0x' }), INITIATOR, [INITIATOR.toLowerCase()])
    expect(result).toEqual({ ok: true, kind: 'eoa' })
  })

  it('rejects an account that is not registered by the initiator', async () => {
    const result = await checkWalletControl(client({ code: '0x' }), STRANGER, [INITIATOR])
    expect(result).toEqual({ ok: false, reason: 'not_initiator' })
  })

  it('accepts a multisig with one owner per pastor, each a wallet of that pastor', async () => {
    const result = await checkWalletControl(client({ code: '0x6000', owners: [PASTOR_B, INITIATOR] }), STRANGER, [INITIATOR], pastors)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.kind).toBe('safe')
  })

  it('accepts one owner even when a pastor has several registered wallets', async () => {
    const multi = [[INITIATOR.toLowerCase(), STRANGER.toLowerCase()], [PASTOR_B.toLowerCase()]]
    const result = await checkWalletControl(
      client({ code: '0x6000', owners: [STRANGER, PASTOR_B] }),
      STRANGER,
      multi[0],
      multi,
    )
    expect(result.ok).toBe(true)
  })

  it('rejects a multisig whose owners do not include an initiator wallet', async () => {
    const result = await checkWalletControl(
      client({ code: '0x6000', owners: [PASTOR_B, STRANGER] }),
      STRANGER,
      [INITIATOR],
      pastors,
    )
    expect(result).toEqual({ ok: false, reason: 'safe_without_initiator' })
  })

  it('rejects a multisig with fewer owners than pastors', async () => {
    const result = await checkWalletControl(client({ code: '0x6000', owners: [INITIATOR] }), INITIATOR, [INITIATOR], pastors)
    expect(result).toEqual({ ok: false, reason: 'safe_owners' })
  })

  it('rejects a multisig with more owners than pastors', async () => {
    const result = await checkWalletControl(
      client({ code: '0x6000', owners: [INITIATOR, PASTOR_B, STRANGER] }),
      INITIATOR,
      [INITIATOR],
      pastors,
    )
    expect(result).toEqual({ ok: false, reason: 'safe_owners' })
  })

  it('rejects a multisig where one pastor would own two seats', async () => {
    const result = await checkWalletControl(
      client({ code: '0x6000', owners: [INITIATOR, INITIATOR] }),
      INITIATOR,
      [INITIATOR],
      pastors,
    )
    expect(result).toEqual({ ok: false, reason: 'safe_owners' })
  })

  it('rejects a contract that does not expose getOwners', async () => {
    const result = await checkWalletControl(
      client({ code: '0x6000', owners: new Error('execution reverted') }),
      STRANGER,
      [INITIATOR],
      pastors,
    )
    expect(result).toEqual({ ok: false, reason: 'unverified' })
  })

  it('rejects when the chain cannot be read', async () => {
    const result = await checkWalletControl(
      { getCode: async () => { throw new Error('rpc down') }, readContract: async () => [] },
      STRANGER,
      [INITIATOR],
      pastors,
    )
    expect(result).toEqual({ ok: false, reason: 'unverified' })
  })
})
