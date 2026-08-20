import { Kysely } from 'kysely'
import type { Address } from 'viem'
import type { DB } from '@/db/db.d'
import ClusterFundsAbi from '@/abis/ClusterFunds.json'
import Erc20Abi from '@/abis/IERC20.json'
import { PILOT_COUNTRIES } from '@/lib/gd-utils'
import { readDeployment } from '@pasosdejesus/m/blockchain/deployments'
import * as path from 'path'

const GD_COURSE_IDS = [10, 11]

interface GDDestination {
  type: 'cluster' | 'country' | 'sierra_leone'
  destination: string // cluster wallet or country code (alfa2)
}

/**
 * Resolve where a GD course scholarship should be routed:
 * 1. Student's church cluster wallet
 * 2. Student's country (if in pilot)
 * 3. Sierra Leone (fallback)
 */
export async function resolveGDClusterDestination(
  db: Kysely<DB>,
  usuarioId: number,
): Promise<GDDestination> {
  // 1. Try church cluster
  const church = await db.selectFrom('church')
    .innerJoin('church_clustergd as cc', 'cc.church_id', 'church.id')
    .select(['church.cluster_wallet', 'church.country_id'])
    .where('church.id', 'in',
      db.selectFrom('usuario').select('church_id').where('id', '=', usuarioId)
    )
    .where('cc.left_at', 'is', null)
    .executeTakeFirst()

  if (church?.cluster_wallet) {
    return { type: 'cluster', destination: church.cluster_wallet }
  }

  // 2. Try country
  const usuario = await db.selectFrom('usuario')
    .select('pais_id')
    .where('id', '=', usuarioId)
    .executeTakeFirst()

  if (usuario?.pais_id && PILOT_COUNTRIES.includes(usuario.pais_id)) {
    const pais = await db.selectFrom('msip_pais')
      .select('alfa2')
      .where('id', '=', usuario.pais_id)
      .executeTakeFirst()
    if (pais?.alfa2) {
      return { type: 'country', destination: pais.alfa2 }
    }
  }

  // 3. Sierra Leone fallback (alfa2 = 'SL')
  return { type: 'sierra_leone', destination: 'SL' }
}

/**
 * Check if a course ID is a Global Disciples course.
 */
export function isGDCourse(courseId: number): boolean {
  return GD_COURSE_IDS.includes(courseId)
}

/**
 * Get ClusterFunds contract address from deployments.
 */
export function getClusterFundsAddress(): Address {
  const network = process.env.NEXT_PUBLIC_NETWORK === 'celo' ? 'celo' : 'celoSepolia'
  const deploymentsDir = path.join(process.cwd(), '..', 'hardhat', 'deployments')
  const deployment = readDeployment(network, deploymentsDir, { contract: 'ClusterFunds' })
  if (!deployment?.address) throw new Error('ClusterFunds not deployed — address not found')
  return deployment.address as Address
}

/**
 * Route GD scholarship funds to ClusterFunds.
 * Approves tokens and calls processDonation or processCountryDonation.
 */
export async function routeToClusterFunds(
  publicClient: any,
  walletClient: any,
  account: any,
  tx: Address,
  donor: Address,
  destino: GDDestination,
  usdtAmount: bigint,
  slearnAmount: bigint,
  usdtToken: Address,
  slearnToken: Address,
) {
  const cfAddress = getClusterFundsAddress()
  const chain = publicClient.chain
  
  // Fetch initial nonce
  let nonce = await publicClient.getTransactionCount({
    address: account.address,
    blockTag: 'pending',
  })

  // Helper to send tx with incremented nonce
  const sendWithNonce = async (args: any) => {
    const hash = await walletClient.writeContract({
      ...args,
      account,
      chain,
      nonce: nonce++,
    })
    await publicClient.waitForTransactionReceipt({ hash })
    return hash
  }

  // Transfer tokens
  if (usdtAmount > 0n) {
    await sendWithNonce({
      address: usdtToken,
      abi: Erc20Abi as any,
      functionName: 'transfer',
      args: [cfAddress, usdtAmount],
    })
  }

  if (slearnAmount > 0n) {
    await sendWithNonce({
      address: slearnToken,
      abi: Erc20Abi as any,
      functionName: 'transfer',
      args: [cfAddress, slearnAmount],
    })
  }

  // Route to ClusterFunds
  if (destino.type === 'cluster') {
    await sendWithNonce({
      address: cfAddress,
      abi: ClusterFundsAbi as any,
      functionName: 'processDonation',
      args: [tx, destino.destination as Address, donor, usdtAmount, slearnAmount],
    })
  } else {
    await sendWithNonce({
      address: cfAddress,
      abi: ClusterFundsAbi as any,
      functionName: 'processCountryDonation',
      args: [tx, destino.destination, donor, usdtAmount, slearnAmount],
    })
  }
}
