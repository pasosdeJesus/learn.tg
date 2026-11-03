import { formatUnits } from 'viem'
import ClusterFundsV2Abi from '../abis/ClusterFundsV2.json'
import { addClusterHistory } from './gd-utils.js'
import { readClusterFunds, setClusterVerified } from './cluster-funds.js'
import { getClusterFundsAddress } from './gd-cluster-routing.js'

// Liberación automática al responder Global Disciples
// (https://github.com/pasosdeJesus/learn.tg/issues/161): cuando pdJ registra la respuesta
// (`answered`), se reparte lo que hay en el fondo del país entre los clústeres
// presentados/verificados y se libera el fondo del clúster a su billetera. Ya no hay
// votos de retiro: la aprobación de los pastores ocurrió al presentar el clúster.

const USDT_DECIMALS = 6
const SLEARN_DECIMALS = 2

type Backend = {
  getPublicClient: () => any
  getWalletClient: () => any
  sendTxAndWait: (walletClient: any, publicClient: any, args: any) => Promise<`0x${string}`>
}

/**
 * Reparte **todo** lo que hay en el fondo del país entre los clústeres presentados
 * (verificados) de ese país, por igual (`redistributeCountryFunds`); cada parte queda
 * acreditada al fondo del clúster correspondiente. Sin saldo o sin clústeres verificados
 * en cadena, no hace nada.
 */
export async function redistributeCountryFund(
  backend: Backend,
  db: any,
  cluster: any,
  usuarioId: number,
): Promise<string | null> {
  const pais = await db.selectFrom('msip_pais').select('alfa2').where('id', '=', cluster.country_id).executeTakeFirst()
  const countryCode = pais?.alfa2
  if (!countryCode) return null

  const rows = await db
    .selectFrom('clustergd as c')
    .innerJoin('church as ch', 'ch.id', 'c.initiator_church_id')
    .select('ch.cluster_wallet as wallet')
    .where('c.country_id', '=', cluster.country_id)
    .where('c.gd_status', 'in', ['sent', 'answered'])
    .where('c.status', '!=', 'disbanded')
    // Un clúster que ya recibió sus fondos sale del proceso con GD: no vuelve a
    // repartirse el fondo del país en la respuesta de otro clúster.
    .where('c.fund_released_at', 'is', null)
    .execute()
  const wallets = Array.from(
    new Set((rows as any[]).map((row) => row.wallet).filter((wallet): wallet is string => !!wallet)),
  )
  if (wallets.length === 0) return null

  const publicClient = backend.getPublicClient()
  const address = await getClusterFundsAddress()

  const verified: string[] = []
  for (const wallet of wallets) {
    const funds = (await publicClient.readContract({
      address,
      abi: ClusterFundsV2Abi as any,
      functionName: 'getClusterFunds',
      args: [wallet],
    })) as [bigint, bigint, boolean, boolean]
    if (funds?.[2] && funds?.[3]) verified.push(wallet)
  }
  if (verified.length === 0) return null

  const countryFunds = (await publicClient.readContract({
    address,
    abi: ClusterFundsV2Abi as any,
    functionName: 'getCountryFunds',
    args: [countryCode],
  })) as [bigint, bigint, boolean]
  const usdt = BigInt(countryFunds?.[0] ?? 0n)
  const slearn = BigInt(countryFunds?.[1] ?? 0n)
  if (usdt <= 0n && slearn <= 0n) return null

  const walletClient = backend.getWalletClient()
  const account = walletClient.account
  const nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' })
  const hash = await backend.sendTxAndWait(walletClient, publicClient, {
    address,
    abi: ClusterFundsV2Abi as any,
    functionName: 'redistributeCountryFunds',
    args: [countryCode, verified],
    account,
    chain: publicClient.chain,
    nonce,
  })

  const label = `${formatUnits(usdt, USDT_DECIMALS)} USDT / ${formatUnits(slearn, SLEARN_DECIMALS)} SLEARN among ${verified.length} cluster(s)`
  await addClusterHistory(db, cluster.id, 'country_fund_redistributed', null, `${label} ${hash}`, usuarioId)
  await db.insertInto('userevent')
    .values({
      usuario_id: usuarioId,
      event_type: 'country_fund_redistributed',
      event_data: JSON.stringify({ cluster_id: cluster.id, country: countryCode, hash, clusters: verified }),
      created_at: new Date(),
    })
    .execute()

  return hash
}

/**
 * Libera el fondo del clúster a su billetera con `releaseClusterFunds` (el backend es el
 * dueño del contrato) y registra `fund_released_at` y los montos. Desde ese momento el
 * 10 % de las compras y becas de las iglesias del clúster va al fondo del país.
 */
export async function releaseClusterFund(
  backend: Backend,
  db: any,
  cluster: any,
  wallet: string,
  usuarioId: number,
): Promise<string> {
  const balance = await readClusterFunds({ backend }, wallet)
  if (!balance || (balance.usdt <= 0n && balance.slearn <= 0n)) {
    throw new Error('The cluster fund has no balance to release')
  }

  const publicClient = backend.getPublicClient()
  const walletClient = backend.getWalletClient()
  const account = walletClient.account
  const address = await getClusterFundsAddress()
  const nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' })
  const hash = await backend.sendTxAndWait(walletClient, publicClient, {
    address,
    abi: ClusterFundsV2Abi as any,
    functionName: 'releaseClusterFunds',
    args: [wallet],
    account,
    chain: publicClient.chain,
    nonce,
  })

  const now = new Date()
  await db
    .updateTable('clustergd')
    .set({
      fund_released_at: now,
      fund_released_amount: formatUnits(balance.usdt, USDT_DECIMALS),
      fund_released_slearn: formatUnits(balance.slearn, SLEARN_DECIMALS),
      updated_at: now,
    })
    .where('id', '=', cluster.id)
    .execute()

  await addClusterHistory(db, cluster.id, 'fund_released', null, hash, usuarioId)
  await db.insertInto('userevent')
    .values({
      usuario_id: usuarioId,
      event_type: 'cluster_fund_released',
      event_data: JSON.stringify({ cluster_id: cluster.id, hash, wallet }),
      created_at: now,
    })
    .execute()

  return hash
}

/**
 * Al pasar la presentación a `answered`: reparte el fondo del país entre los clústeres
 * presentados y libera el fondo del clúster. Un fallo en el reparto no bloquea la
 * liberación del clúster; ambos quedan registrados.
 */
export async function releaseOnAnswered(
  deps: { backend: Backend },
  db: any,
  cluster: any,
  usuarioId: number,
): Promise<{ distribution: string | null; release: string | null; errors: string[] }> {
  const walletRow = cluster.initiator_church_id
    ? await db.selectFrom('church').select('cluster_wallet').where('id', '=', cluster.initiator_church_id).executeTakeFirst()
    : null
  const wallet = walletRow?.cluster_wallet ?? null
  const errors: string[] = []
  let distribution: string | null = null
  let release: string | null = null

  try {
    distribution = await redistributeCountryFund(deps.backend, db, cluster, usuarioId)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    errors.push(`country: ${message}`)
    await addClusterHistory(db, cluster.id, 'country_fund_failed', null, message.slice(0, 200), usuarioId)
  }

  if (wallet) {
    try {
      release = await releaseClusterFund(deps.backend, db, cluster, wallet, usuarioId)
      // Ya recibió sus fondos: sale del proceso con GD y el contrato deja de
      // contarlo para los repartos siguientes del fondo del país.
      try {
        await setClusterVerified(deps, wallet, false)
        await addClusterHistory(db, cluster.id, 'cluster_unverified', wallet, null, usuarioId)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        errors.push(`unverify: ${message}`)
        await addClusterHistory(db, cluster.id, 'cluster_unverify_failed', wallet, message.slice(0, 200), usuarioId)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`cluster: ${message}`)
      await addClusterHistory(db, cluster.id, 'fund_release_failed', null, message.slice(0, 200), usuarioId)
    }
  } else {
    errors.push('cluster: no wallet')
  }

  return { distribution, release, errors }
}
