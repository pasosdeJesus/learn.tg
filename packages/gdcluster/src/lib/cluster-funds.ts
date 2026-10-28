import { formatUnits } from 'viem'
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
