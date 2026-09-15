'use client'

import { useState, useCallback } from 'react'
import { encodeFunctionData, type Address, type Abi } from 'viem'
import { useWalletProvider } from '@/lib/hooks/useWalletProvider'

/**
 * Replacement for wagmi's useWriteContract.
 * Sends through the in-app wallet provider when it is unlocked, otherwise
 * through window.ethereum — no wagmi dependency.
 */
export function useWriteContract() {
  const [data, setData] = useState<`0x${string}` | undefined>(undefined)
  const { provider } = useWalletProvider()

  const writeContract = useCallback(async (args: {
    address: Address
    abi: Abi
    functionName: string
    args?: any[]
    value?: bigint
  }) => {
    if (typeof window === 'undefined' || !provider) {
      throw new Error('No wallet available')
    }

    const dataField = encodeFunctionData({
      abi: args.abi,
      functionName: args.functionName,
      args: args.args || [],
    })

    const txParams: any = {
      to: args.address,
      data: dataField,
    }
    if (args.value) txParams.value = '0x' + args.value.toString(16)

    const hash = await provider.request({
      method: 'eth_sendTransaction',
      params: [txParams],
    })

    setData(hash as `0x${string}`)
    return hash
  }, [provider])

  return { data, writeContract }
}
