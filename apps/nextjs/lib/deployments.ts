import { getContractAddress } from '@pasosdejesus/m/blockchain/deployments'

function getNetwork(): string {
  return process.env.NEXT_PUBLIC_NETWORK === 'celo' ? 'celo' : 'celoSepolia'
}

function readAddr(relativePath: string): `0x${string}` {
  // Server-side only — uses fs
  const fs = require('fs')
  const path = require('path')
  const deploymentsDir = path.join(process.cwd(), '..', 'hardhat', 'deployments')
  const net = getNetwork()
  const file = path.join(deploymentsDir, ...relativePath.split('/'), `${net}.json`)
  if (!fs.existsSync(file)) {
    throw new Error(`Deployment not found: ${file}`)
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')).address as `0x${string}`
}

function getDeploymentsDir(): string {
  const path = require('path')
  return path.join(process.cwd(), '..', 'hardhat', 'deployments')
}

export function getV3Address(): `0x${string}` {
  return getContractAddress(getNetwork(), 'NEXT_PUBLIC_DEPLOYED_AT', getDeploymentsDir(), {
    contract: 'LearnTGVaults',
    version: 'V3',
  }) as `0x${string}`
}

export function getSlearnAddress(): `0x${string}` {
  if (process.env.NEXT_PUBLIC_SLEARN_ADDRESS) {
    return process.env.NEXT_PUBLIC_SLEARN_ADDRESS as `0x${string}`
  }
  return readAddr('SLEARN')
}

export function getV2Address(): `0x${string}` {
  return process.env.NEXT_PUBLIC_DEPLOYED_AT_V2 as `0x${string}`
}
