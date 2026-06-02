# Learn.tg — Smart Contracts

Solidity contracts for the Learn.tg platform, managed with Hardhat.
Deployed on Celo.

## Contracts

| Contract | File | Purpose |
|---|---|---|
| **SLEARN** | `SLEARN.sol` | ERC-20 utility token, mixed payments, 3-tier reserve backing |
| **LearnTGVaultsV3** | `LearnTGVaultsV3.sol` | Scholarship vaults (USDT + SLEARN), `guideId` = `actividadpf_id` |
| **LearnTGVaults** | `LearnTGVaults.sol` | Legacy V2 — being migrated to V3 |
| **CeloUbi** | `CeloUbi.sol` | Universal Basic Income claims in CELO |
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
| `bin/deployLearnTGVaultsV3` | Deploy V3 vaults (reads SLEARN from deployments) |
| `bin/deployMockUSDT` | Deploy MockUSDT (testnet only) |
| `bin/deployCeloUbi` | Deploy CeloUBI |
| `bin/configSLEARN` | Configure SLEARN after deploy (addresses + roles) |

### Source verification (Blockscout)

| Command | Purpose |
|---|---|
| `bin/contractVerificationSLEARN` | Verify SLEARN source code |
| `bin/contractVerificationLearnTGVaultsV3` | Verify V3 source code |
| `bin/contractVerificationCeloUbi` | Verify CeloUBI source code |
| `bin/contractVerificationMusdt` | Verify MockUSDT source code |

### Smoke tests (functional check on deployed contract)

| Command | Purpose |
|---|---|
| `bin/verifySLEARN` | Check SLEARN: name, rate, supply, paused |
| `bin/verifyLearnTGVaultsV3` | Check V3: VERSION, owner, balances |
| `bin/verifyCeloUbi` | Check CeloUBI: owner, backendAddress |
| `bin/verifyMockUSDT` | Check MockUSDT |

### Mainnet override

```sh
NEXT_PUBLIC_NETWORK=celo \
NEXT_PUBLIC_USDT_ADDRESS=0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e \
bin/deploySLEARN
```

## Deployment Addresses

After deploy, addresses are saved to `deployments/{Contract}/{network}.json`.
V3 addresses are also available via `lib/deployments.ts` in the Next.js app.

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
