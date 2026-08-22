import { Kysely } from 'kysely'
import type { Address } from 'viem'
import type { DB } from '@/db/db.d'
import ClusterFundsV2Abi from '@/abis/ClusterFundsV2.json'
import Erc20Abi from '@/abis/IERC20.json'
import { PILOT_COUNTRIES } from '@/lib/gd-utils'
import { sendTxAndWait } from '@/lib/backend-config'
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
  const deployment = readDeployment(network, deploymentsDir, { contract: 'ClusterFundsV2' })
  if (!deployment?.address) throw new Error('ClusterFundsV2 not deployed — address not found')
  return deployment.address as Address
}

/**
 * Route GD scholarship funds to ClusterFunds.
 * Approves tokens and credits the cluster/country fund 100%
 * (processClusterContribution / processCountryContribution, no fees).
 */
export async function routeToClusterFunds(
  publicClient: any,
  walletClient: any,
  account: any,
  tx: Address,
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
  const sendWithNonce = async (args: any, description: string) => {
    const currentNonce = nonce
    console.log(`[gd-debug] Sending ${description} with nonce ${currentNonce}`)
    try {
      const hash = await sendTxAndWait(walletClient, publicClient, {
        ...args,
        account,
        chain,
        nonce: nonce++,
      })
      console.log(`[gd-debug] ${description} tx confirmed: ${hash}`)
      return hash
    } catch (e: any) {
      console.error(`[gd-debug] Error in ${description} (nonce ${currentNonce}):`, e?.shortMessage || e?.message || e)
      throw e
    }
  }

  // Transfer tokens
  if (usdtAmount > 0n) {
    await sendWithNonce({
      address: usdtToken,
      abi: Erc20Abi as any,
      functionName: 'transfer',
      args: [cfAddress, usdtAmount],
    }, 'USDT transfer')
  }

  if (slearnAmount > 0n) {
    await sendWithNonce({
      address: slearnToken,
      abi: Erc20Abi as any,
      functionName: 'transfer',
      args: [cfAddress, slearnAmount],
    }, 'SLEARN transfer')
  }

  // Route to ClusterFunds (course payments: credit the fund 100%, no fees)
  if (destino.type === 'cluster') {
    await sendWithNonce({
      address: cfAddress,
      abi: ClusterFundsV2Abi as any,
      functionName: 'processClusterContribution',
      args: [tx, destino.destination as Address, usdtAmount, slearnAmount],
    }, 'processClusterContribution')
  } else {
    await sendWithNonce({
      address: cfAddress,
      abi: ClusterFundsV2Abi as any,
      functionName: 'processCountryContribution',
      args: [tx, destino.destination, usdtAmount, slearnAmount],
    }, 'processCountryContribution')
  }
}
