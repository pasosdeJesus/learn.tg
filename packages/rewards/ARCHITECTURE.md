# @learn-tg/rewards — Architecture

## Overview

The rewards engine centralizes every **on-chain value movement** of learn.tg
(scholarships, UBI, donations, premium purchases, SBT credentials) in one
package. It follows the engine design from the `m` repo (https://gitlab.com/pasosdeJesus/m/-/work_items/35): self-contained
package, compiled to `dist/` with `tsc`, consumed via `exports` (never
re-transpiled by Next/SWC).

## Design decisions

### D1 — `next` as peer dependency

The engine never imports `next`; it receives plain `Request`/`Response` and
returns route handlers. The host (apps/nextjs) wires them into the App Router.
`next` is a peerDependency so the engine stays testable outside Next.

### D2 — Dependency injection

`createRewardsApp(deps)` receives everything the engine needs from the host:

```typescript
interface RewardsDeps {
  db: Kysely<DB>            // direct DB access (transaction, guide_usuario, ...)
  authenticateUser: ...     // wallet + token → user (core lib/authenticateUser.ts)
  authenticateAdmin: ...    // verifier check (core lib)
  metrics: ...              // server-side event recording
  routeReward: ...          // dispatches the reward:route-destination hook (core lib/reward-routing.ts)
  backendConfig: ...        // contract addresses, split percentages
}
```

The host adapter `apps/nextjs/lib/rewards-app.ts` instantiates the engine once
(singleton) and the app routes re-export its handlers. The engine never
imports core logic — the core injects it (inverted dependencies, D3).

### D3 — Hook consumption (reward routing)

The rewards engine is the **consumer** of the `reward:route-destination` hook:
for courses with a GD cluster/country fund, the `gdcluster` engine (which
registers the hook) routes 10% of a donation/premium payment to the cluster or
country fund before the vault split. The rewards engine calls
`deps.routeReward(ctx)`; it has no knowledge of the routing rules.

## Data flow

### Crossword scholarship (`check-crossword`)

1. Validate user (wallet + token) and the guide's placement (crossword answer
   positions) against `billetera_usuario.answer_fib`.
2. Recompute scores (`guide_usuario.points`, `learningscore`, `profilescore`).
3. On perfect score: determine active vault (`getActiveVault`: V5 → V4),
   call `callWriteFun` on `LearnTGVaultsV5.payScholarship` (student, guide,
   referrer fields — referrer unused for now, https://github.com/pasosdeJesus/learn.tg/issues/163 pays off-chain).
4. Record the payout in the `transaction` table (`type='scholarship'`,
   `crypto='usdt'|'slearn'`).
5. On 100% course completion: `mintCourseCredential` (SBT via
   `PasosDeJesusCredentials`), cached in `credential_emission` /
   `credential_metadata`.

### Donation (`add-donation`)

1. `verifyTransfer` decodes the ERC-20 transfer from the receipt logs.
2. `checkReplayAttack` rejects hash reuse (unique `(crypto, hash)`).
3. `SLEARN.processPayment` splits per `DONATION_PCT`
   (pdJ 5 / reward 10 / missional 5 / ubi+referrals 2+3 / churches 5 / vault 70).
4. GD-destination donations route 10% to the cluster/country fund first
   (hook D3), the rest to the course vault.
5. Donor SLEARN cashback (`donation_reward`) is credited via the split.

### Premium purchase (`courses/premium/purchase`)

1. Price = `calculatePremiumPriceUsdt` (HDI-linear, 2↔5 USDT calibration);
   SLEARN price = 10% discount (`calculatePremiumPriceSlearn`).
2. `SLEARN.processPayment` splits per `PREMIUM_PCT`
   (pdJ 50 / reward 10 / missional 10 / ubi 5 / referral 10 / churches 5 /
   course vault 10).
3. GD courses route 10% to the country fund (hook D3); `referralAddress` is
   recorded so the core can attribute Form-1 referral rewards (https://github.com/pasosdeJesus/learn.tg/issues/163).
4. Records `transaction` entries (`type='pay-course'`).

### UBI claim (`claim-celo-ubi`)

1. Auth + profile score ≥ 50 check.
2. `CeloUbi.claim()` via `callWriteFun` (cooldown enforced on-chain).
3. Records `transaction` (`type='ubi-claim'`, `crypto='celo'`).

### Credentials (SBT)

- `mintCourseCredential`: off-chain cache write, on-chain dedupe
  (`hasCredentialOnChain`), mint with Celo L2 nonce retry, receipt confirmation.
- Public read routes serve ERC-1155 metadata by tokenId or wallet.

## Reliability patterns

| Concern | Mechanism |
|---------|-----------|
| Nonce exhaustion on Celo L2 | `callWriteFun` retries from a pending nonce pool |
| Replay attacks | `checkReplayAttack` + unique `(crypto, hash)` on `transaction` |
| Vault rotation | `getActiveVault` falls back V5 → V4; legacy V3 via env only |
| Receipts | `waitForReceiptWithRetry` with configurable retries/backoff |
| Split drift | percentages are single-source constants (`DONATION_PCT`, `PREMIUM_PCT`) |

## Address resolution

- Vaults: `apps/hardhat/deployments/LearnTGVaults/V{4,5}/<network>.json`
  (`getV4Address`/`getV5Address`).
- SLEARN: `@pasosdejesus/mpdj/blockchain/ecosystem-addresses` first, then
  `SLEARN/<network>.json`.
- CeloUbi: env `NEXT_PUBLIC_CELOUBI_ADDRESS`.
- Credentials: `PasosDeJesusCredentials/<network>.json` (from the sivel3
  ecosystem tooling), env fallback `NEXT_PUBLIC_PDJCREDENTIALS_CELO_ADDRESS`.

Never add `NEXT_PUBLIC_*_ADDRESS` env vars for derived deployment addresses.

## Relationship with other engines

| Engine | Relation |
|--------|----------|
| `@learn-tg/gdcluster` | gdcluster **registers** `reward:route-destination`; rewards **consumes** it via `deps.routeReward` |
| `@learn-tg/mr519` | none (forms engine) |
| `@pasosdejesus/usdt` (m) | source of `donate-utils` (graduated local→shared) |

## Build & test

```sh
# compile to dist/ (done by bin/dev and make all/prod)
tsc -p tsconfig.json

# tests (from apps/nextjs)
pnpm --filter @learn-tg/rewards test
```
