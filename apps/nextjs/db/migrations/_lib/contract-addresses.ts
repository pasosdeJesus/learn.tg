import path from 'path'
import { getContractAddress } from '@pasosdejesus/m/blockchain/deployments'

/**
 * Direcciones de los vaults desplegados, para las migraciones que mueven datos
 * entre versiones del contrato (V3 -> V4 -> V5).
 *
 * Vive dentro de `db/migrations/` y no en `lib/`: las migraciones corren bajo
 * kysely-ctl + jiti y solo resuelven rutas relativas y `node_modules` (los alias
 * `@/...` de `tsconfig` no están habilitados para el cargador), así que el helper
 * se queda en el mundo de las migraciones. La carpeta `_lib` no lleva el prefijo
 * de timestamp que kysely-ctl usa para reconocer migraciones.
 *
 * La búsqueda de `apps/hardhat/deployments/...` la hace `@pasosdejesus/m`
 * (`readDeployment`: `{contrato}/{versión}/{red}.json` -> `{contrato}/{red}.json`
 * -> `{red}.json`). Aquí se añade solo lo que la migración necesita: la red del
 * proyecto, la ruta del directorio y **lanzar** si no hay dirección (la función de
 * `m` devuelve `null`).
 */
const CONTRACT = 'LearnTGVaults'

export function getNetwork(): string {
  return process.env.NEXT_PUBLIC_NETWORK === 'celo' ? 'celo' : 'celoSepolia'
}

export function getDeploymentsDir(): string {
  return path.join(process.cwd(), '..', 'hardhat', 'deployments')
}

function vaultAddress(version: string, envVar: string): `0x${string}` {
  const address = getContractAddress(getNetwork(), envVar, getDeploymentsDir(), {
    contract: CONTRACT,
    version,
  })
  if (address) return address
  throw new Error(`${CONTRACT} ${version} not deployed — address not found`)
}

export function getV3Address(): `0x${string}` {
  return vaultAddress('V3', 'NEXT_PUBLIC_DEPLOYED_AT')
}

export function getV4Address(): `0x${string}` {
  return vaultAddress('V4', 'NEXT_PUBLIC_DEPLOYED_AT')
}

export function getV5Address(): `0x${string}` {
  return vaultAddress('V5', 'NEXT_PUBLIC_DEPLOYED_AT_V5')
}
