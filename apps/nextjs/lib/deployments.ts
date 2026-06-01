import path from 'path'
import { getContractAddress } from '@pasosdejesus/m/blockchain/deployments'

const deploymentsDir = path.join(process.cwd(), '..', 'hardhat', 'deployments')
const network = process.env.NEXT_PUBLIC_NETWORK === 'celo' ? 'celo' : 'celoSepolia'

export function getV3Address(): `0x${string}` {
  return getContractAddress(network, 'NEXT_PUBLIC_DEPLOYED_AT', deploymentsDir, {
    contract: 'LearnTGVaults',
    version: 'V3',
  }) as `0x${string}`
}

export function getSlearnAddress(): `0x${string}` {
  return getContractAddress(network, 'NEXT_PUBLIC_SLEARN_ADDRESS', deploymentsDir, {
    contract: 'SLEARN',
  }) as `0x${string}`
}

export function getV2Address(): `0x${string}` {
  return process.env.NEXT_PUBLIC_DEPLOYED_AT_V2 as `0x${string}`
}
