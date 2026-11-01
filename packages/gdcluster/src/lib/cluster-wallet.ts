import { getAddress, isAddress } from 'viem'
import { getClusterFundsAddress } from './gd-cluster-routing.js'

// `getOwners()` de Safe (y multisigs compatibles). Si el contrato no lo expone, la
// llamada revierte y la dirección no se puede verificar como multisig.
const SAFE_OWNERS_ABI = [
  {
    inputs: [],
    name: 'getOwners',
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export type WalletControlProblem = 'not_initiator' | 'safe_without_initiator' | 'safe_owners' | 'unverified'

export interface WalletControl {
  kind: 'eoa' | 'safe'
  owners?: string[]
}

// Billetera del clúster (https://github.com/pasosdeJesus/learn.tg/issues/161): es el
// destino del fondo y lo que los pastores aprueban antes de presentar el clúster a GD.
// Validación barata contra errores de copiar/pegar:
//   1. dirección EVM válida, con checksum EIP-55 cuando viene en minúsculas y mayúsculas
//      mezcladas (viem `isAddress` estricto);
//   2. no la dirección cero;
//   3. no una dirección de la plataforma (backend, referidos, iglesias, tesorería, UBI,
//      reservas, verificadores) ni el contrato `ClusterFundsV2`: pegar una de esas manda
//      los fondos al lugar equivocado;
//   4. se informa `checksummed` para que la UI avise cuando la dirección llegó toda en
//      minúsculas (sin checksum, un carácter cambiado no se detecta).

export type ClusterWalletProblem = 'invalid' | 'zero' | 'platform'

export interface ClusterWalletResult {
  address: string
  checksummed: boolean
}

export async function validateClusterWallet(
  input: string,
): Promise<{ error: ClusterWalletProblem } | ClusterWalletResult> {
  const value = input.trim()
  if (!value || !isAddress(value, { strict: true })) return { error: 'invalid' }
  if (value.toLowerCase() === '0x0000000000000000000000000000000000000000') return { error: 'zero' }

  const known = new Set<string>()
  const add = (address?: string | null) => {
    if (address && isAddress(address)) known.add(address.toLowerCase())
  }
  add(process.env.NEXT_PUBLIC_ADDRESS)
  add(process.env.NEXT_PUBLIC_REFERRAL_WALLET_ADDRESS)
  add(process.env.NEXT_PUBLIC_CHURCHES_WALLET_ADDRESS)
  add(process.env.NEXT_PUBLIC_UBI_WALLET_ADDRESS)
  add(process.env.NEXT_PUBLIC_LEARN_TG_RESERVE_ADDRESS)
  add(process.env.NEXT_PUBLIC_STABLE_SL_RESERVE_ADDRESS)
  add(process.env.NEXT_PUBLIC_PDJ_TREASURY_ADDRESS)
  for (const verifier of (process.env.NEXT_PUBLIC_VERIFIER_WALLET || '').split(',')) add(verifier.trim())
  try {
    add(await getClusterFundsAddress())
  } catch {
    // Sin despliegue de ClusterFundsV2: la validación sigue con las variables de entorno.
  }

  if (known.has(value.toLowerCase())) return { error: 'platform' }

  return {
    address: getAddress(value),
    // Una dirección toda en minúsculas no trae checksum: se acepta, pero la UI avisa.
    checksummed: value !== value.toLowerCase(),
  }
}

/**
 * Control de la billetera del clúster (decisión del operador, 2026-10-22):
 * - si es una cuenta normal (EOA), tiene que ser **una de las billeteras registradas en la
 *   cuenta del pastor iniciador** (las que ya probó con SIWE);
 * - si es un contrato, se lee `getOwners()` (Safe) y al menos uno de los dueños tiene que
 *   ser una billetera registrada del iniciador;
 * - un contrato que no expone `getOwners()` no se puede verificar y se rechaza.
 *
 * No mueve fondos: son lecturas (`getCode` + una llamada de vista).
 */
export async function checkWalletControl(
  publicClient: any,
  wallet: string,
  initiatorWallets: string[],
  pastorWallets: string[][] = [initiatorWallets],
): Promise<{ ok: true } & WalletControl | { ok: false; reason: WalletControlProblem }> {
  const allowed = new Set(initiatorWallets.map((address) => address.toLowerCase()))

  let hasCode = false
  try {
    const code = await publicClient.getCode({ address: wallet })
    hasCode = !!code && code !== '0x'
  } catch {
    return { ok: false, reason: 'unverified' }
  }

  if (!hasCode) {
    return allowed.has(wallet.toLowerCase())
      ? { ok: true, kind: 'eoa' }
      : { ok: false, reason: 'not_initiator' }
  }

  try {
    const owners = (await publicClient.readContract({
      address: wallet,
      abi: SAFE_OWNERS_ABI,
      functionName: 'getOwners',
    })) as string[]
    if (!Array.isArray(owners) || owners.length === 0) return { ok: false, reason: 'unverified' }
    const normalized = owners.map((owner) => String(owner).toLowerCase())
    if (!normalized.some((owner) => allowed.has(owner))) {
      return { ok: false, reason: 'safe_without_initiator' }
    }
    // Un dueño por pastor del clúster y cada dueño una billetera registrada de ESE pastor.
    return ownersMatchPastors(normalized, pastorWallets)
      ? { ok: true, kind: 'safe', owners }
      : { ok: false, reason: 'safe_owners' }
  } catch {
    // No expone getOwners(): no es una Safe o el RPC falló; no se puede verificar.
    return { ok: false, reason: 'unverified' }
  }
}

/**
 * Emparejamiento uno a uno entre los dueños de la multisig y los pastores del clúster:
 * tiene que haber tantos dueños como pastores y cada dueño tiene que ser una billetera
 * registrada de un pastor distinto (un pastor puede tener varias, la multisig una por
 * pastor). Es un emparejamiento bipartito simple (Kuhn) porque el número es pequeño.
 */
function ownersMatchPastors(owners: string[], pastorWallets: string[][]): boolean {
  if (owners.length !== pastorWallets.length) return false
  if (owners.length === 0) return false
  const used = new Array(pastorWallets.length).fill(false)
  const assign = (ownerIndex: number): boolean => {
    for (let pastorIndex = 0; pastorIndex < pastorWallets.length; pastorIndex++) {
      if (used[pastorIndex]) continue
      const wallets = pastorWallets[pastorIndex].map((address) => address.toLowerCase())
      if (!wallets.includes(owners[ownerIndex])) continue
      used[pastorIndex] = true
      if (ownerIndex + 1 === owners.length || assign(ownerIndex + 1)) return true
      used[pastorIndex] = false
    }
    return false
  }
  return assign(0)
}
