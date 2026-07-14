'use client'

import { useState, useCallback } from 'react'
import { encodeFunctionData, type Address, type Abi } from 'viem'

/**
 * Replacement for wagmi's useWriteContract.
 * Uses window.ethereum directly — no wagmi dependency.
 */
export function useWriteContract() {
  const [data, setData] = useState<`0x${string}` | undefined>(undefined)

  const writeContract = useCallback(async (args: {
    address: Address
    abi: Abi
    functionName: string
    args?: any[]
    value?: bigint
  }) => {
    if (typeof window === 'undefined' || !window.ethereum) {
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

    const hash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [txParams],
    })

    setData(hash as `0x${string}`)
    return hash
  }, [])

  return { data, writeContract }
}
