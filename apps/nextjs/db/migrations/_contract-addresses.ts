import fs from 'fs'
import path from 'path'

// Helper de direcciones de contratos para migraciones kysely (REQ/35 Fase 3).
//
// Las migraciones se cargan con kysely-ctl/jiti, que NO resuelve paquetes de
// motores link: (`@learn-tg/rewards/src/lib/deployments` importaba
// `@pasosdejesus/m`, inalcanzable desde el paquete). Este helper replica esa
// lógica con solo builtins (fs/path) y rutas relativas, igual que las
// migraciones ya importan los abis (`../../abis/*.json`).
//
// El archivo no matchea el prefijo de timestamp de kysely → no se trata como
// migración.

export function getNetwork(): string {
  return process.env.NEXT_PUBLIC_NETWORK === 'celo' ? 'celo' : 'celoSepolia'
}

export function getDeploymentsDir(): string {
  return path.join(process.cwd(), '..', 'hardhat', 'deployments')
}

function readDeployment(
  network: string,
  deploymentsDir: string,
  contract: string,
  version?: string
): { address: string } | null {
  const paths = []
  if (version) paths.push(path.join(deploymentsDir, contract, version, `${network}.json`))
  paths.push(path.join(deploymentsDir, contract, `${network}.json`))
  paths.push(path.join(deploymentsDir, `${network}.json`))
  for (const p of paths) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'))
    }
  }
  return null
}

function getContractAddress(
  envVar: string,
  contract: string,
  version: string
): `0x${string}` {
  const deployment = readDeployment(getNetwork(), getDeploymentsDir(), contract, version)
  if (deployment?.address) return deployment.address as `0x${string}`
  const addr = process.env[envVar]
  if (addr) return addr as `0x${string}`
  throw new Error(`${contract} ${version} not deployed — address not found`)
}

export function getV3Address(): `0x${string}` {
  return getContractAddress('NEXT_PUBLIC_DEPLOYED_AT', 'LearnTGVaults', 'V3')
}

export function getV4Address(): `0x${string}` {
  return getContractAddress('NEXT_PUBLIC_DEPLOYED_AT', 'LearnTGVaults', 'V4')
}

export function getV5Address(): `0x${string}` {
  return getContractAddress('NEXT_PUBLIC_DEPLOYED_AT_V5', 'LearnTGVaults', 'V5')
}
