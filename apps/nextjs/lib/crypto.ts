import 'dotenv/config'
import type { Address } from 'viem'
import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
  formatUnits,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import LearnTGVaultsAbi from '../abis/LearnTGVaults.json' with { type: 'json' }


export async function callWriteFun(
  publicClient: any,
  account: any,
  contractFun: any,
  contractParams: any,
  indent: any,
) {
  const sindent = indent > 0 ? ' '.repeat(indent - 1) : ''
  console.log(
    sindent,
    'Calling function',
    contractFun.name,
    'with params',
    contractParams,
  )
  let tx: Address = '0x0'
  try {
    tx = await contractFun(contractParams)
  } catch (e) {
    console.log(sindent, '* Reintentando con nonce')
    const nonce = await publicClient.getTransactionCount({
      address: account.address,
      blockTag: 'pending', // includes pending transactions
    })
    const nextNonce = nonce + 1
    console.log(sindent, 'OJO  nextNonce=', nextNonce)
    tx = await contractFun(contractParams, { account, nonce: nextNonce })
  }
  console.log(sindent, 'tx=', tx)
  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: tx,
      confirmations: 2, // Optional: number of confirmations to wait for
      timeout: 3_000, // 2 seconds
    })
    console.log(sindent, `Receipt: ${receipt}`)
  } catch (e) {
    console.error(
      sindent,
      `**No operó waitForTransactionReceipt de ${tx}, continuando`,
    )
  }
  return tx
}

