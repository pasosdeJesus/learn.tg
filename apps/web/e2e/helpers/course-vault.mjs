// Keeps the course vault funded before a spec completes guides (R-#161).
//
// A scholarship is paid from the course vault, and the 10% that feeds a cluster's
// fund only moves when there is a scholarship to pay. With an empty vault the guides
// are credited but no money moves: the cluster fund is never registered in
// `ClusterFundsV2` and presenting the cluster to Global Disciples cannot verify it
// (`Cluster not found`). This helper tops the vault up with a real donation from the
// fixture wallet (`apps/.env`), the same path a donor uses:
//
//   1. reads `/api/scholarship?courseId=…` (vault balances),
//   2. when it is below the minimum, transfers USDT on chain to the backend wallet and
//      posts `/api/add-donation` with that hash,
//   3. reads the balance again so the caller knows whether it worked.
import * as fs from 'fs'
import * as path from 'path'
import { createPublicClient, createWalletClient, http, parseUnits, formatUnits } from 'viem'
import { celoSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

import { apiOn } from './e2e-fixture.mjs'

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
]

/** Reads apps/.env without printing secrets. */
export function envValue(name) {
  const paths = [
    path.join(process.cwd(), '..', '.env'),
    path.join(process.cwd(), 'apps', '.env'),
    path.join(process.cwd(), '.env'),
  ]
  for (const file of paths) {
    if (!fs.existsSync(file)) continue
    const text = fs.readFileSync(file, 'utf8')
    const match = text.match(new RegExp(`^${name}="([^"]+)"`, 'm')) || text.match(new RegExp(`^${name}=(\\S+)`, 'm'))
    if (match?.[1]) return match[1]
  }
  return process.env[name] || ''
}

async function vaultBalance(page, courseId, wallet) {
  const res = await apiOn(page, `/api/scholarship?courseId=${courseId}&walletAddress=${encodeURIComponent(wallet)}`)
  return {
    usdt: Number(res.body?.vaultBalance ?? 0),
    slearn: Number(res.body?.vaultBalanceSlearn ?? 0),
  }
}

/**
 * Makes sure the course vault holds at least `minUsdt` (and some SLEARN), donating
 * from the fixture wallet when it does not.
 *
 * @returns {{ ok: boolean, balance: { usdt: number, slearn: number }, donated?: string, reason?: string }}
 */
export async function ensureCourseVault({ page, wallet, pk, courseId = 10, minUsdt = 3, donationUsdt = 5 }) {
  const before = await vaultBalance(page, courseId, wallet)
  if (before.usdt >= minUsdt && before.slearn > 0) {
    return { ok: true, balance: before }
  }

  const rpcUrl = envValue('NEXT_PUBLIC_RPC_URL') || 'https://forno.celo-sepolia.celo-testnet.org'
  const usdt = envValue('NEXT_PUBLIC_USDT_TESTNET') || envValue('NEXT_PUBLIC_USDT_ADDRESS')
  const backend = envValue('NEXT_PUBLIC_ADDRESS')
  if (!usdt || !backend) {
    return { ok: false, balance: before, reason: 'faltan NEXT_PUBLIC_USDT_TESTNET/NEXT_PUBLIC_ADDRESS en apps/.env' }
  }

  const account = privateKeyToAccount(pk)
  const publicClient = createPublicClient({ chain: celoSepolia, transport: http(rpcUrl, { timeout: 30000 }) })
  const walletClient = createWalletClient({ account, chain: celoSepolia, transport: http(rpcUrl, { timeout: 30000 }) })

  let balance = 0n
  try {
    balance = await publicClient.readContract({ address: usdt, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address] })
  } catch (error) {
    return { ok: false, balance: before, reason: `no se pudo leer el USDT: ${error instanceof Error ? error.message : error}` }
  }
  const amount = parseUnits(String(donationUsdt), 6)
  if (balance < amount) {
    return { ok: false, balance: before, reason: `la billetera de prueba tiene ${formatUnits(balance, 6)} USDT` }
  }

  const hash = await walletClient.writeContract({
    address: usdt,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [backend, amount],
  })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') {
    return { ok: false, balance: before, reason: `la transferencia no se confirmó (${hash})` }
  }

  const donated = await apiOn(page, '/api/add-donation', {
    method: 'POST',
    body: JSON.stringify({
      walletAddress: wallet,
      donationAmountUSD: donationUsdt,
      slearnDonationAmount: 0,
      usdtHash: hash,
      courseId,
    }),
  })
  if (donated.status !== 200) {
    return { ok: false, balance: before, reason: `add-donation → ${donated.status} ${JSON.stringify(donated.body).slice(0, 160)}` }
  }

  const after = await vaultBalance(page, courseId, wallet)
  return { ok: after.usdt >= minUsdt, balance: after, donated: hash }
}
