import { describe, it, expect, vi } from 'vitest'
import { redistributeCountryFund } from '../cluster-release.js'
import { setClusterVerified } from '../cluster-funds.js'

// Un clúster que ya recibió sus fondos sale del proceso con GD
// (https://github.com/pasosdeJesus/learn.tg/issues/161): no vuelve a participar del
// reparto del fondo del país cuando otro clúster recibe respuesta, y su bandera de
// verificado se apaga en el contrato.

describe('country fund redistribution (R-#161)', () => {
  it('ignores clusters whose funds were already released', async () => {
    const where: any[] = []
    const db: any = {
      selectFrom: () => db,
      innerJoin: () => db,
      select: () => db,
      where: (...args: any[]) => {
        where.push(args)
        return db
      },
      executeTakeFirst: async () => ({ alfa2: 'SL' }),
      execute: async () => [],
    }
    const backend: any = {
      getPublicClient: () => {
        throw new Error('no debería consultar la cadena sin clústeres')
      },
      getWalletClient: () => {
        throw new Error('no debería firmar sin clústeres')
      },
      sendTxAndWait: vi.fn(),
    }

    const result = await redistributeCountryFund(backend, db, { country_id: 694, id: 1 }, 1)

    expect(result).toBeNull()
    expect(where).toContainEqual(['c.fund_released_at', 'is', null])
    expect(where).toContainEqual(['c.gd_status', 'in', ['sent', 'answered']])
  })
})

describe('setClusterVerified (R-#161)', () => {
  function backendCapturing(calls: any[]) {
    const publicClient = {
      getTransactionCount: async () => 7,
      chain: { id: 11142220 },
    }
    const walletClient = { account: { address: '0x00000000000000000000000000000000000000aa' } }
    return {
      getPublicClient: () => publicClient,
      getWalletClient: () => walletClient,
      sendTxAndWait: async (_wc: any, _pc: any, args: any) => {
        calls.push(args)
        return '0xhash' as `0x${string}`
      },
    }
  }

  it('turns the flag on by default', async () => {
    const calls: any[] = []
    await setClusterVerified({ backend: backendCapturing(calls) } as any, '0x00000000000000000000000000000000000000bb')
    expect(calls[0].args).toEqual(['0x00000000000000000000000000000000000000bb', true])
  })

  it('turns it off when the cluster already received its funds', async () => {
    const calls: any[] = []
    await setClusterVerified(
      { backend: backendCapturing(calls) } as any,
      '0x00000000000000000000000000000000000000bb',
      false,
    )
    expect(calls[0].args).toEqual(['0x00000000000000000000000000000000000000bb', false])
  })
})
