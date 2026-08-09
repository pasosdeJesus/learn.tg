# Learn.tg — Smart Contracts

Solidity contracts for the Learn.tg platform, managed with Hardhat.
Deployed on Celo.

## Contracts

| Contract | File | Purpose |
|---|---|---|
| **SLEARN** | `SLEARN.sol` | ERC-20 utility token, mixed payments, 3-tier reserve backing |
| **LearnTGVaultsV4** | `LearnTGVaultsV4.sol` | Active — scholarship vaults (USDT + SLEARN), partial payments, `guideId` = `actividadpf_id` |
| **CeloUbi** | `CeloUbi.sol` | Universal Basic Income claims in CELO |
| **ClusterFunds** | `ClusterFunds.sol` | Cluster/country fund management — USDT + SLEARN donations, GD contact release |
| **MockUSDT** | `MockUSDT.sol` | Mock USDT for testnet |

## Prerequisites

- Node.js >= 18
- Yarn
- Celo wallet with funds (CELO for gas)

## Setup

Environment is configured via the shared `apps/.env` (see `apps/.env.example`).
The Hardhat config loads it automatically.

```sh
cd apps
cp .env.example .env
# Edit .env: PRIVATE_KEY, BLOCKSCOUT_API_KEY, etc.
cd hardhat
yarn install
```

## Build

```sh
yarn build       # compile + sync ABIs to nextjs
make             # same
```

## Deploy & Verify

All commands run from `apps/hardhat/`. The network is determined by `NEXT_PUBLIC_NETWORK` in `apps/.env`.

| Command | Purpose |
|---|---|
| `bin/deploySLEARN` | Deploy SLEARN token |
| `bin/deployLearnTGVaultsV4` | Deploy V4 vaults |
| `bin/deployMockUSDT` | Deploy MockUSDT (testnet only) |
| `bin/deployClusterFunds` | Deploy ClusterFunds |
| `bin/deployCeloUbi` | Deploy CeloUBI |
| `bin/configSLEARN` | Configure SLEARN after deploy (addresses + roles) |

### Source verification (Blockscout)

| Command | Purpose |
|---|---|
| `bin/contractVerificationSLEARN` | Verify SLEARN source code |
| `bin/contractVerificationLearnTGVaultsV4` | Verify V4 source code |
| `bin/contractVerificationClusterFunds` | Verify ClusterFunds source code |
| `bin/contractVerificationCeloUbi` | Verify CeloUBI source code |
| `bin/contractVerificationMusdt` | Verify MockUSDT source code |

### Smoke tests (functional check on deployed contract)

| Command | Purpose |
|---|---|
| `bin/verifySLEARN` | Check SLEARN: name, rate, supply, paused |
| `bin/verifyLearnTGVaultsV4` | Check V4: VERSION, owner, balances |
| `bin/testClusterFunds` | Functional test: owner, treasury, percentage, views |
| `bin/verifyClusterFunds` | Quick on-chain check: all state fields |
| `bin/verifyCeloUbi` | Check CeloUBI: owner, backendAddress |
| `bin/verifyMockUSDT` | Check MockUSDT |

### Mainnet override

```sh
NEXT_PUBLIC_NETWORK=celo \
NEXT_PUBLIC_USDT_ADDRESS=0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e \
bin/deploySLEARN
```

## Deployment Addresses

After deploy, each script saves the address to `deployments/{Contract}/{network}.json`:

```
deployments/
  SLEARN/celoSepolia.json
  LearnTGVaults/V4/celoSepolia.json
  ClusterFunds/celoSepolia.json
  MockUSDT/celoSepolia.json
  CeloUbi/celoSepolia.json
```

**Do NOT add `NEXT_PUBLIC_*_ADDRESS` to `.env` for contract addresses.**
The deployment JSON is the single source of truth. Scripts read from it directly.
The Next.js frontend uses `@pasosdejesus/m/blockchain/deployments`
(`readDeployment()`) or `@pasosdejesus/mpdj/blockchain/ecosystem-addresses`.

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
yarn test
```

## ABI Sync

ABIs are auto-synced to `../nextjs/abis/` on `yarn build`.
To sync manually: `yarn sync:abis`.

## OpenBSD / adJ

Hardhat v3 is not supported. This project uses Hardhat v2.
Run `bin/prepadJ.sh` before first use.
