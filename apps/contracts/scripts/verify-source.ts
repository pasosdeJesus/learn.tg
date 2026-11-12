// Verifies the source of a deployed contract with `bin/m contract:verify`, taking the
// constructor arguments from the deployment JSON (they are the ones the deploy wrote).
//
// Usage (from bin/verify-source or directly):
//   node --import tsx scripts/verify-source.ts ClusterFundsV2 [--dry-run]
//
// The pin and the explorer endpoints live in `m-contracts.config.ts`.
import * as fs from 'fs'
import * as path from 'path'
import { execFileSync } from 'child_process'
import { artifactOf, networkName } from './lib/ethers-cli'
import { tokenAddresses } from './lib/token-addresses'

type Deployment = Record<string, unknown>

const DEPLOYMENTS = path.join(__dirname, '..', 'deployments')

const TARGETS: Record<string, { file?: string; envAddress?: string }> = {
  SLEARN: { file: path.join('SLEARN', '{network}.json') },
  ClusterFunds: { file: path.join('ClusterFunds', '{network}.json') },
  ClusterFundsV2: { file: path.join('ClusterFundsV2', '{network}.json') },
  LearnTGVaultsV4: { file: path.join('LearnTGVaults', 'V4', '{network}.json') },
  LearnTGVaultsV5: { file: path.join('LearnTGVaults', 'V5', '{network}.json') },
  MockUSDT: { file: path.join('MockUSDT', '{network}.json') },
  CeloUbi: { envAddress: 'NEXT_PUBLIC_CELOUBI_ADDRESS' },
}

function readDeployment(contract: string, network: string): Deployment {
  const target = TARGETS[contract]
  if (!target?.file) return {}
  const file = path.join(DEPLOYMENTS, target.file.replace('{network}', network))
  if (!fs.existsSync(file)) throw new Error(`${contract} is not deployed on ${network} (missing ${file})`)
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function address(contract: string, network: string, deployment: Deployment): string {
  const fromEnv = TARGETS[contract]?.envAddress
  const addr = (fromEnv ? process.env[fromEnv] : undefined) || (deployment.address as string | undefined)
  if (!addr) throw new Error(`No address for ${contract} on ${network}`)
  return addr
}

async function valueFor(name: string, deployment: Deployment, network: string): Promise<string> {
  const tokens = await tokenAddresses()
  switch (name) {
    case '_usdt':
    case '_usdtToken':
    case 'usdtAddress':
    case 'usdt':
      return (deployment.usdtAddress as string) || tokens.usdt
    case '_slearn':
    case '_slearnToken':
    case 'slearnAddress':
    case 'slearn':
      return (deployment.slearnAddress as string) || tokens.slearn
    case '_pdjTreasury':
    case 'pdjTreasury': {
      const treasury =
        (deployment.pdjTreasury as string) ||
        process.env.NEXT_PUBLIC_PDJ_TREASURY_ADDRESS ||
        process.env.PDJ_TREASURY_ADDRESS
      if (!treasury) throw new Error('pdjTreasury not found in the deployment or in the environment')
      return treasury
    }
    case 'initialOwner':
    case '_backendAddress':
    case 'backendAddress': {
      const owner = (deployment[name] as string) || process.env.NEXT_PUBLIC_ADDRESS
      if (!owner) throw new Error(`${name} not found in the deployment or in the environment`)
      return owner
    }
    default:
      throw new Error(`Unknown constructor argument ${name} for ${network}`)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const contract = args.shift()
  if (!contract) throw new Error(`Usage: verify-source <contract> [--dry-run]\nKnown: ${Object.keys(TARGETS).join(', ')}`)
  if (!TARGETS[contract]) throw new Error(`Unknown contract ${contract}. Known: ${Object.keys(TARGETS).join(', ')}`)

  const network = networkName()
  const deployment = readDeployment(contract, network)
  const constructor = (artifactOf(contract).abi as any[]).find((entry) => entry.type === 'constructor')
  const constructorArgs: string[] = []
  for (const input of constructor?.inputs ?? []) {
    constructorArgs.push(await valueFor(input.name, deployment, network))
  }

  const mBin = path.join(__dirname, '..', '..', 'web', 'bin', 'm')
  const command = [
    'contract:verify',
    '--contract', contract,
    '--network', network,
    '--address', address(contract, network, deployment),
    '--args', JSON.stringify(constructorArgs),
    ...args,
  ]
  console.log(`Verifying ${contract} on ${network}: ${command.join(' ')}`)
  execFileSync(mBin, command, { stdio: 'inherit' })
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
