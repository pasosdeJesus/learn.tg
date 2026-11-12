// Runtime for the operational scripts of this app, without Hardhat: plain `ethers` with
// a provider for the network in `apps/.env`, the deployer signer and factories/contracts
// built from `artifacts/` (the shape `contract:compile` writes).
//
// Run a script with `node --import tsx scripts/<name>.ts`; the network comes from
// `NEXT_PUBLIC_NETWORK` and the RPC from `NEXT_PUBLIC_RPC_URL` (the wrappers in `bin/`
// export both from `apps/.env`).
import * as fs from 'fs'
import * as path from 'path'
import dotenv from 'dotenv'
import {
  Contract,
  ContractFactory,
  JsonRpcProvider,
  MaxUint256,
  Wallet,
  ZeroAddress,
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
} from 'ethers'

dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') })

const ARTIFACTS = path.join(__dirname, '..', '..', 'artifacts')

const DEFAULT_RPC: Record<string, string> = {
  celo: 'https://forno.celo.org',
  celoSepolia: 'https://forno.celo-sepolia.celo-testnet.org/',
  base: 'https://mainnet.base.org',
  'base-sepolia': 'https://sepolia.base.org',
}

export function networkName(): string {
  return process.env.NEXT_PUBLIC_NETWORK || 'celoSepolia'
}

function rpcUrl(): string {
  return process.env.NEXT_PUBLIC_RPC_URL || DEFAULT_RPC[networkName()] || DEFAULT_RPC.celoSepolia
}

let cachedProvider: JsonRpcProvider | null = null

function providerInstance(): JsonRpcProvider {
  if (!cachedProvider) cachedProvider = new JsonRpcProvider(rpcUrl())
  return cachedProvider
}

function signerInstance(): Wallet {
  const key = process.env.PRIVATE_KEY
  if (!key) throw new Error('PRIVATE_KEY not found in apps/.env')
  return new Wallet(key, providerInstance())
}

function readArtifact(sourceName: string, contractName: string) {
  const file = path.join(ARTIFACTS, sourceName, `${contractName}.json`)
  if (!fs.existsSync(file)) throw new Error(`Artifact not found: ${file} (run bin/m contract:compile)`)
  return JSON.parse(fs.readFileSync(file, 'utf8')) as { abi: any[]; bytecode: string }
}

function resolveArtifact(name: string) {
  const [sourceName, contractName] = name.includes(':') ? name.split(':') : ['', name]
  if (sourceName) return readArtifact(sourceName, contractName)
  const direct = path.join('contracts', `${contractName}.sol`)
  return readArtifact(direct, contractName)
}

export function artifactOf(name: string) {
  return resolveArtifact(name)
}

export async function getSigners(): Promise<Wallet[]> {
  return [signerInstance()]
}

export async function getContractFactory(name: string): Promise<ContractFactory> {
  const artifact = resolveArtifact(name)
  return new ContractFactory(artifact.abi, artifact.bytecode, signerInstance())
}

export async function getContractAt(name: string, address: string, signer?: Wallet): Promise<Contract> {
  const artifact = resolveArtifact(name)
  return new Contract(address, artifact.abi, signer ?? signerInstance())
}

export const ethers = {
  Contract,
  ContractFactory,
  JsonRpcProvider,
  MaxUint256,
  Wallet,
  ZeroAddress,
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
  getSigners,
  getContractFactory,
  getContractAt,
  get provider() {
    return providerInstance()
  },
}
