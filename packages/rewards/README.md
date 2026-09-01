# @learn-tg/rewards — On-Chain Rewards Engine

> "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)

The **rewards engine** implements learn.tg's on-chain reward logic: crossword
scholarships, CELO UBI claims, donations, premium course purchases, credentials
(SBTs), and on-chain balance reporting. It is a Web3 engine (REQ/35, Fase 2):
a self-contained TypeScript package compiled to `dist/` and consumed by the
Next.js app through its `exports` map. See the design decisions in
[ARCHITECTURE.md](ARCHITECTURE.md) and the general engine guide in the `m`
repo (`doc/engines.md`).

## What it provides

| Capability | Handlers | Description |
|------------|----------|-------------|
| Scholarship | `check-crossword` (GET/POST), `scholarship` (GET) | Crossword validation against `answer_fib`, profile-score-based payout via `LearnTGVaultsV5`, active vault status |
| UBI claim | `claim-celo-ubi` (POST) | Periodic CELO Universal Basic Income claims via `CeloUbi.sol` |
| Donation | `add-donation` (POST) | USDT/SLEARN donations to courses/clusters/countries with on-chain split (`DONATION_PCT`) |
| Premium course | `courses/premium/purchase` (POST) | HDI-based premium pricing, 10% SLEARN discount, `processPayment` split (`PREMIUM_PCT`), GD course routing |
| Credentials | `credential/[tokenId]` (GET), `credential/wallet/[wallet]` (GET) | Public ERC-1155 SBT metadata lookup |
| Reports | `ubi-report` (GET), `ubi-report-wallet` (GET) | UBI totals per wallet (excludes 5 internal wallets) |
| Funds | `slearn/metadata` (GET), `churches/fund` (GET), `referrals/fund` (GET) | On-chain balances: SLEARN metadata, churches fund, referral wallet fund |

## Usage

The engine is instantiated once by the host adapter (`apps/nextjs/lib/rewards-app.ts`)
with injected dependencies (DB, auth, metrics, backend-config), then app routes
are thin re-exports:

```typescript
import { createRewardsApp } from '@learn-tg/rewards'

const rewardsApp = createRewardsApp({
  db, authenticateUser, metrics, ... // RewardsDeps — see ARCHITECTURE.md
})

// In a Next.js route:
export async function POST(req: Request) {
  return rewardsApp['check-crossword'].POST(req)
}
```

## Exports

| Export | Content |
|--------|---------|
| `.` (`dist/index.js`) | `createRewardsApp(deps)` factory (13 route entries), interfaces (`AuthUser`, `RewardsDeps`, ...), re-exports of `lib/*` |
| `./lib/*` | Individual lib modules (`crypto`, `deployments`, `credentials`, `premium-pricing`, ...) |

## Route index (`createRewardsApp`)

| Route key | Methods |
|-----------|---------|
| `credential/[tokenId]` | GET |
| `credential/wallet/[wallet]` | GET |
| `ubi-report` | GET |
| `ubi-report-wallet` | GET |
| `slearn/metadata` | GET |
| `churches/fund` | GET |
| `referrals/fund` | GET |
| `claim-celo-ubi` | POST |
| `scholarship` | GET |
| `add-donation` | POST |
| `courses/premium/purchase` | POST |
| `check-crossword` | GET, POST |

## Library modules (`src/lib/`)

| Module | Purpose |
|--------|---------|
| `crypto.ts` | `waitForReceiptWithRetry`, `callWriteFun` (contract writes with nonce retry from a pending pool) |
| `deployments.ts` | `getV2/V3/V4/V5/SlearnAddress`, `getActiveVault` (V5 → V4 fallback) from hardhat deployment JSONs |
| `credentials.ts` | `mintCourseCredential` — SBT mint wrapper (off-chain cache, on-chain dedupe, Celo L2 nonce retry) |
| `config.ts` | `IS_PRODUCTION` (from `NEXT_PUBLIC_AUTH_URL`) |
| `donate-utils.ts` | Re-export of `@pasosdejesus/usdt/lib/donate-utils` (first local→shared graduation) |
| `pastor-bonus.ts` | `isEligiblePastor` (pastor, CO/SL, score > 90) + `awardPastorBonus` (44 SLEARN) |
| `premium-pricing.ts` | `calculatePremiumPriceUsdt` (HDI-linear, 2↔5 USDT calibration), `calculatePremiumPriceSlearn` (10% discount) |
| `replay-protection.ts` | `checkReplayAttack` (hash reuse in `transaction`), `getBlockWithRetry` |
| `sle-rate.ts` | `getSLEUSDRate` (currently hardcoded 22; TODO: live rate from stable-sl.pdj.app) |
| `verify-transfer.ts` | `verifyTransfer` + `erc20TransferAbi` (decode ERC-20 transfer from receipt logs) |

## Contracts used

`LearnTGVaultsV5` (scholarships, active), `CeloUbi` (UBI), `SLEARN`
(`processPayment` for donations/premium), `PasosDeJesusCredentials` (SBTs, via
`@pasosdejesus/mpdj/blockchain`). Addresses come from
`apps/hardhat/deployments/<Contract>/<network>.json` (never `.env`).

## Testing

```sh
# from apps/nextjs
pnpm --filter @learn-tg/rewards test
```

Tests live in `src/**/__tests__/` (vitest, deps mocked). See the `m` repo
`doc/engines.md` for the engine testing guide.
