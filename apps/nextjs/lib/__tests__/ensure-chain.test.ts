import { describe, it, expect, vi } from 'vitest'
import { ensureWalletChain, WrongChainError } from '@/lib/ensure-chain'

// Reporte del operador (2026-09-27): al pagar el curso GD en producción con la billetera
// en Celo Sepolia, viem lanzaba "The current chain of the wallet (id: 11142220) does not
// match the target chain for the transaction (id: 42220 – Celo)". Este pre-flight cambia
// la red cuando puede (la billetera in-app también puede: la misma llave sirve en Celo y
// en Celo Sepolia) y, si el cambio no se aplica, lanza un error tipado para que la
// interfaz lo explique.
const TARGET = { id: 42220 }

function wallet(chainId: number) {
  return {
    getChainId: vi.fn(async () => chainId),
    switchChain: vi.fn(async () => undefined),
    addChain: vi.fn(async () => undefined),
  }
}

describe('ensureWalletChain', () => {
  it('no hace nada cuando la billetera ya está en la red de la app', async () => {
    const w = wallet(42220)
    await ensureWalletChain(w, TARGET)
    expect(w.switchChain).not.toHaveBeenCalled()
    expect(w.addChain).not.toHaveBeenCalled()
  })

  it('cambia la red cuando la billetera está en otra', async () => {
    const w = wallet(11142220)
    await ensureWalletChain(w, TARGET)
    expect(w.switchChain).toHaveBeenCalledWith({ id: 42220 })
  })

  it('agrega la red y reintenta cuando la billetera no la conoce', async () => {
    const w = wallet(11142220)
    w.switchChain.mockRejectedValueOnce(new Error('Unrecognized chain ID'))
    await ensureWalletChain(w, TARGET)
    expect(w.addChain).toHaveBeenCalledWith({ chain: TARGET })
    expect(w.switchChain).toHaveBeenCalledTimes(2)
  })

  it('lanza WrongChainError marcando la billetera in-app cuando no se puede cambiar', async () => {
    const w = wallet(11142220)
    w.switchChain.mockRejectedValue(new Error('Unrecognized chain ID'))
    w.addChain.mockRejectedValue(new Error('nope'))

    await expect(ensureWalletChain(w, TARGET, { isPdJWallet: true })).rejects.toBeInstanceOf(WrongChainError)
    try {
      await ensureWalletChain(w, TARGET, { isPdJWallet: true })
    } catch (error) {
      const err = error as WrongChainError
      expect(err.code).toBe('wrong-chain')
      expect(err.currentChainId).toBe(11142220)
      expect(err.targetChainId).toBe(42220)
      expect(err.isInApp).toBe(true)
    }
  })

  it('no bloquea cuando la billetera no expone métodos de red', async () => {
    await expect(ensureWalletChain({} as never, TARGET)).resolves.toBeUndefined()
    await expect(ensureWalletChain(null, TARGET)).resolves.toBeUndefined()
  })
})
