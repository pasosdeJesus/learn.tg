'use client'

// Diagnóstico del flujo de gas. Copia local del hook compartido
// @pasosdejesus/usdt/hooks/useGasEstimation (mismo comportamiento: mismos
// inputs, mismo gasState/estimating) + recolección de diagnóstico detallado
// (chainId de la app y de la wallet, celoBalance, gasPrice, gas estimado por
// token, coste total, errores) para depurar el panel "Se necesita CELO" en el
// sitio de desarrollo (https://learn.tg:9001).
//
// Uso: abrir el modal con `?diag=1` en la URL — el panel renderiza los valores
// y el logger escribe `GasDiag ...` en la consola / DebugConsole (?debug=1).
// TODO: subir el diagnóstico al paquete compartido @pasosdejesus/usdt (repo m)
// para que sivel.xyz también lo tenga.

import { useEffect, useState } from 'react'
import { type Address, formatEther } from 'viem'
import { erc20Abi, parseUserAmount, safeParseFloat } from '@learn-tg/rewards/lib/donate-utils'
import { logger } from '@pasosdejesus/m/debug'
import { IS_PRODUCTION } from '@learn-tg/rewards/lib/config'

export type GasState = 'idle' | 'ok' | 'no-gas' | 'warn'

export interface UseGasEstimationOptions {
  amount: string
  slearnAmount: string
  usdtDecimals: number
  address: Address | undefined
  walletClient: any
  publicClient: any
  backendWalletAddress: Address | undefined
  usdtAddress: Address | undefined
  slearnAddress: Address | undefined
  courseId: number | null
  celoBalance: bigint
}

export interface GasDiagnostics {
  state: GasState
  hasUsdt: boolean
  hasSlearn: boolean
  address?: string
  appChainId?: number
  walletChainId?: string
  rpcUrl?: string
  backendWalletAddress?: string
  usdtAddress?: string
  slearnAddress?: string
  celoBalanceRaw?: string
  celoBalanceCELO?: string
  gasPriceWei?: string
  gasPriceGwei?: string
  usdtTransferGas?: string
  slearnTransferGas?: string
  totalGas?: string
  estimatedCostCELO?: string
  sufficient?: boolean
  error?: string
  fallbackNoGas?: boolean
  reason?: string
  timestamp: string
}

const APP_CHAIN_ID = IS_PRODUCTION ? 42220 : 11142220

function logDiag(d: GasDiagnostics) {
  const parts = [
    `state=${d.state}`,
    `addr=${d.address}`,
    `appChain=${d.appChainId}`,
    `walletChain=${d.walletChainId ?? '?'}`,
    `celo=${d.celoBalanceCELO ?? '?'}`,
    `gasPrice=${d.gasPriceGwei ?? '?'}gwei`,
    `usdtGas=${d.usdtTransferGas ?? '-'}`,
    `slearnGas=${d.slearnTransferGas ?? '-'}`,
    `totalGas=${d.totalGas ?? '-'}`,
    `cost=${d.estimatedCostCELO ?? '?'}CELO`,
    `sufficient=${d.sufficient ?? '?'}`,
  ]
  if (d.error) parts.push(`err=${d.error}`)
  if (d.reason) parts.push(`reason=${d.reason}`)
  if (d.fallbackNoGas) parts.push('fallbackNoGas')
  logger.info(parts.join(' '), 'GasDiag')
}

export function useGasEstimation({
  amount,
  slearnAmount,
  usdtDecimals,
  address,
  walletClient,
  publicClient,
  backendWalletAddress,
  usdtAddress,
  slearnAddress,
  courseId,
  celoBalance,
}: UseGasEstimationOptions) {
  const [gasState, setGasState] = useState<GasState>('idle')
  const [estimating, setEstimating] = useState(false)
  const [diag, setDiag] = useState<GasDiagnostics | null>(null)

  useEffect(() => {
    const estimate = async () => {
      const hasUsdt = amount && safeParseFloat(amount) > 0
      const hasSlearn = slearnAmount && safeParseFloat(slearnAmount) > 0
      const base: GasDiagnostics = {
        state: 'idle',
        hasUsdt: !!hasUsdt,
        hasSlearn: !!hasSlearn,
        address,
        appChainId: APP_CHAIN_ID,
        rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || undefined,
        backendWalletAddress,
        usdtAddress,
        slearnAddress,
        timestamp: new Date().toISOString(),
      }
      if (!hasUsdt && !hasSlearn) {
        const d = { ...base, state: 'idle' as GasState }
        setDiag(d); logDiag(d); setGasState('idle'); return
      }
      if (!address || !walletClient || !publicClient || !backendWalletAddress) {
        const d: GasDiagnostics = {
          ...base,
          state: 'no-gas',
          reason: !address ? 'no-address'
            : !walletClient ? 'no-wallet-client'
              : !publicClient ? 'no-public-client' : 'no-backend-wallet',
        }
        setDiag(d); logDiag(d); setGasState('no-gas'); return
      }
      try {
        let walletChainId: string | undefined
        try { walletChainId = String(await walletClient.getChainId()) } catch { /* provider may not implement it */ }

        setEstimating(true)
        const gasPrice = await publicClient.getGasPrice()
        let totalGas = 0n
        let usdtTransferGas: bigint | undefined
        let slearnTransferGas: bigint | undefined

        if (hasUsdt && usdtAddress) {
          const value = parseUserAmount(amount, usdtDecimals)
          if (value > 0n) {
            const g = await publicClient.estimateContractGas({
              address: usdtAddress, abi: erc20Abi, functionName: 'transfer',
              account: address, args: [backendWalletAddress, value],
            })
            usdtTransferGas = g
            totalGas += g
          }
        }

        if (hasSlearn && slearnAddress) {
          const value = parseUserAmount(slearnAmount, 2)
          if (value > 0n) {
            const g = await publicClient.estimateContractGas({
              address: slearnAddress, abi: erc20Abi, functionName: 'transfer',
              account: address, args: [backendWalletAddress, value],
            })
            slearnTransferGas = g
            totalGas += g
          }
        }

        const d: GasDiagnostics = {
          ...base,
          state: 'idle',
          walletChainId,
          celoBalanceRaw: celoBalance.toString(),
          celoBalanceCELO: formatEther(celoBalance),
          gasPriceWei: gasPrice.toString(),
          gasPriceGwei: (Number(gasPrice) / 1e9).toFixed(2),
          usdtTransferGas: usdtTransferGas?.toString(),
          slearnTransferGas: slearnTransferGas?.toString(),
          totalGas: totalGas.toString(),
          estimatedCostCELO: formatEther(totalGas * gasPrice),
          sufficient: celoBalance > totalGas * gasPrice,
        }
        if (totalGas === 0n) {
          setDiag(d); logDiag(d); setGasState('idle'); return
        }
        d.state = celoBalance > totalGas * gasPrice ? 'ok' : 'no-gas'
        setDiag(d); logDiag(d); setGasState(d.state)
      } catch (e: any) {
        const fallbackNoGas = celoBalance < (1n << 50n)
        const d: GasDiagnostics = {
          ...base,
          state: fallbackNoGas ? 'no-gas' : 'warn',
          celoBalanceRaw: celoBalance.toString(),
          celoBalanceCELO: formatEther(celoBalance),
          error: e?.message ? String(e.message) : String(e),
          fallbackNoGas,
        }
        setDiag(d); logDiag(d); setGasState(d.state)
      } finally { setEstimating(false) }
    }
    estimate()
  }, [amount, slearnAmount, address, walletClient, publicClient, backendWalletAddress, usdtAddress, slearnAddress, courseId, celoBalance, usdtDecimals])

  return { gasState, estimating, diag }
}
