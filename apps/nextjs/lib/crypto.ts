import 'dotenv/config'
import type { Address, PublicClient, TransactionReceipt } from 'viem'
import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
  formatUnits,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import LearnTGVaultsAbi from '../abis/LearnTGVaults.json' with { type: 'json' }


async function waitForReceiptWithRetry(
  client: PublicClient,
  { hash, confirmations = 2, timeout = 10_000, interval = 1_000 }: {
    hash: Address,
    confirmations?: number,
    timeout?: number,
    interval?: number
  }
): Promise<TransactionReceipt> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    try {
      const receipt = await client.getTransactionReceipt({ hash });
      if (receipt && receipt.blockNumber) {
        // Wait for required confirmations
        const block = await client.getBlock();
        const confirmationsDone = Number(block.number - receipt.blockNumber);
        if (confirmationsDone >= confirmations) {
          return receipt;
        }
      }
    } catch (error) {
      // Transaction not mined yet, or other error.
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  console.log(`Transaction ${hash} not confirmed after ${timeout}ms`)
  throw new Error(`Transaction ${hash} not confirmed after ${timeout}ms`)
}   


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
    await waitForReceiptWithRetry(publicClient, { hash: tx });
  } catch (e) {
    console.log(e)
    console.error(
      sindent,
      `**No operó waitForReceiptWithRetry de ${tx}, Error: ${e}`
    )
  }
  return tx
}
