import 'dotenv/config'
import type { Address } from 'viem'
import {
  createPublicClient,
  createWalletClient,
  getContract,
  getTransactionReceipt,
  http,
  formatUnits,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import LearnTGVaultsAbi from '../abis/LearnTGVaults.json' with { type: 'json' }


async function waitForReceiptWithRetry(client, { hash, confirmations = 2, timeout = 30_000, interval = 1_000 }) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    console.log(Date.now()-start)
    try {
      const receipt = await client.getTransactionReceipt({ hash });
      if (receipt && receipt.blockNumber) {
        console.log("receipt=", JSON.stringify(receipt))
        // Wait for required confirmations
        const block = await client.getBlock();
        console.log("block=", JSON.stringify(block))
        const confirmationsDone = Number(block.number - receipt.blockNumber);
        console.log("confirmationsDone=", JSON.stringify(confirmationsDone))
        if (confirmationsDone >= confirmations) {
          return receipt;
        }
      }
    } catch (error) {
      // Transaction not mined yet
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
    const receipt = await waitForReceiptWithRetry(publicClient, { hash: tx });
    /*const receipt = await publicClient.waitForTransactionReceipt({
hash: tx,
confirmations: 2, // Optional: number of confirmations to wait for
timeout: 3_000, // 2 seconds
}) */
    console.log(sindent, `Receipt: ${JSON.stringify(receipt, null, 2)}`)
  } catch (e) {
    console.log(e)
    console.error(
      sindent,
      `**No operó waitForReceiptWithRetry de ${tx}, `+
        `Error: \n${JSON.stringify(e)}`
    )
  }
  return tx
}

