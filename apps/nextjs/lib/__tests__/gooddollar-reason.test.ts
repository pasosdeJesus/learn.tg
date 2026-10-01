import { describe, it, expect } from 'vitest'
import {
  GOODDOLLAR_SUPPORTED_CHAIN_IDS,
  isGoodDollarReady,
  resolveGoodDollarReason,
  type GoodDollarReasonInput,
} from '../gooddollar-reason'

const ready: GoodDollarReasonInput = {
  hasAddress: true,
  hasWalletClient: true,
  inAppStatus: 'unlocked',
  hasIdentitySDK: true,
  chainId: 42220,
}

describe('resolveGoodDollarReason', () => {
  it('is ready with a session, a signer, the SDK and a supported chain', () => {
    expect(resolveGoodDollarReason(ready)).toBe('ready')
    expect(resolveGoodDollarReason({ ...ready, chainId: 122 })).toBe('ready')
    expect(resolveGoodDollarReason({ ...ready, chainId: null })).toBe('ready')
  })

  it('reports no wallet without a session', () => {
    expect(resolveGoodDollarReason({ ...ready, hasAddress: false })).toBe('no-wallet')
  })

  it('reports a locked in-app wallet before anything else (mainnet bug)', () => {
    const reason = resolveGoodDollarReason({
      ...ready,
      inAppStatus: 'locked',
      hasWalletClient: false,
      hasIdentitySDK: false,
    })
    expect(reason).toBe('locked')
  })

  it('reports an SDK construction error instead of blaming the network', () => {
    expect(
      resolveGoodDollarReason({ ...ready, hasIdentitySDK: false, sdkError: new Error('boom') }),
    ).toBe('sdk-error')
  })

  it('reports an unsupported provider when there is no signer or SDK', () => {
    expect(resolveGoodDollarReason({ ...ready, hasWalletClient: false })).toBe('provider-unsupported')
    expect(resolveGoodDollarReason({ ...ready, hasIdentitySDK: false })).toBe('provider-unsupported')
  })

  it('reports the network only when the chain is really unsupported', () => {
    expect(resolveGoodDollarReason({ ...ready, chainId: 1 })).toBe('network-unsupported')
    // Celo Sepolia: GoodDollar no tiene UBI ahí (se usa learn.tg-UBI)
    expect(resolveGoodDollarReason({ ...ready, chainId: 11142220 })).toBe('network-unsupported')
  })
})

describe('isGoodDollarReady', () => {
  it('is true only for ready', () => {
    expect(isGoodDollarReady('ready')).toBe(true)
    expect(isGoodDollarReady('locked')).toBe(false)
    expect(isGoodDollarReady('network-unsupported')).toBe(false)
  })
})

describe('GOODDOLLAR_SUPPORTED_CHAIN_IDS', () => {
  it('lists the chains where GoodDollar has UBI, with no Celo Sepolia', () => {
    expect(GOODDOLLAR_SUPPORTED_CHAIN_IDS).toEqual([50, 122, 42220])
    expect(GOODDOLLAR_SUPPORTED_CHAIN_IDS).not.toContain(11142220)
  })
})
