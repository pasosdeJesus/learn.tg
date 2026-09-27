// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

// El motor devuelve las opciones recibidas: así el test ve exactamente el
// `walletClient` que le llega (que es lo que este wrapper existe para cambiar).
vi.mock('@pasosdejesus/usdt/hooks/useContractPayment', () => ({
  useContractPayment: vi.fn((options: unknown) => options),
}))

import { sequenceTransfers, useContractPayment } from '../useContractPayment'

// R-#268: una donación puede llevar USDT y SLEARN, y el motor los manda uno tras
// otro. La segunda transferencia reutilizaba el nonce de la primera —todavía en el
// mempool— y el RPC la rechazaba con "replacement transaction underpriced" (reporte
// del operador en producción, 2026-09-27; la misma carrera está en
// `e2e/specs/vault-both-donate.spec.mjs`, que le pasa nonces explícitos).

function makeWallet() {
  const sent: string[] = []
  const client = {
    account: '0x84272a6dd0D5fE9ea2Ab28Cf96e72f4F7da00C5C',
    writeContract: vi.fn(async (args: Record<string, unknown>) => {
      sent.push(String(args.functionName))
      return `0x${sent.length}` as `0x${string}`
    }),
    readContract: vi.fn(async () => 1n),
  }
  return { client, sent }
}

/** Cliente de lectura cuyo recibo no llega hasta que el test lo libera. */
function makeGatedReceiptClient() {
  const gate: { release?: () => void } = {}
  const client = {
    waitForTransactionReceipt: vi.fn(() => new Promise<void>((resolve) => { gate.release = resolve })),
  }
  return { client, gate }
}

describe('sequenceTransfers', () => {
  it('waits for the receipt of the previous transfer before sending the next one', async () => {
    const { client, sent } = makeWallet()
    const { client: publicClient, gate } = makeGatedReceiptClient()
    const transfer = sequenceTransfers(client, publicClient)!

    // Como lo hace el motor: una transferencia, y después la otra.
    const usdt = await transfer.writeContract({ functionName: 'transfer', args: ['0x1', 1000000n] })
    const second = transfer.writeContract({ functionName: 'transfer', args: ['0x1', 100n] })
    await Promise.resolve()

    expect(publicClient.waitForTransactionReceipt).toHaveBeenCalledWith({ hash: usdt, timeout: 120_000 })
    // La segunda todavía no salió: espera el recibo de la primera.
    expect(sent).toEqual(['transfer'])

    gate.release?.()
    await expect(second).resolves.toBe('0x2')

    expect(sent).toEqual(['transfer', 'transfer'])
    expect(client.writeContract.mock.calls[1][0]).toEqual({ functionName: 'transfer', args: ['0x1', 100n] })
  })

  it('keeps the rest of the wallet client untouched', async () => {
    const { client } = makeWallet()
    const transfer = sequenceTransfers(client, undefined)!

    expect(transfer.account).toBe(client.account)
    expect(await transfer.readContract()).toBe(1n)
  })

  it('rejects a transfer started while another one is still being sent', async () => {
    const { client } = makeWallet()
    // El primer envío no termina hasta que el test lo libera: así se simula el doble
    // clic (dos `execute` a la vez), que mandaría la donación dos veces.
    const gate: { release?: (hash: `0x${string}`) => void } = {}
    client.writeContract.mockImplementationOnce(() => new Promise((resolve) => { gate.release = resolve }))
    const transfer = sequenceTransfers(client, undefined)!

    const first = transfer.writeContract({ functionName: 'transfer' })
    await expect(transfer.writeContract({ functionName: 'transfer' }))
      .rejects.toThrow('A transfer is already being sent')

    gate.release?.('0xaa')
    await expect(first).resolves.toBe('0xaa')
  })

  it('sends without waiting when there is no receipt client', async () => {
    const { client, sent } = makeWallet()
    const transfer = sequenceTransfers(client, undefined)!

    await transfer.writeContract({ functionName: 'transfer' })
    await transfer.writeContract({ functionName: 'transfer' })

    expect(sent).toHaveLength(2)
  })

  it('sends anyway when the previous receipt never arrives', async () => {
    const { client, sent } = makeWallet()
    const publicClient = {
      waitForTransactionReceipt: vi.fn(async () => { throw new Error('timeout') }),
    }
    const transfer = sequenceTransfers(client, publicClient)!

    await transfer.writeContract({ functionName: 'transfer' })
    await transfer.writeContract({ functionName: 'transfer' })

    expect(sent).toHaveLength(2)
  })

  it('returns the client unchanged when it has no wallet methods', () => {
    expect(sequenceTransfers(undefined, undefined)).toBeUndefined()
    expect(sequenceTransfers(null, undefined)).toBeNull()
    const bare = {} as any
    expect(sequenceTransfers(bare, undefined)).toBe(bare)
  })
})

describe('useContractPayment', () => {
  it('hands the engine a wallet client that serializes the transfers', async () => {
    const { client, sent } = makeWallet()
    const { result } = renderHook(() =>
      useContractPayment({ walletClient: client, publicClient: undefined } as any))

    const handed = (result.current as any).walletClient
    expect(handed).not.toBe(client)
    await handed.writeContract({ functionName: 'transfer' })
    await handed.writeContract({ functionName: 'transfer' })

    expect(sent).toEqual(['transfer', 'transfer'])
  })
})
