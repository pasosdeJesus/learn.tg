'use server'

import * as fs from 'fs'
import * as path from 'path'
import { getContractAddress } from '@pasosdejesus/m/blockchain/deployments'

function getNetwork(): string {
  return process.env.NEXT_PUBLIC_NETWORK === 'celo' ? 'celo' : 'celoSepolia'
}

function readAddr(relativePath: string): `0x${string}` {
  const net = getNetwork()
  const deploymentsDir = path.join(process.cwd(), '..', 'hardhat', 'deployments')
  const file = path.join(deploymentsDir, ...relativePath.split('/'), `${net}.json`)
  if (!fs.existsSync(file)) {
    throw new Error(`Deployment not found: ${file}`)
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')).address as `0x${string}`
}

function getDeploymentsDir(): string {
  return path.join(process.cwd(), '..', 'hardhat', 'deployments')
}

export async function getV3Address(): Promise<`0x${string}`> {
  return getContractAddress(getNetwork(), 'NEXT_PUBLIC_DEPLOYED_AT', getDeploymentsDir(), {
    contract: 'LearnTGVaults',
    version: 'V3',
  }) as `0x${string}`
}

export async function getSlearnAddress(): Promise<`0x${string}`> {
  const network = getNetwork() as 'celo' | 'celoSepolia'
  const { SLEARN_ADDRESSES } = await import('@pasosdejesus/mpdj/blockchain/ecosystem-addresses')
  const addr = SLEARN_ADDRESSES[network]
  if (addr) return addr as `0x${string}`
  return readAddr('SLEARN')
}

export async function getV4Address(): Promise<`0x${string}`> {
  return getContractAddress(getNetwork(), 'NEXT_PUBLIC_DEPLOYED_AT', getDeploymentsDir(), {
    contract: 'LearnTGVaults',
    version: 'V4',
  }) as `0x${string}`
}

export async function getV5Address(): Promise<`0x${string}`> {
  return getContractAddress(getNetwork(), 'NEXT_PUBLIC_DEPLOYED_AT_V5', getDeploymentsDir(), {
    contract: 'LearnTGVaults',
    version: 'V5',
  }) as `0x${string}`
}

export async function getV2Address(): Promise<`0x${string}`> {
  return process.env.NEXT_PUBLIC_DEPLOYED_AT_V2 as `0x${string}`
}

// Vault version detection for ABI selection
export type VaultVersion = 'V5' | 'V4'

/**
 * Returns the most recent deployed vault address and its version.
 * Tries V5 first, falls back to V4. No env vars needed —
 * reads from deployment JSON files only.
 */
export async function getActiveVault(): Promise<{ address: `0x${string}`; version: VaultVersion }> {
  try {
    const addr = await getV5Address()
    return { address: addr, version: 'V5' }
  } catch {
    const addr = await getV4Address()
    return { address: addr, version: 'V4' }
  }
}
