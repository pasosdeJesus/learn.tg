/**
 * MIT License
 * Copyright (c) 2022 DevRel Team & Community
 *
 * Based on contexts/useWeb3.ts of Celo-composer
 */

import { useState } from 'react'
import StableTokenABI from './cusd-abi.json'
import {
  createPublicClient,
  createWalletClient,
  custom,
  getContract,
  http,
  parseEther,
  stringToHex,
} from 'viem'
import { celo } from 'viem/chains'

const publicClient = createPublicClient({
  chain: celo,
  transport: http(),
})

const cUSDTokenAddress = '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1' // Testnet
const MINIPAY_NFT_CONTRACT = '0xE8F4699baba6C86DA9729b1B0a1DA1Bd4136eFeF' // Testnet

export const useWeb3 = () => {
  const [address, setAddress] = useState<string | null>(null)

  const getShortAddress = () => {
    return address ? `${address.slice(0, 5)}...${address.slice(39, 42)}` : ''
  }

  const getUserAddress = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      let walletClient = createWalletClient({
        transport: custom(window.ethereum),
        chain: celo,
      })

      let [address] = await walletClient.getAddresses()
      setAddress(address)
      return address
    }
    return null
  }

  const sendCUSD = async (to: string, amount: string) => {
    let walletClient = createWalletClient({
      transport: custom(window.ethereum),
      chain: celo,
    })

    let [address] = await walletClient.getAddresses()

    const amountInWei = parseEther(amount)

    const tx = await walletClient.writeContract({
      address: cUSDTokenAddress,
      abi: StableTokenABI.abi,
      functionName: 'transfer',
      account: address,
      args: [to, amountInWei],
    })

    let receipt = await publicClient.waitForTransactionReceipt({
      hash: tx,
    })

    return receipt
  }

  const signTransaction = async () => {
    let walletClient = createWalletClient({
      transport: custom(window.ethereum),
      chain: celo,
    })

    let [address] = await walletClient.getAddresses()

    const res = await walletClient.signMessage({
      account: address,
      message: stringToHex('Hello from Celo Composer MiniPay Template!'),
    })

    return res
  }

  return {
    address,
    getShortAddress,
    getUserAddress,
    sendCUSD,
    signTransaction,
  }
}
