import type { NextRequest } from 'next/server'
import type { Kysely } from 'kysely'

import { rankingClusters, rankingCountries, rankingFunds } from './routes/gd-ranking'
import { verifyDonation, donationHistory, verifyCampaignDonation } from './routes/gd-donations'
import { campaignBalance } from './routes/campaign-balance'
import { campaignTransparency } from './routes/gd-campaign-transparency'
import { createCluster, joinCluster, getCluster, updateCluster, leaveCluster } from './routes/gd-cluster'
import { clusterStatus, clusterCandidates, listInvitations, acceptInvitation, rejectInvitation } from './routes/gd-invitations'
import { adminListClusters, adminGetCluster, adminCreateCluster, adminUpdateCluster, adminDisbandCluster, adminAddMember, adminRemoveMember } from './routes/gd-admin-clusters'
import { searchChurches } from './routes/gd-churches'

export interface AuthUser {
  usuario: any
  billetera: any
}

/**
 * Dependencias del `backend-config` del core (https://gitlab.com/pasosdeJesus/m/-/work_items/35 §5.2 — backend-config NO se
 * mueve al motor). El host las inyecta vía deps (D2): el motor nunca importa
 * `@/lib/backend-config`.
 */
export interface GdclusterBackendDeps {
  getPublicClient: () => any
  getWalletClient: () => any
  getBackendWalletLower: () => string
  sendTxAndWait: (walletClient: any, publicClient: any, args: any) => Promise<`0x${string}`>
  /** Envío de CELO nativo (sendTransaction con value) — donaciones de campaña en CELO (REQ/223) */
  sendNativeTxAndWait?: (walletClient: any, publicClient: any, args: any) => Promise<`0x${string}`>
  fetchTxWithReceipt: (hash: `0x${string}`, timeoutMs?: number) => Promise<{ receipt: any; tx: any }>
  SLEARN_RATE: number
}

export interface GdclusterDeps {
  db: () => Kysely<any>
  authenticateUser: (
    db: Kysely<any>,
    wallet?: string,
    token?: string,
  ) => Promise<AuthUser | null>
  backend: GdclusterBackendDeps
  /** Auth de admin/verificador (inyectada por el host; https://github.com/pasosdeJesus/learn.tg/issues/220 admin) */
  authenticateAdmin?: (
    db: Kysely<any>,
    wallet: string,
    token: string,
  ) => Promise<{ usuario_id: number; billetera: string } | null>
}

export interface RouteHandlers {
  GET?: (req?: Request, params?: Record<string, string>) => Promise<Response>
  POST?: (req?: Request, params?: Record<string, string>) => Promise<Response>
  PUT?: (req?: Request, params?: Record<string, string>) => Promise<Response>
  PATCH?: (req?: Request, params?: Record<string, string>) => Promise<Response>
  DELETE?: (req?: Request, params?: Record<string, string>) => Promise<Response>
}

/**
 * Factoría del motor `gdcluster` (https://gitlab.com/pasosdeJesus/m/-/work_items/35 §12, D2).
 *
 * El motor no importa alias internos de la app (`@/`, `@/.config`): recibe sus
 * dependencias (DB, auth, backend) inyectadas desde el host. Cada ruta se
 * registra como `{ 'ruta': { GET/POST: (req, params) => … } }`, con los
 * segmentos dinámicos `[id]` en la clave (los re-exports del host adaptan params).
 */
export function createGdclusterApp(deps: GdclusterDeps): Record<string, RouteHandlers> {
  return {
    'gdcluster/ranking/clusters': {
      GET: () => rankingClusters(deps),
    },
    'gdcluster/ranking/countries': {
      GET: () => rankingCountries(deps),
    },
    'gdcluster/ranking/funds': {
      GET: () => rankingFunds(deps),
    },
    'gdcluster/donations/verify': {
      POST: (req) => verifyDonation(deps, req as NextRequest),
    },
    'gdcluster/donations/history': {
      GET: (req) => donationHistory(deps, req as NextRequest),
    },
    'donations/[slug]/verify': {
      POST: (req, params) => verifyCampaignDonation(deps, req as NextRequest, params),
    },
    'donations/[slug]/balance': {
      GET: (req, params) => campaignBalance(deps, params),
    },
    'donations/[slug]/transparency': {
      GET: (req, params) => campaignTransparency(deps, params),
    },
    'cluster': {
      POST: (req) => createCluster(deps, req as NextRequest),
    },
    'cluster/join': {
      POST: (req) => joinCluster(deps, req as NextRequest),
    },
    'cluster/[id]': {
      GET: (req, params) => getCluster(deps, req as NextRequest, params!),
      PATCH: (req, params) => updateCluster(deps, req as NextRequest, params!),
    },
    'cluster/[id]/leave': {
      POST: (req, params) => leaveCluster(deps, req as NextRequest, params!),
    },
    'cluster/status': {
      GET: (req) => clusterStatus(deps, req as NextRequest),
    },
    'cluster/candidates': {
      GET: (req) => clusterCandidates(deps, req as NextRequest),
    },
    'cluster/invitations': {
      GET: (req) => listInvitations(deps, req as NextRequest),
    },
    'cluster/invitation/accept': {
      POST: (req) => acceptInvitation(deps, req as NextRequest),
    },
    'cluster/invitation/reject': {
      POST: (req) => rejectInvitation(deps, req as NextRequest),
    },
    'admin/clusters': {
      GET: (req) => adminListClusters(deps, req as NextRequest),
      POST: (req) => adminCreateCluster(deps, req as NextRequest),
    },
    'admin/clusters/[id]': {
      GET: (req, params) => adminGetCluster(deps, req as NextRequest, params!),
      PUT: (req, params) => adminUpdateCluster(deps, req as NextRequest, params!),
      DELETE: (req, params) => adminDisbandCluster(deps, req as NextRequest, params!),
    },
    'admin/clusters/[id]/members': {
      POST: (req, params) => adminAddMember(deps, req as NextRequest, params!),
      DELETE: (req, params) => adminRemoveMember(deps, req as NextRequest, params!),
    },
    'churches/search': {
      GET: (req) => searchChurches(deps, req as NextRequest),
    },
  }
}

// Re-exports de libs del motor para consumidores durante la migración
export * from './lib/gd-utils'
export * from './lib/donation-target'
export * from './lib/gd-cluster-routing'
