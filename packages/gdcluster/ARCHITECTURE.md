# @learn-tg/gdcluster — Architecture

## Overview

The gdcluster engine implements the **Global Disciples (GD)** program on top of
the platform: pastors form **clusters** (and belong to a **country**), clusters
receive donations, and a share of every GD donation/premium payment is routed
to the cluster or country fund on `ClusterFundsV2`. It follows the engine
design from the `m` repo (https://gitlab.com/pasosdeJesus/m/-/work_items/35) and adds a notable inversion: instead of the
core dispatching to the engine, the **engine registers a hook** that the core
dispatches through.

## Design decisions

### D1 — Hook registration (`reward:route-destination`)

`src/register.ts` registers the `reward:route-destination` hook via
`@pasosdejesus/m/plugin`. The core (`apps/nextjs/lib/reward-routing.ts`) runs
all registered hooks with `runHooks` before processing a reward; the gdcluster
handler checks `isGDCourse(courseId)` (courses 10/11) and, if matched, sets:

```
ctx.destino       → resolved cluster/country fund (or Sierra Leone fallback)
ctx.gdUsdtAmount  → 10% of the payment
ctx.gdSlearnAmount→ 10% of the payment
ctx.gdAddr        → ClusterFundsV2 address
```

The rewards engine then routes that 10% **before** the vault split (100% net,
no fees — V2 behavior). This keeps the routing rules inside the engine that
owns the domain while the core stays a generic dispatcher.

### D2 — Dependency injection

`createGdclusterApp(deps)` receives DB, `authenticateUser`,
`authenticateAdmin`, metrics, and the frontend dependencies for components
(`useAuthAddress`, `useSession`, `getCsrfToken`, `Button`, ...). Components are
stateless presentational + data-fetching units; the host provides the
framework bindings.

### D3 — Owned contracts subproject

Unlike `rewards` (which consumes contracts from `apps/hardhat`), gdcluster
ships its own isolated Hardhat project under `contracts/` with `ClusterFunds`
and `ClusterFundsV2`. This was chosen so the cluster-fund domain can evolve
independently (https://github.com/pasosdeJesus/learn.tg/issues/214) without touching the main hardhat app; ABI sync and
deployment JSONs live with the package.

## Data flow

### Cluster lifecycle

1. **Create**: a pastor (pilot countries CO/SL, must own the GD course) creates
   a cluster → unique 6-char code generated, rows in `clustergd` +
   `church_clustergd`.
2. **Join**: another user joins with the code (`cluster/join`).
3. **Invitations (https://github.com/pasosdeJesus/learn.tg/issues/220)**: `cluster/candidates` proposes pastors from the
   user's **referral graph** (`referralrelationship`, https://github.com/pasosdeJesus/learn.tg/issues/163) — referred
   pastors first, then the referrer. Invitations can be accepted or rejected;
   state via `cluster/status`.
4. **Admin**: verifiers can list/create/update/disband clusters and add/remove
   members (`admin/clusters/*`, auth via injected `authenticateAdmin`).

### Donations to funds

1. User transfers USDT/SLEARN to the backend wallet.
2. `gdcluster/donations/verify` verifies the ERC-20 transfer receipt
   (`verifyTransfer` from the rewards lib), checks replay protection, and
   credits the cluster/country fund.
3. The distribution breakdown (70% vault / 10% SLEARN reward / 5% pdJ /
   5% missional / 5% UBI+referrals / 5% churches) is computed by
   `donation-target.ts` and mirrored in `ClusterFunds` fees + cashback.

### Reward routing (hook)

```
rewards engine (add-donation / premium-purchase)
  → deps.routeReward(ctx)                      [core: lib/reward-routing.ts]
  → runHooks('reward:route-destination', ctx)  [gdcluster handler registered]
  → isGDCourse? → resolve destination (cluster wallet → country → SL)
  → 10% routed to ClusterFundsV2 (100% net)
  → remaining split to course vault / pdJ / etc.
```

## Contracts

| Contract | Role in flow |
|----------|--------------|
| `ClusterFunds` | Direct donations with configurable fee wallets + donor cashback (default 10/10/80) |
| `ClusterFundsV2` | Routed GD contributions credited **in full** (no fees/cashback); migration target (https://github.com/pasosdeJesus/learn.tg/issues/214) |

Deployments are read from `contracts/deployments/<Contract>/<network>.json`
via `@pasosdejesus/m/blockchain/deployments` (`readDeployment`) — never `.env`.

## Database

The engine declares `db/migrations` in `engine.json` but the directory is
**empty**: the schema (`clustergd`, `church_clustergd`, plus `referralcode` /
`referralrelationship` for the referral graph) is owned by the core and the
Rails backend. The engine only reads/writes through the injected `db`.

## Relationship with other engines

| Engine | Relation |
|--------|----------|
| `@learn-tg/rewards` | registers the hook that rewards **consumes**; uses rewards' `verifyTransfer`/replay-protection libs |
| `@learn-tg/mr519` | `engine.json` declares a requirement; no hard coupling at runtime |
| core (apps/nextjs) | adapter `lib/gdcluster-app.ts`, dispatcher `lib/reward-routing.ts`, `import '@learn-tg/gdcluster/register'` in the server process |

## Build & test

```sh
# engine (from apps/nextjs)
pnpm --filter @learn-tg/gdcluster test

# contracts (EthereumJS fallback on OpenBSD/adJ)
cd apps/nextjs && bin/m contract:test
```
