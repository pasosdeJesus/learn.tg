# Learn.tg — Smart Contracts

Solidity contracts for the Learn.tg platform, managed with Hardhat.
Deployed on Celo.

## Contracts

| Contract | File | Purpose |
|---|---|---|
| **SLEARN** | `SLEARN.sol` | ERC-20 utility token, mixed payments, 3-tier reserve backing |
| **LearnTGVaultsV5** | `LearnTGVaultsV5.sol` | Active — scholarship vaults (USDT + SLEARN), flexible split (referrer + learnTg), `guideId` = `actividadpf_id` |
| **LearnTGVaultsV6** | `next/LearnTGVaultsV6.sol` | Next, **not deployed** — same interface as V5 plus self-enforcing accounting: `totalRecordedUsdt/Slearn` never above the tokens held, `retireCourse`, float-only emergency withdrawals, `forceEmergencyWithdraw*` + `accountingBroken`, `accountingState()` (`doc/LearnTGVaultsV6.md`, R-#221) |
| **LearnTGVaultsV4** | `LearnTGVaultsV4.sol` | Legacy V4 — partial payments, being migrated to V5 |
| **CeloUbi** | `CeloUbi.sol` | Universal Basic Income claims in CELO |
| **ClusterFunds** | `ClusterFunds.sol` | Cluster/country fund management — USDT + SLEARN donations, GD contact release |
| **MockUSDT** | `MockUSDT.sol` | Mock USDT for testnet |

## Prerequisites

- Node.js >= 18
- pnpm
- Celo wallet with funds (CELO for gas)

## Setup

Environment is configured via the shared `apps/.env` (see `apps/.env.example`).
The Hardhat config loads it automatically.

```sh
cd learn.tg
cp apps/.env.example apps/.env
# Edit apps/.env: PRIVATE_KEY, BLOCKSCOUT_API_KEY, etc.
pnpm install    # from the repo root: one workspace, one lockfile
cd apps/contracts
```

## Build

```sh
pnpm build       # compile + sync ABIs to apps/web
make             # same
```

## Deploy & Verify

All commands run from `apps/contracts/`. The network is determined by `NEXT_PUBLIC_NETWORK` in `apps/.env`.

| Command | Purpose |
|---|---|
| `bin/deploySLEARN` | Deploy SLEARN token |
| `bin/deployLearnTGVaultsV5` | Deploy V5 vaults |
| `bin/next/deployLearnTGVaultsV6` | Deploy V6 vaults (accounting guard; not deployed yet) |
| `bin/deployLearnTGVaultsV4` | Deploy V4 vaults (legacy) |
| `bin/deployMockUSDT` | Deploy MockUSDT (testnet only) |
| `bin/deployClusterFunds` | Deploy ClusterFunds |
| `bin/deployCeloUbi` | Deploy CeloUBI |
| `bin/configSLEARN` | Configure SLEARN after deploy (addresses + roles) |

### Source verification (Blockscout)

| Command | Purpose |
|---|---|
| `bin/contractVerificationSLEARN` | Verify SLEARN source code |
| `bin/contractVerificationLearnTGVaultsV5` | Verify V5 source code |
| `bin/contractVerificationLearnTGVaultsV4` | Verify V4 source code (legacy) |
| `bin/contractVerificationClusterFunds` | Verify ClusterFunds source code |
| `bin/contractVerificationCeloUbi` | Verify CeloUBI source code |
| `bin/contractVerificationMusdt` | Verify MockUSDT source code |

### Smoke tests (functional check on deployed contract)

| Command | Purpose |
|---|---|
| `bin/verifySLEARN` | Check SLEARN: name, rate, supply, paused |
| `bin/verifyLearnTGVaultsV5` | Check V5: VERSION, owner, balances |
| `bin/verifyLearnTGVaultsV4` | Check V4: VERSION, owner, balances (legacy) |
| `bin/testClusterFunds` | Functional test: owner, treasury, percentage, views |
| `bin/verifyClusterFunds` | Quick on-chain check: all state fields |
| `bin/verifyCeloUbi` | Check CeloUBI: owner, backendAddress |
| `bin/verifyMockUSDT` | Check MockUSDT |

### Mainnet override

USDT is resolved per network by `mpdj` (`scripts/lib/token-addresses.ts`): on Celo
mainnet it uses the canonical address, so no token variable is needed. Only on Celo
Sepolia can it be overridden with `NEXT_PUBLIC_USDT_TESTNET`.

```sh
NEXT_PUBLIC_NETWORK=celo bin/deploySLEARN
```

## Deployment Addresses

After deploy, each script saves the address to `deployments/{Contract}/{network}.json`:

```
deployments/
  SLEARN/celoSepolia.json
  LearnTGVaults/V5/celoSepolia.json
  LearnTGVaults/V4/celoSepolia.json
  ClusterFunds/celoSepolia.json
  MockUSDT/celoSepolia.json
  CeloUbi/celoSepolia.json
```

**Do NOT add `NEXT_PUBLIC_*_ADDRESS` to `.env` for contract addresses.**
The deployment JSON is the single source of truth. Scripts read from it directly.
The Next.js frontend uses `@pasosdejesus/m/blockchain/deployments`
(`readDeployment()`) or `@pasosdejesus/mpdj/blockchain/ecosystem-addresses`.

Check that every address the sources read exists here (read-only, no network).
Run it from the **repo root**; from an app it reports "no contract app" and
gives a false green:

```sh
apps/web/bin/m contract:checkdeploy
```

> **`deployments/` is gitignored** (see the repo `.gitignore`): it is a deploy
> artifact, so a fresh clone or another machine does not have it, and everything
> that reads an address (the app at runtime, the verify/smoke scripts) needs those
> files present there. A missing file fails at runtime, not at build time: e.g.
> `getClusterFundsAddress()` (`packages/gdcluster/src/lib/gd-cluster-routing.ts`)
> throws `ClusterFundsV2 not deployed — address not found`.

Example reading a deployment in a script:
```typescript
import * as path from "path"
import * as fs from "fs"
const network = process.env.NEXT_PUBLIC_NETWORK || "celoSepolia"
const file = path.join(__dirname, "..", "deployments", "ClusterFunds", `${network}.json`)
const { address } = JSON.parse(fs.readFileSync(file, "utf8"))
```

## Testing

```sh
pnpm test
```

> **OpenBSD/adJ:** Hardhat's native test runner (EDR) does not support OpenBSD.
> Use the EthereumJS fallback instead:
> ```sh
> cd ../web && bin/m contract:test
> ```

## ABI Sync

ABIs are auto-synced to `../web/abis/` on `pnpm build`.
To sync manually: `pnpm sync:abis`.

## OpenBSD / adJ

Hardhat v3 is not supported. This project uses Hardhat v2.

`pnpm install` recreates `node_modules`, so the OpenBSD patch for
`@nomicfoundation/solidity-analyzer` lives there only until the next install.
`pnpm build` runs `bin/prepadJ.sh` automatically (it compiles the native addon and
patches every installed copy); run it by hand with `pnpm prepadJ` when you only
compiled, for example after a fresh clone or after `pnpm i`. It needs `corepack`
(ships with Node) and Rust/cargo, and it skips itself on other operating systems.
