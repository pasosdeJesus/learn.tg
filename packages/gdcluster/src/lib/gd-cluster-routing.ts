import { formatUnits, type Address } from 'viem'
import ClusterFundsV2Abi from '../abis/ClusterFundsV2.json'
import Erc20Abi from '../abis/IERC20.json'

const GD_COURSE_IDS = [10, 11]

interface GDDestination {
  type: 'cluster' | 'country' | 'sierra_leone'
  destination: string // cluster wallet or country code (alfa2)
}

/**
 * Contexto para registrar en el ledger (`transaction`, tipo
 * `cluster_contribution`) el 10% enrutado al fondo del clúster/país
 * (https://github.com/pasosdeJesus/learn.tg/issues/161 — decisión 2026-10-26).
 */
export interface ClusterContributionCtx {
  db: any
  usuarioId: number
  /** Billetera del estudiante que originó el desvío (`transaction.wallet` es NOT NULL). */
  wallet: string
  source: 'course' | 'guide'
  courseId: number
  guideId?: number | null
  usdtDecimals: number
  slearnDecimals: number
}

/**
 * Resolve where a GD course scholarship should be routed:
 * 1. Student's church cluster wallet
 * 2. Student's country (if classified as type 1)
 * 3. Sierra Leone (fallback)
 */
export async function resolveGDClusterDestination(
  db: any,
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

  if (usuario?.pais_id) {
    const pais = await db.selectFrom('msip_pais')
      .select(['alfa2', 'tipo_region'])
      .where('id', '=', usuario.pais_id)
      .executeTakeFirst()
    if (pais?.tipo_region === 1 && pais.alfa2) {
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
 *
 * `readDeployment`/`path` se importan de forma diferida: tiran `fs`/`path` de
 * Node y romperían el test aislado del motor (vite:import-analysis no resuelve
 * builtins desde el root del paquete). La resolución de deployments solo ocurre
 * en handlers server-side, donde sí están disponibles.
 */
export async function getClusterFundsAddress(): Promise<Address> {
  const [{ readDeployment }, path] = await Promise.all([
    import('@pasosdejesus/m/blockchain/deployments'),
    import('path'),
  ])
  const network = process.env.NEXT_PUBLIC_NETWORK === 'celo' ? 'celo' : 'celoSepolia'
  const deploymentsDir = path.join(process.cwd(), '..', 'contracts', 'deployments')
  const deployment = readDeployment(network, deploymentsDir, { contract: 'ClusterFundsV2' })
  if (!deployment?.address) throw new Error('ClusterFundsV2 not deployed — address not found')
  return deployment.address as Address
}

/**
 * Dependencias del core inyectadas por el host (D2, https://gitlab.com/pasosdeJesus/m/-/work_items/35 §11.2): el motor no
 * importa `@/lib/backend-config`.
 */
export interface GdRoutingDeps {
  sendTxAndWait: (walletClient: any, publicClient: any, args: any) => Promise<`0x${string}`>
}

/**
 * Route GD scholarship funds to ClusterFunds.
 * Approves tokens and credits the cluster/country fund 100%
 * (processClusterContribution / processCountryContribution, no fees).
 */
export async function routeToClusterFunds(
  routing: GdRoutingDeps,
  publicClient: any,
  walletClient: any,
  account: any,
  tx: Address,
  destino: GDDestination,
  usdtAmount: bigint,
  slearnAmount: bigint,
  usdtToken: Address,
  slearnToken: Address,
  ledger?: ClusterContributionCtx,
): Promise<{ usdtHash?: string; slearnHash?: string }> {
  const { sendTxAndWait } = routing
  const cfAddress = await getClusterFundsAddress()
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
  let usdtHash: string | undefined
  let slearnHash: string | undefined
  if (usdtAmount > 0n) {
    usdtHash = await sendWithNonce({
      address: usdtToken,
      abi: Erc20Abi as any,
      functionName: 'transfer',
      args: [cfAddress, usdtAmount],
    }, 'USDT transfer')
  }

  if (slearnAmount > 0n) {
    slearnHash = await sendWithNonce({
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

  if (ledger) {
    try {
      await recordClusterContribution(ledger, destino, {
        usdtAmount, slearnAmount, usdtHash, slearnHash,
      })
    } catch (e: any) {
      // El dinero ya se movió: el fallo del asiento no debe romper la compra.
      console.error(`[gd] Cluster contribution ledger insert failed: ${e?.message || e}`)
      try {
        await ledger.db.insertInto('admin_solves').values({
          type: 'gd_cluster_ledger',
          metadata: JSON.stringify({
            usuarioId: ledger.usuarioId,
            courseId: ledger.courseId,
            guideId: ledger.guideId ?? null,
            destino,
            usdtHash: usdtHash ?? null,
            slearnHash: slearnHash ?? null,
            usdtAmount: usdtAmount.toString(),
            slearnAmount: slearnAmount.toString(),
            error: e?.message || String(e),
          }),
        }).execute()
      } catch (e2: any) {
        console.error(`[gd] Could not record admin_solves for ledger failure: ${e2?.message || e2}`)
      }
    }
  }

  return { usdtHash, slearnHash }
}

/**
 * Registra el 10% enrutado al fondo del clúster/país como asiento del ledger
 * (`transaction.type = 'cluster_contribution'`), una fila por token.
 *
 * - `hash` es el hash de la **transferencia real** al contrato ClusterFundsV2
 *   (no el hash del pago del curso/guía).
 * - Idempotente por `(crypto, hash)` — la restricción única de `transaction`.
 * - `balance_impact = 0`: los tokens salen de la billetera del backend pero su
 *   salida ya quedó registrada en la fila del pago/beca que originó el desvío;
 *   estas filas informan el destino del fondo, no mueven el saldo del usuario.
 * - No se expone en superficies públicas (ranking de usuarios, métricas,
 *   donaciones, referidos); solo en `gdcluster/ranking/funds`.
 */
export async function recordClusterContribution(
  ctx: ClusterContributionCtx,
  destino: GDDestination,
  transfer: {
    usdtAmount: bigint
    slearnAmount: bigint
    usdtHash?: string
    slearnHash?: string
  },
): Promise<number> {
  const isCluster = destino.type === 'cluster'
  const categoria = isCluster ? 'cluster' : 'country'
  const metadata: Record<string, any> = {
    ...(isCluster ? { clusterWallet: destino.destination } : { countryCode: destino.destination }),
    source: ctx.source,
    courseId: ctx.courseId,
    ...(ctx.guideId != null ? { guideId: ctx.guideId } : {}),
  }

  const rows: { crypto: string; amount: number; hash: string }[] = []
  if (transfer.usdtAmount > 0n && transfer.usdtHash) {
    rows.push({
      crypto: 'usdt',
      amount: Number(formatUnits(transfer.usdtAmount, ctx.usdtDecimals)),
      hash: transfer.usdtHash,
    })
  }
  if (transfer.slearnAmount > 0n && transfer.slearnHash) {
    rows.push({
      crypto: 'slearn',
      amount: Number(formatUnits(transfer.slearnAmount, ctx.slearnDecimals)),
      hash: transfer.slearnHash,
    })
  }

  let inserted = 0
  for (const row of rows) {
    const res = await ctx.db.insertInto('transaction').values({
      usuario_id: ctx.usuarioId,
      type: 'cluster_contribution',
      crypto: row.crypto,
      amount: row.amount,
      balance_impact: 0,
      categoria,
      subcategoria: categoria,
      descripcion: 'Global Disciples 10% routed to the cluster fund',
      hash: row.hash,
      wallet: ctx.wallet,
      date: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
      metadata: JSON.stringify(metadata),
    }).onConflict((oc: any) => oc.columns(['crypto', 'hash']).doNothing()).executeTakeFirst()
    inserted += Number((res as any)?.numInsertedRows ?? 0)
  }
  return inserted
}
