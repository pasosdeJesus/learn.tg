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
  if (process.env.NEXT_PUBLIC_SLEARN_ADDRESS) {
    return process.env.NEXT_PUBLIC_SLEARN_ADDRESS as `0x${string}`
  }
  return readAddr('SLEARN')
}

export async function getV2Address(): Promise<`0x${string}`> {
  return process.env.NEXT_PUBLIC_DEPLOYED_AT_V2 as `0x${string}`
}
