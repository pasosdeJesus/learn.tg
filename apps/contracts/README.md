# Learn.tg — Smart Contracts

Solidity contracts for the Learn.tg platform. Deployed on Celo.
Compiled and tested with the `contract:*` commands of `m` (`bin/m`), **without Hardhat**.

## Contracts

| Contract | File | Purpose |
|---|---|---|
| **SLEARN** | `SLEARN.sol` | ERC-20 utility token, mixed payments, 3-tier reserve backing |
| **LearnTGVaultsV5** | `LearnTGVaultsV5.sol` | Active — scholarship vaults (USDT + SLEARN), flexible split (referrer + learnTg), `guideId` = `actividadpf_id` |
| **LearnTGVaultsV6** | `next/LearnTGVaultsV6.sol` | Next, **not deployed** — same interface as V5 plus self-enforcing accounting: `totalRecordedUsdt/Slearn` never above the tokens held, `retireCourse`, float-only emergency withdrawals, `forceEmergencyWithdraw*` + `accountingBroken`, `accountingState()` (R-#221, R-#293) |
| **LearnTGVaultsV4** | `LearnTGVaultsV4.sol` | Legacy V4 — partial payments, being migrated to V5 |
| **CeloUbi** | `CeloUbi.sol` | Universal Basic Income claims in CELO |
| **ClusterFunds** | `ClusterFunds.sol` | Cluster/country fund management — USDT + SLEARN donations, GD contact release |
| **MockUSDT** | `_usdt_mock.sol` | Mock USDT for testnet (copied from `@pasosdejesus/usdt` by `scripts/sync-usdt.mjs`) |

## Prerequisites

- Node.js >= 18
- pnpm
- Celo wallet with funds (CELO for gas)

## Setup

Environment is configured via the shared `apps/.env` (see `apps/.env.example`); the
scripts and the tooling load it.

```sh
cd learn.tg
cp apps/.env.example apps/.env
# Edit apps/.env: PRIVATE_KEY, BLOCKSCOUT_API_KEY, etc.
pnpm install    # from the repo root: one workspace, one lockfile
cd apps/contracts
```

## Compiler and configuration

`m-contracts.config.ts` holds what `hardhat.config.ts` used to hold, as a **literal
object** (`bin/m contract:*` reads it with regular expressions: no imports, no
functions):

| Key | Value | Why |
|---|---|---|
| `solidity` | `0.8.24` | the pin the deployed contracts were compiled with |
| `optimizer` | enabled, 200 runs | same |
| `viaIR` | `true` | same |
| `evmVersion` | `paris` | Hardhat's default for this pin; any other target changes the bytecode |
| `networks` / `explorer` | the four networks and both explorers | used by `contract:deploy` / `contract:verify` |

`solc@0.8.24` is a devDependency: the project compiler wins over the `solc-js` bundled
by `@pasosdejesus/contract-test` (0.8.26), so the artifacts stay **byte-identical** to
the ones Hardhat produced and the verified deployments do not need re-verification.

## Build

```sh
pnpm build       # sync _usdt_mock.sol + contract:compile + sync ABIs to apps/web
make             # same
```

`pnpm compile` writes `artifacts/` in Hardhat's shape (`_format: hh-sol-artifact-1`), so
`sync-abis.mjs`, `typechain` and the consumers of `apps/web/abis` keep working.
Generated and not versioned: `artifacts/`, `cache/`, `typechain-types/`, `dist/`.

## Deploy & Verify

All commands run from `apps/contracts/`. The network is determined by
`NEXT_PUBLIC_NETWORK` in `apps/.env`. Each wrapper exports it to
`node --import tsx scripts/<name>.ts` (the runtime is `scripts/lib/ethers-cli.ts`:
plain `ethers`, the deployer wallet and the artifacts).

| Command | Purpose |
|---|---|
| `bin/deploySLEARN` | Deploy SLEARN token |
| `bin/deployLearnTGVaultsV5` | Deploy V5 vaults |
| `bin/next/deployLearnTGVaultsV6` | Deploy V6 vaults (accounting guard; not deployed yet) |
| `bin/deployMockUSDT` | Deploy MockUSDT (testnet only) |
| `bin/deployClusterFunds` / `bin/deployClusterFundsV2` | Deploy ClusterFunds / ClusterFundsV2 |
| `bin/deployCeloUbi` | Deploy CeloUBI |
| `bin/configSLEARN` | Configure SLEARN after deploy (addresses + roles) |
| `bin/setSlearnPerCourse`, `bin/migrateClusterFundV1-V2`, `bin/setClusterFundsFees` | Operational changes on a deployed contract |

### Source verification (Blockscout / Basescan)

The constructor arguments come from the deployment JSON, so one command covers every
contract:

```sh
bin/verify-source ClusterFundsV2            # Moonbase/Blockscout of the network in .env
bin/verify-source SLEARN --dry-run          # print the request without sending it
```

It builds the `solidity-standard-json-input` request with the pin of
`m-contracts.config.ts`. Known contracts: `SLEARN`, `ClusterFunds`, `ClusterFundsV2`,
`LearnTGVaultsV4`, `LearnTGVaultsV5`, `MockUSDT`, `CeloUbi`.

A direct deploy of a single contract is also available:
`../web/bin/m contract:deploy --contract <Name> --network <net> --args '["0x…"]'`
(write big integers as strings; `--args-file` takes the array from a file).

### Smoke tests (functional check on deployed contract)

| Command | Purpose |
|---|---|
| `bin/verifySLEARN` | Check SLEARN: name, rate, supply, paused |
| `bin/verifyLearnTGVaultsV5` | Check V5: VERSION, owner, balances |
| `bin/verifyLearnTGVaultsV4` | Check V4: VERSION, owner, balances (legacy) |
| `bin/testClusterFunds` | Functional test: owner, treasury, percentage, views |
| `bin/verifyClusterFunds` / `bin/verifyClusterFundsV2` | Quick on-chain check: all state fields |
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
  LearnTGVaults/V3/celoSepolia.json
  ClusterFunds/celoSepolia.json
  ClusterFundsV2/celoSepolia.json
  MockUSDT/celoSepolia.json
  CeloUbi/celoSepolia.json
```

The V3 entry is `0x8f2F458366ef5EB49de17052d01e608Bdc32Ff2c` on `celoSepolia`: the vault with the
full 22-function surface of `LearnTGVaultsV3.sol`, the current USDT/SLEARN and an empty balance (it
is the one migrated to V4). `0x0db4bb854235aEe7067396aCd3Ed81CFF010dDD7` is also a `VERSION = 3`
vault but from an earlier revision (it lacks `setAmountPerGuide`) and still holds test funds.

References the tree cannot satisfy are declared in `contract-check.json` at the repository root
(`ignoreFiles` and `allowMissingDeployments`, see `m` `doc/contract-checkdeploy.md`); V6 is listed
there because it is not deployed (R-#293).

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
pnpm test       # bin/m contract:test — 92 cases (vaults, V5, V6, Ubi, ClusterFunds)
```

The tests are written like Hardhat tests (`import hre from "hardhat"`, `loadFixture`,
`time.increase`, chai matchers): `contract:test` **mocks those modules** and runs the
suite on the in-memory chain (`@ethereumjs/vm` on OpenBSD, `@pasosdejesus/edr`
elsewhere). The declarations that keep them typechecking live in `types/`.

## ABI Sync

ABIs are auto-synced to `../web/abis/` on `pnpm build`.
To sync manually: `pnpm sync:abis`.

## OpenBSD / adJ

There is nothing to patch: the OpenBSD problem was Hardhat's native
`@nomicfoundation/solidity-analyzer` addon. `bin/prepadJ.sh`, the Rust build and the
`ignore-scripts` workarounds are gone with Hardhat.
