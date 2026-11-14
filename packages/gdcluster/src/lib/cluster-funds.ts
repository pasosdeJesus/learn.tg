import { formatUnits } from 'viem'
import { sql } from 'kysely'
import ClusterFundsV2Abi from '../abis/ClusterFundsV2.json'
import { getClusterFundsAddress } from './gd-cluster-routing.js'

// Fondos ya acreditados a la billetera del clúster
// (https://github.com/pasosdeJesus/learn.tg/issues/220 §4, #161 §riesgos).
//
// `Church.cluster_wallet` es la fuente de verdad y el fondo de `ClusterFundsV2` está
// **indexado por esa dirección**: si el iniciador (o el verificador, como apoyo) la
// cambia después de recibir el 10%, los fondos viejos siguen en la dirección vieja y ya
// no se ven en el ranking ni se pueden liberar desde la página del clúster. Por eso el
// cambio se bloquea mientras haya saldo, salvo confirmación explícita.

export interface ClusterFundsBalance {
  usdt: bigint
  slearn: bigint
  exists: boolean
  verified: boolean
}

export interface ClusterFundsSummary {
  usdt: string
  slearn: string
}

export interface CountryFundsBalance {
  usdt: bigint
  slearn: bigint
  exists: boolean
}

/** Total donado al fondo de un clúster en learn.tg (`transaction`), para los indicadores. */
export interface ClusterDonations {
  count: number
  usdt_total: number
  slearn_total: number
}

/**
 * Saldo del fondo de una billetera de clúster, o `null` si no se pudo leer
 * (sin billetera, sin despliegue de `ClusterFundsV2` o RPC caído). Quien llama decide
 * qué hacer con `null`: se prefiere no bloquear el cambio cuando no hay dato, pero se
 * informa `fundsUnchecked` para que quede constancia.
 */
export async function readClusterFunds(
  deps: { backend: { getPublicClient: () => any } },
  wallet: string | null | undefined,
): Promise<ClusterFundsBalance | null> {
  if (!wallet) return null
  try {
    const publicClient = deps.backend.getPublicClient()
    const address = await getClusterFundsAddress()
    const result = (await publicClient.readContract({
      address,
      abi: ClusterFundsV2Abi as any,
      functionName: 'getClusterFunds',
      args: [wallet],
    })) as [bigint, bigint, boolean, boolean]
    return {
      usdt: BigInt(result[0] ?? 0n),
      slearn: BigInt(result[1] ?? 0n),
      exists: Boolean(result[2]),
      verified: Boolean(result[3]),
    }
  } catch (error) {
    console.error(
      '[gd] could not read the cluster funds before changing the wallet:',
      error instanceof Error ? error.message : String(error),
    )
    return null
  }
}

/**
 * Saldo del fondo del **país** (`getCountryFunds(alfa2)`), o `null` si no se pudo leer.
 * Es el pozo del que se reparte entre los clústeres presentados cuando GD responde.
 */
export async function readCountryFunds(
  deps: { backend: { getPublicClient: () => any } },
  countryCode: string | null | undefined,
): Promise<CountryFundsBalance | null> {
  if (!countryCode) return null
  try {
    const publicClient = deps.backend.getPublicClient()
    const address = await getClusterFundsAddress()
    const result = (await publicClient.readContract({
      address,
      abi: ClusterFundsV2Abi as any,
      functionName: 'getCountryFunds',
      args: [countryCode],
    })) as [bigint, bigint, boolean]
    return {
      usdt: BigInt(result[0] ?? 0n),
      slearn: BigInt(result[1] ?? 0n),
      exists: Boolean(result[2]),
    }
  } catch (error) {
    console.error(
      '[gd] could not read the country funds:',
      error instanceof Error ? error.message : String(error),
    )
    return null
  }
}

/**
 * Donaciones registradas a la billetera del clúster (`transaction.subcategoria = 'cluster'`):
 * las directas y el 10 % ruteado de compras y becas (`cluster_contribution` se acredita
 * completo; el resto aporta el 80 %). Es el indicador de lo que el clúster ha levantado.
 */
export async function readClusterDonations(
  db: any,
  wallet: string | null | undefined,
): Promise<ClusterDonations> {
  if (!wallet) return { count: 0, usdt_total: 0, slearn_total: 0 }
  const rows = await sql<{ count: number; usdt_total: number; slearn_total: number }>`
    SELECT
      COUNT(*)::int AS count,
      COALESCE(SUM(
        CASE WHEN t.crypto = 'usdt' THEN
          CASE WHEN t.type = 'cluster_contribution' OR t.hash LIKE '%-fund' THEN t.amount ELSE t.amount * 0.8 END
        ELSE 0 END), 0)::float AS usdt_total,
      COALESCE(SUM(
        CASE WHEN t.crypto = 'slearn' THEN
          CASE WHEN t.type = 'cluster_contribution' OR t.hash LIKE '%-fund' THEN t.amount ELSE t.amount * 0.8 END
        ELSE 0 END), 0)::float AS slearn_total
    FROM transaction t
    WHERE t.subcategoria = 'cluster'
      AND t.type IN ('donation', 'cluster_contribution')
      AND lower(t.metadata->>'clusterWallet') = lower(${wallet})
  `.execute(db)
  const row = rows.rows[0]
  return {
    count: Number(row?.count ?? 0),
    usdt_total: Number(row?.usdt_total ?? 0),
    slearn_total: Number(row?.slearn_total ?? 0),
  }
}

/**
 * Marca el clúster como verificado en el contrato (`setClusterVerification`).
 * "Presentada = verificada" (decisión del operador, 2026-10-22): se llama cuando pdJ
 * presenta el clúster a Global Disciples (`sent`) y cuando cambia la billetera de un
 * clúster ya presentado (el flag del contrato está indexado por la dirección).
 * Con `verified = false` lo saca del conjunto: se usa cuando GD ya respondió y el fondo
 * se liberó, para que un reparto posterior del fondo del país no lo vuelva a incluir.
 */
export async function setClusterVerified(
  deps: { backend: { getPublicClient: () => any; getWalletClient: () => any; sendTxAndWait: (walletClient: any, publicClient: any, args: any) => Promise<`0x${string}`> } },
  wallet: string,
  verified = true,
): Promise<`0x${string}`> {
  const publicClient = deps.backend.getPublicClient()
  const walletClient = deps.backend.getWalletClient()
  const account = walletClient.account
  const address = await getClusterFundsAddress()
  const nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' })
  return deps.backend.sendTxAndWait(walletClient, publicClient, {
    address,
    abi: ClusterFundsV2Abi as any,
    functionName: 'setClusterVerification',
    args: [wallet, verified],
    account,
    chain: publicClient.chain,
    nonce,
  })
}

export function hasFunds(balance: ClusterFundsBalance | null): boolean {
  return !!balance && (balance.usdt > 0n || balance.slearn > 0n)
}

export function summarizeFunds(
  balance: ClusterFundsBalance,
  usdtDecimals = 6,
  slearnDecimals = 2,
): ClusterFundsSummary {
  return {
    usdt: formatUnits(balance.usdt, usdtDecimals),
    slearn: formatUnits(balance.slearn, slearnDecimals),
  }
}
