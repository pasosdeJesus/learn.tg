import * as fs from 'fs'
import * as path from 'path'
import { getContractAddress } from '@pasosdejesus/m/blockchain/deployments'

const deploymentsDir = path.join(process.cwd(), '..', 'hardhat', 'deployments')

function getNetwork(): string {
  return process.env.NEXT_PUBLIC_NETWORK === 'celo' ? 'celo' : 'celoSepolia'
}

function readAddr(relativePath: string): `0x${string}` {
  const net = getNetwork()
  const file = path.join(deploymentsDir, ...relativePath.split('/'), `${net}.json`)
  if (!fs.existsSync(file)) {
    throw new Error(`Deployment not found: ${file}`)
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')).address as `0x${string}`
}

export function getV3Address(): `0x${string}` {
  return getContractAddress(getNetwork(), 'NEXT_PUBLIC_DEPLOYED_AT', deploymentsDir, {
    contract: 'LearnTGVaults',
    version: 'V3',
  }) as `0x${string}`
}

export function getSlearnAddress(): `0x${string}` {
  return readAddr('SLEARN')
}

export function getV2Address(): `0x${string}` {
  return process.env.NEXT_PUBLIC_DEPLOYED_AT_V2 as `0x${string}`
}
