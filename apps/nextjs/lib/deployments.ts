import * as fs from 'fs'
import * as path from 'path'

const deploymentsDir = path.join(process.cwd(), '..', 'hardhat', 'deployments')
const network = process.env.NEXT_PUBLIC_NETWORK === 'celo' ? 'celo' : 'celoSepolia'

function readAddr(subdir: string): `0x${string}` {
  const file = path.join(deploymentsDir, subdir, `${network}.json`)
  if (!fs.existsSync(file)) {
    throw new Error(`Deployment file not found: ${file}. Run bin/deploy first.`)
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')).address as `0x${string}`
}

export function getV3Address(): `0x${string}` {
  return readAddr('LearnTGVaults/V3')
}

export function getSlearnAddress(): `0x${string}` {
  return readAddr('SLEARN')
}

export function getV2Address(): `0x${string}` {
  return process.env.NEXT_PUBLIC_DEPLOYED_AT_V2 as `0x${string}`
}
