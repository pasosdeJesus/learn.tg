# @learn-tg/gdcluster — Global Disciples Engine

> "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)

The **Global Disciples engine** implements the GD program: cluster and country
funds, donations, rankings, church search, pastor invitations, and the
cluster/country routing of rewards from the `rewards` engine. It is a Web3
engine (https://gitlab.com/pasosdeJesus/m/-/work_items/35, Fase 3; https://github.com/pasosdeJesus/learn.tg/issues/214 for ClusterFundsV2) with its own isolated
Hardhat subproject for the `ClusterFunds` contracts. Design decisions and
flows in [ARCHITECTURE.md](ARCHITECTURE.md).

## What it provides

| Capability | Handlers | Description |
|------------|----------|-------------|
| Cluster funds | `gdcluster/ranking/clusters`, `gdcluster/ranking/countries`, `gdcluster/ranking/funds` (GET) | Public leaderboards of cluster/country funds with USDT/SLEARN balances |
| GD donations | `gdcluster/donations/verify` (POST), `gdcluster/donations/history` (GET) | Verify USDT/SLEARN transfer receipt and credit the cluster/country fund; donation history |
| Clusters | `cluster` (POST), `cluster/join` (POST), `cluster/[id]` (GET, PATCH), `cluster/[id]/leave` (POST) | Cluster lifecycle: pastor-only creation (pilot CO/SL, must own GD course), join by 6-char code, detail/rename, leave |
| Invitations | `cluster/status`, `cluster/candidates`, `cluster/invitations` (GET), `cluster/invitation/accept`, `cluster/invitation/reject` (POST) | https://github.com/pasosdeJesus/learn.tg/issues/220: pastor cluster state, candidates from the referral graph (https://github.com/pasosdeJesus/learn.tg/issues/163), accept/reject invitations |
| Admin | `admin/clusters` (GET, POST), `admin/clusters/[id]` (GET, PUT, DELETE), `admin/clusters/[id]/members` (POST, DELETE) | Verifier/admin CRUD over `clustergd` / `church_clustergd` |
| Churches | `churches/search` (GET) | Search churches by query parameter `q` |

## Usage

The engine is instantiated once by the host adapter
(`apps/nextjs/lib/gdcluster-app.ts`) with injected dependencies, and the
server process registers its hook side-effect via `import
'@learn-tg/gdcluster/register'`:

```typescript
import { createGdclusterApp } from '@learn-tg/gdcluster'

const gdclusterApp = createGdclusterApp({
  db, authenticateUser, authenticateAdmin, metrics, useAuthAddress, ... // GdclusterDeps
})

export async function GET(req: Request) {
  return gdclusterApp['gdcluster/ranking/clusters'].GET(req)
}
```

## Exports

| Export | Content |
|--------|---------|
| `.` (`dist/index.js`) | `createGdclusterApp(deps)` factory (18 route entries), interfaces, re-exports of `lib/*` |
| `./register` | Registers the `reward:route-destination` hook (side-effect import) |
| `./lib/*` | `gd-utils`, `gd-cluster-routing`, `donation-target` |
| `./components/*` | Client components (`ClusterPage`, `RankingClient`, `GdPastoresLanding`, `ReferralsPage`, `CountryFilter`, `CountryFlag`) |

## Route index (`createGdclusterApp`)

| Route key | Methods |
|-----------|---------|
| `gdcluster/ranking/clusters` | GET |
| `gdcluster/ranking/countries` | GET |
| `gdcluster/ranking/funds` | GET |
| `gdcluster/donations/verify` | POST |
| `gdcluster/donations/history` | GET |
| `cluster` | POST |
| `cluster/join` | POST |
| `cluster/[id]` | GET, PATCH |
| `cluster/[id]/leave` | POST |
| `cluster/status` | GET |
| `cluster/candidates` | GET |
| `cluster/invitations` | GET |
| `cluster/invitation/accept` | POST |
| `cluster/invitation/reject` | POST |
| `admin/clusters` | GET, POST |
| `admin/clusters/[id]` | GET, PUT, DELETE |
| `admin/clusters/[id]/members` | POST, DELETE |
| `churches/search` | GET |

## Library modules (`src/lib/`)

| Module | Purpose |
|--------|---------|
| `gd-utils.ts` | `PILOT_COUNTRIES` (170 Colombia, 694 Sierra Leone); cluster code generation; DB helpers (`getPastorChurch`, `getChurchCluster`, `getClusterMembers`, `getClusterHistory`, `getClusterCandidates` from the `referralrelationship` graph) |
| `gd-cluster-routing.ts` | `isGDCourse` (courses 10/11), `resolveGDClusterDestination` (cluster wallet → country → Sierra Leone fallback), `routeToClusterFunds` (sends the 10% split to `ClusterFundsV2`, 100% net) |
| `donation-target.ts` | `PaymentTarget` types (course/cluster/country), `getDistributionBreakdown`, `getTargetCopy`, `getTargetRecipient`, `getTargetEndpoint` (UI copy + split display) |

## Components (`src/components/`, all client)

| Component | Purpose |
|-----------|---------|
| `ClusterPage` | Cluster detail: members, rename, join code, leave, history |
| `RankingClient` | Clusters/Countries leaderboard tabs with USDT/SLEARN fund columns |
| `GdPastoresLanding` | Pastor landing: score rules, verification status, eligibility |
| `ReferralsPage` | Referral wallet balance, my code, stats, history (consumes **core** APIs `/api/referrals/fund`, `/api/referral/code\|stats\|history`) |
| `CountryFilter` | Country select filter (shadcn) |
| `CountryFlag` | ISO alpha-2 → flag emoji with tooltip |

Components receive their data via **host-injected dependencies** (e.g.
`useAuthAddress`, `useSession`, `getCsrfToken`, `Button`) — no hardcoded
imports of core modules.

## Contracts subproject (`contracts/`)

Isolated Hardhat project `@learn-tg/gdcluster-contracts`:

| Contract | Purpose |
|----------|---------|
| `ClusterFunds.sol` | USDT+SLEARN donations to cluster/country funds; configurable fee wallets + donor cashback (default 10/10/80), Ownable/ReentrancyGuard/Pausable |
| `ClusterFundsV2.sol` | Adds `processClusterContribution`/`processCountryContribution` crediting the **full** amount (no fees/cashback) for routed GD premium payments; doubles as migration entry point (https://github.com/pasosdeJesus/learn.tg/issues/214 — the app operates on V2) |
| `SLEARN.sol` | 2-decimal utility token (MINTER_ROLE auto-authorized), `mintAndReserve`, 3-tier reserve |
| `_usdt_mock.sol` | MockUSDT (6 decimals), synced from the usdt engine |

Deploy/verify scripts in `contracts/scripts/`, deployments written to
`contracts/deployments/<Contract>/<network>.json`. Tests (chai + hardhat-ethers)
in `contracts/test/ClusterFunds.test.ts` (7 tests), run via `run-tests.mjs`
through the `@pasosdejesus/contract-test` runner.

## Testing

```sh
# from apps/nextjs
pnpm --filter @learn-tg/gdcluster test          # engine unit tests (vitest)
bin/m contract:test                             # contract tests (EthereumJS fallback on OpenBSD)
```
