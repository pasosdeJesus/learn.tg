import type { NextRequest } from 'next/server'
import type { Kysely } from 'kysely'
import type { Address } from 'viem'

import { credentialByTokenId, credentialByWallet } from './routes/credential'
import { ubiReport, ubiReportWallet } from './routes/ubi'
import { slearnMetadata, churchesFund, referralsFund } from './routes/funds'
import { claimCeloUbi } from './routes/claim-celo-ubi'
import { scholarshipStatus } from './routes/scholarship'
import { addDonation } from './routes/add-donation'
import { premiumPurchase } from './routes/premium-purchase'
import { checkCrosswordGet, checkCrosswordPost } from './routes/check-crossword'

export interface AuthUser {
  usuario: any
  billetera: any
}

/**
 * Contexto del hook `reward:route-destination` (REQ/35 §5.4).
 *
 * El motor construye el ctx y llama `deps.routeReward(ctx)` (que ejecuta el
 * hook registrado por el core/GD). Si un curso es GD, el hook setea `destino`
 * y los montos del split (10%); si no, `destino` queda undefined y la
 * recompensa va al vault por defecto.
 */
export interface RewardRouteCtx {
  db: any
  usuarioId: number
  courseId: number
  usdtAmount: bigint
  slearnAmount: bigint
  destino?: string
  gdUsdtAmount?: bigint
  gdSlearnAmount?: bigint
  gdAddr?: `0x${string}`
}

/**
 * Funciones del `backend-config` del core (REQ/35 §5.2 — backend-config NO se
 * mueve al motor). El host las inyecta vía deps (D2): el motor nunca importa
 * `@/lib/backend-config`.
 */
export interface RewardsBackendDeps {
  getPublicClient: () => any
  getWalletClient: () => any
  getBackendWallet: () => Address | undefined
  getUsdtAddress: () => Promise<Address | undefined>
  getUsdtDecimals: () => number
  getChain: () => any
  sendTxAndWait: (walletClient: any, publicClient: any, args: any) => Promise<`0x${string}`>
  fetchTxWithReceipt: (hash: `0x${string}`, timeoutMs?: number) => Promise<{ receipt: any; tx: any }>
  MAX_TX_AGE: number
  SLEARN_RATE: number
  SLEARN_DECIMALS: number
}

export interface RewardsDeps {
  db: () => Kysely<any>
  authenticateUser: (
    db: Kysely<any>,
    wallet?: string,
    token?: string,
  ) => Promise<AuthUser | null>
  recordEvent: (ev: any) => Promise<void>
  backend: RewardsBackendDeps
  // Hook `reward:route-destination` (§5.4): el host lo implementa con
  // `runHooks('reward:route-destination', ctx)`; el motor no conoce GD.
  routeReward: (ctx: RewardRouteCtx) => Promise<void>
  // `routeToClusterFunds` sigue inyectada (lógica de ClusterFunds del GD
  // engine en Fase 3); el motor la ejecuta con el destino que resolvió el hook.
  routeToClusterFunds: (
    publicClient: any,
    walletClient: any,
    account: any,
    replayTx: `0x${string}`,
    destino: any,
    clusterUSDT: bigint,
    clusterSlearn: bigint,
    usdtAddress: `0x${string}`,
    slearnAddress: `0x${string}`,
  ) => Promise<any>
  canPurchasePremiumCourse: (db: any, usuarioId: number, courseId: number) => Promise<{ access: boolean; reason?: string }>
  updateUserAndCoursePoints: (db: any, usuario: any, courseId: number, walletAddress: string, guideUsuario?: any) => Promise<number>
  // … más deps del core que rewards consume, se agregan conforme se portan rutas
}

export interface RouteHandlers {
  GET?: (req?: Request, params?: Record<string, string>) => Promise<Response>
  POST?: (req?: Request, params?: Record<string, string>) => Promise<Response>
  PUT?: (req?: Request, params?: Record<string, string>) => Promise<Response>
  PATCH?: (req?: Request, params?: Record<string, string>) => Promise<Response>
}

/**
 * Factoría del motor `rewards` (REQ/35 §11.2 D2).
 *
 * El motor no importa alias internos de la app (`@/`, `@/.config`): recibe sus
 * dependencias (DB, auth, métricas) inyectadas desde el host. Cada ruta se
 * registra como `{ 'ruta': { GET/POST: (req, params) => … } }`.
 */
export function createRewardsApp(deps: RewardsDeps): Record<string, RouteHandlers> {
  return {
    'credential/[tokenId]': {
      GET: (req, params) => credentialByTokenId(deps, req as NextRequest, params!),
    },
    'credential/wallet/[wallet]': {
      GET: (req, params) => credentialByWallet(deps, req as NextRequest, params!),
    },
    'ubi-report': {
      GET: () => ubiReport(deps),
    },
    'ubi-report-wallet': {
      GET: (req) => ubiReportWallet(deps, req as Request),
    },
    'slearn/metadata': {
      GET: () => slearnMetadata(),
    },
    'churches/fund': {
      GET: () => churchesFund(),
    },
    'referrals/fund': {
      GET: () => referralsFund(),
    },
    'claim-celo-ubi': {
      POST: (req) => claimCeloUbi(deps, req as NextRequest),
    },
    'scholarship': {
      GET: (req) => scholarshipStatus(deps, req as NextRequest),
    },
    'add-donation': {
      POST: (req) => addDonation(deps, req as NextRequest),
    },
    'courses/premium/purchase': {
      POST: (req) => premiumPurchase(deps, req as NextRequest),
    },
    'check-crossword': {
      GET: () => checkCrosswordGet(),
      POST: (req) => checkCrosswordPost(deps, req as NextRequest),
    },
  }
}

// Re-exports de libs del motor para consumidores durante la migración
export * from './lib/premium-pricing'
export * from './lib/sle-rate'
export * from './lib/donate-utils'
export * from './lib/crypto'
export * from './lib/deployments'
export * from './lib/config'
