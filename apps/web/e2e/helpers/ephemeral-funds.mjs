// Devolver a la billetera de apps/.env lo que quede en billeteras efímeras.
//
// Por qué: los specs de pago crean una billetera por corrida y la fondean desde
// `apps/.env` (0.5 CELO + 1 MUSDT en `in-app-wallet-payments`, más SLEARN cuando la
// mezcla lo pide). Si la llave vive en Node (el registro local o un
// `generatePrivateKey()` del propio spec), al terminar se puede devolver el saldo y
// no se acumulan restos en cuentas que nadie vuelve a mirar.
//
// No toca mainnet: `NEXT_PUBLIC_NETWORK`/RPC deben ser de Celo Sepolia.

import * as fs from 'fs'
import * as path from 'path'
import {
  createPublicClient, createWalletClient, http, formatUnits, parseUnits,
} from 'viem'
import { celoSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
]

/** 0.05 CELO: deja gas para la propia transferencia y para un reintento. */
export const DEFAULT_CELO_RESERVE = '0.05'

const ENV_CANDIDATES = [
  path.join(process.cwd(), '..', '.env'), // apps/.env (cwd = apps/web)
  path.join(process.cwd(), 'apps', '.env'),
  path.join(process.cwd(), '.env'),
]

/** Lee `apps/.env` sin imprimir secretos. Devuelve null si no lo encuentra. */
export function loadTestWallet() {
  for (const envPath of ENV_CANDIDATES) {
    if (!fs.existsSync(envPath)) continue
    const content = fs.readFileSync(envPath, 'utf8')
    const g = (key) => content.match(new RegExp(`${key}="?([^"\\n]+)"?`))?.[1]
    const privateKey = g('PRIVATE_KEY')
    const address = g('NEXT_PUBLIC_ADDRESS')
    if (!privateKey || !address) continue
    return {
      privateKey,
      address,
      rpc: g('NEXT_PUBLIC_RPC_URL'),
      usdt: g('NEXT_PUBLIC_USDT_TESTNET'),
      usdtDecimals: Number(g('NEXT_PUBLIC_USDT_DECIMALS') || 6),
      slearn: g('NEXT_PUBLIC_SLEARN_TESTNET'),
      slearnDecimals: 2,
      envPath,
    }
  }
  return null
}

function clients(rpc) {
  const transport = http(rpc || 'https://forno.celo-sepolia.celo-testnet.org')
  return {
    read: createPublicClient({ chain: celoSepolia, transport }),
    write: (account) => createWalletClient({ account, chain: celoSepolia, transport }),
  }
}

/**
 * Devuelve los saldos de `privateKey` a `options.to` (por omisión la billetera de
 * `apps/.env`): primero los ERC-20 (USDT/MUSDT y SLEARN) y después el CELO que
 * exceda `celoReserve`.
 *
 * Best-effort: cada transferencia se intenta por separado y un fallo se registra
 * en `warnings` sin abortar el resto (una prueba no debe fallar por la limpieza).
 *
 * @param {string} privateKey llave efímera (0x…)
 * @param {{ to?: string, rpc?: string, tokens?: Array<{address: string, symbol?: string, decimals: number}>,
 *           celoReserve?: string, waitReceipt?: boolean }} [options]
 */
export async function sweepToTestWallet(privateKey, options = {}) {
  const test = loadTestWallet()
  const to = options.to || test?.address
  if (!to) throw new Error('sweep: falta la billetera destino (NEXT_PUBLIC_ADDRESS en apps/.env)')

  const account = privateKeyToAccount(privateKey)
  if (account.address.toLowerCase() === to.toLowerCase()) {
    return { from: account.address, to, returned: [], warnings: ['es la misma billetera'] }
  }

  const rpc = options.rpc || test?.rpc
  const { read, write } = clients(rpc)
  const wallet = write(account)
  const waitReceipt = options.waitReceipt !== false
  const returned = []
  const warnings = []

  const tokens = options.tokens ?? [
    test?.usdt ? { address: test.usdt, symbol: 'MUSDT', decimals: test.usdtDecimals } : null,
    test?.slearn ? { address: test.slearn, symbol: 'SLEARN', decimals: test.slearnDecimals } : null,
  ].filter(Boolean)

  for (const token of tokens) {
    try {
      const balance = await read.readContract({
        address: token.address, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address],
      })
      if (balance === 0n) continue
      const hash = await wallet.writeContract({
        address: token.address, abi: ERC20_ABI, functionName: 'transfer', args: [to, balance],
      })
      if (waitReceipt) await read.waitForTransactionReceipt({ hash, timeout: 120000 }).catch(() => null)
      returned.push({ symbol: token.symbol || token.address, amount: formatUnits(balance, token.decimals), hash })
    } catch (error) {
      warnings.push(`${token.symbol || token.address}: ${error.message}`)
    }
  }

  try {
    const balance = await read.getBalance({ address: account.address })
    const reserve = parseUnits(options.celoReserve ?? DEFAULT_CELO_RESERVE, 18)
    if (balance > reserve) {
      const value = balance - reserve
      const hash = await wallet.sendTransaction({ to, value })
      if (waitReceipt) await read.waitForTransactionReceipt({ hash, timeout: 120000 }).catch(() => null)
      returned.push({ symbol: 'CELO', amount: formatUnits(value, 18), hash })
    }
  } catch (error) {
    warnings.push(`CELO: ${error.message}`)
  }

  return { from: account.address, to, returned, warnings }
}

/**
 * Barre las billeteras del registro local (`apps/.e2e-wallets.local.json`).
 * Sólo las creadas desde `since` (ISO) y nunca la billetera de `apps/.env`.
 *
 * @param {{ since?: string, dryRun?: boolean, to?: string, celoReserve?: string }} [options]
 */
export async function sweepRegistry(options = {}) {
  const registryPath = path.join(process.cwd(), '..', '.e2e-wallets.local.json')
  if (!fs.existsSync(registryPath)) return { swept: [], warnings: ['no hay registro local'] }
  const rows = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
  const since = options.since ? new Date(options.since).getTime() : 0
  const test = loadTestWallet()
  const swept = []
  const warnings = []

  for (const row of rows) {
    if (!row?.privateKey || !row?.address) continue
    if (test && row.address.toLowerCase() === test.address.toLowerCase()) continue
    const createdAt = row.createdAt ? new Date(row.createdAt).getTime() : 0
    if (createdAt < since) continue
    if (options.dryRun) {
      swept.push({ from: row.address, dryRun: true })
      continue
    }
    const result = await sweepToTestWallet(row.privateKey, {
      to: options.to, celoReserve: options.celoReserve,
    })
    swept.push(result)
    warnings.push(...result.warnings.map((w) => `${row.address}: ${w}`))
  }

  return { swept, warnings }
}

export function summarizeSweep(result) {
  const lines = []
  for (const item of result.returned ?? []) {
    lines.push(`[SWEEP] ${result.from} -> ${result.to}: ${item.amount} ${item.symbol}`)
  }
  for (const warning of result.warnings ?? []) lines.push(`[WARN] sweep ${result.from}: ${warning}`)
  return lines
}
