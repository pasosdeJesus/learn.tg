# Learn.tg - Smart Contracts

This directory contains the Solidity smart contracts for the Learn.tg
platform, managed with Hardhat. These contracts handle the creation of
scholarship vaults and the secure, transparent distribution of USDT
rewards to students on the Celo network.

## Overview

- **`LearnTGVaults.sol`**: The core contract that allows teachers or
  sponsors to create educational vaults. Students can earn rewards from
  these vaults by successfully completing course activities.
- **`MockUSDT.sol`**: A mock USDT contract for testing purposes in a
  local or testnet environment.

## Prerequisites

- [Node.js](https://nodejs.org/) (>= 18)
- [Yarn](https://yarnpkg.com/)
- A Celo-compatible wallet with test funds. You can get Sepolia Celo
  tokens from the [Celo Faucet](https://faucet.celo.org/celo-sepolia).
  To get test cCop use https://app.mento.org/

## 1. Environment Configuration

First, create your environment file by copying the template:

```sh
cp .env.example .env
```

Next, edit the `.env` file with the following information:

- `NETWORK`: The network to deploy to. Use `celoSepolia` for the testnet
  or `celo` for mainnet.
- `PRIVATE_KEY`: The private key of the wallet you will use for deployment.
- `BLOCKSCOUT_API_KEY`: Your API key from Blockscout for contract
  verification. You can generate one in your account settings on the
  [Celo Blockscout explorer](https://explorer.celo.org/).
- `DEPLOYED_AT`: This will hold the contract address after deployment.
  Leave it blank for now.

**⚠️ Security Warning:** Never use a wallet containing real funds for
  development. Always generate and use a separate, dedicated wallet
  for testing.

## 2. Platform-Specific Setup (adJ / OpenBSD)

Due to compatibility issues, Hardhat v3 does not work on adJ/OpenBSD 
as of 2025. This project is configured to use Hardhat v2. If you are on 
this platform, you must first run the following script to prepare the 
environment:

```sh
bin/prepadJ.sh
```

## 3. Development Workflow

Follow these steps to compile, deploy, and verify your contracts.

### Step 3.1: Install Dependencies

```sh
yarn install
```

### Step 3.2: Compile Contracts

This command compiles the Solidity contracts and automatically syncs the 
ABIs with the Next.js frontend.

```sh
yarn build
```

### Step 3.3: Deploy the Contract

Make sure your deployment wallet is funded. Then, run the deployment 
script:

```sh
bin/deployLearnTGVaults
```

The script will output the contract address to the console. **Copy 
this address.**

### Step 3.4: Update Environment File

Paste the copied contract address into the `DEPLOYED_AT` variable in 
your `.env` file.

### Step 3.5: Verify Contract on Blockscout

This step publishes and verifies the contract's source code on the 
blockchain explorer, which is a crucial trust and security signal.

```sh
bin/contractVerification
```

## 4. Testing

The project uses Hardhat's built-in testing framework with Chai matchers. 
The tests are located in the `test/` directory.

To run the entire test suite, execute the following command:

```sh
yarn test
```

This will compile your contracts, run the tests in an in-memory Hardhat 
Network, and report the results in the console.

## ABI Synchronization

The contract ABIs (Application Binary Interfaces) are essential for the 
frontend to interact with the smart contracts. This project is configured 
to sync them automatically.

- **Automatic Sync:** ABIs are synced to `../nextjs/abis/` every time you 
  run `yarn build` (or `yarn compile`).
- **Manual Sync:** To sync the ABIs without recompiling, run 
  `yarn sync:abis`.

