# SLEARN Mainnet Deployment Checklist

> "Whatever you do, work at it with all your heart, as working for the Lord" (Colossians 3:23)

---

## Prerequisites

- [ ] Private key with **CELO for gas** (~1.5 CELO per deploy, contracts are 13KB)
- [ ] Private key with **USDT** for initial reserve funding
- [ ] All production addresses ready:
  - `pdJTreasury`
  - `ubiWallet`
  - `referralWallet`
  - `churchesWallet`
  - `reserveMultisig` (SL0 — Safe multisig, air-gapped)
  - `learnTgReserve` (L2 — hot reserve EOA)
  - `stableSlReserve` (S2 — hot reserve EOA for stable-sl)
- [ ] Optimizer enabled in `hardhat.config.ts`:
  ```typescript
  solidity: {
    version: '0.8.24',
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  ```
- [ ] Compiled with optimizer: `npx hardhat compile` (no size warning should appear)

---

---

## Phase 1: Deploy to Celo Sepolia (Testnet)

### 1.1 Deploy SLEARN

```bash
cd apps/hardhat
NEXT_PUBLIC_USDT_ADDRESS=0x7d7a73c8c0D00Fdf8b54b1a6dB6eBDEcdBa78aE8 bin/deploySLEARN
```

→ Address saved to `deployments/SLEARN/celoSepolia.json`.

### 1.2 Verify SLEARN

```bash
bin/contractVerificationSLEARN
```

> 🔒 **Fix applied**: verify scripts now use deployment file values, never `.env`.

### 1.3 Deploy LearnTGVaultsV3

```bash
NEXT_PUBLIC_USDT_ADDRESS=0x7d7a73c8c0D00Fdf8b54b1a6dB6eBDEcdBa78aE8 bin/deployLearnTGVaultsV3
```

→ Address saved to `deployments/LearnTGVaults/V3/celoSepolia.json`.
> Reads SLEARN address from `deployments/SLEARN/celoSepolia.json` automatically.

### 1.4 Verify LearnTGVaultsV3

```bash
bin/contractVerificationLearnTGVaultsV3
```

### 1.5 Smoke tests

```bash
bin/verifySLEARN
bin/verifyLearnTGVaultsV3
```

Expected: SLEARN shows name/symbol/rate/supply, V3 shows VERSION=3/owner/balances.

### 1.6 Configure contracts on Sepolia

```bash
bin/configSLEARN
```

### 1.7 Run E2E tests

```bash
NETWORK=celoSepolia \
```bash
bin/testSLEARN
```

Expected: **17/17 passed**.

---

## Phase 2: Deploy to Celo Mainnet

### 2.1 Deploy SLEARN

```bash
cd apps/hardhat
NEXT_PUBLIC_NETWORK=celo \
NEXT_PUBLIC_USDT_ADDRESS=0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e \
bin/deploySLEARN
```

→ Address saved to `deployments/SLEARN/celo.json`.

### 2.2 Verify SLEARN

```bash
NEXT_PUBLIC_NETWORK=celo bin/contractVerificationSLEARN
```

### 2.3 Deploy LearnTGVaultsV3

```bash
NEXT_PUBLIC_NETWORK=celo \
NEXT_PUBLIC_USDT_ADDRESS=0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e \
bin/deployLearnTGVaultsV3
```

Address saved to `deployments/LearnTGVaults/V3/celo.json`.

### 2.4 Verify LearnTGVaultsV3

```bash
NEXT_PUBLIC_NETWORK=celo bin/contractVerificationLearnTGVaultsV3
```

### 2.5 Smoke tests

```bash
NEXT_PUBLIC_NETWORK=celo bin/verifySLEARN
NEXT_PUBLIC_NETWORK=celo bin/verifyLearnTGVaultsV3
```

Expected: SLEARN shows name/symbol/rate/supply, V3 shows VERSION=3/owner/balances.

### 2.6 `pause()` both contracts

```bash
# Before configuring, pause to prevent any interaction.
# Use Blockscout "Write" tab or cast:
#   cast send $SLEARN_ADDR "pause()" --private-key $PRIVATE_KEY --rpc-url $NEXT_PUBLIC_RPC_URL
```

---

## Phase 3: Configure Contracts on Mainnet

```bash
NEXT_PUBLIC_NETWORK=celo bin/configSLEARN
```

This sets all addresses, grants MINTER_ROLE and BURNER_ROLE, and sets slearnContractRole on V3.
It uses the production addresses from `apps/.env`. If you need different addresses per role,
edit `apps/.env` before running or configure manually via Blockscout.

### Manual steps (if needed)

```
SLEARN.setPdJTreasury(<pdJTreasury>)
SLEARN.setUbiWallet(<ubiWallet>)
SLEARN.setReferralWallet(<referralWallet>)
SLEARN.setChurchesWallet(<churchesWallet>)
SLEARN.setReserveMultisig(<SL0 multisig address>)
SLEARN.setLearnTgReserve(<L2 hot reserve EOA>)
SLEARN.setStableSlReserve(<S2 stable-sl EOA>)
SLEARN.setLearnTGVault(<V3 address>)
SLEARN.setLearnTGVaultSLEARN(<V3 address>)
SLEARN.grantRole(MINTER_ROLE, <backend wallet>)
SLEARN.grantRole(BURNER_ROLE, <backend wallet>)
LearnTGVaultsV3.setSlearnContractRole(<SLEARN address>, true)
```

---

## Phase 4: One-Time Allowances (Critical!)

Per `doc/runbook.md` §2:

| From | To | Token | Command |
|---|---|---|---|
| Backend wallet | SLEARN | USDT | `USDT.approve(SLEARN, max)` |
| Backend wallet | SLEARN | SLEARN | `SLEARN.approve(SLEARN, max)` |
| `learnTgReserve` (L2) | SLEARN | USDT | `USDT.approve(SLEARN, max)` |
| `stableSlReserve` (S2) | SLEARN | USDT | `USDT.approve(SLEARN, max)` |

> ⚠️ If any allowance is revoked, `processPayment` or `redeemForSLE` will fail.

---

## Phase 5: Migration

### 5.1 Update Next.js `.env`

Contract addresses live in the deployments directory after each deploy step.
Copy them to `.env`:

```
# From deployments/LearnTGVaults/V3/celo.json → address
NEXT_PUBLIC_DEPLOYED_AT=<V3 address>
# From deployments/SLEARN/celo.json → address
NEXT_PUBLIC_SLEARN_ADDRESS=<SLEARN address>
# Current V2 contract on mainnet
NEXT_PUBLIC_DEPLOYED_AT_V2=<current V2 address>
# Mainnet config
NEXT_PUBLIC_NETWORK=celo
NEXT_PUBLIC_NEXT_PUBLIC_USDT_ADDRESS=0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e
```

> The deployment files are the single source of truth. Never guess addresses — always read from `deployments/{Contract}/celo.json`.

### 5.2 Run V2→V3 migration

```bash
cd apps/nextjs
npx tsx db/migrations/20260531000000_contract-to-v3.ts
```

This script:
1. Drains USDT from V2
2. Transfers USDT to V3
3. Creates vaults in V3 (`createVault` with SLEARN=0 initially)
4. Migrates `guidePaid` records (maps `numGuia` → `actividadpf_id`)

### 5.3 Run Learning Points → SLEARN conversion

```bash
cd apps/nextjs
npx tsx scripts/convert-learningpoints-to-slearn.ts
```

> Idempotent — safe to re-run.

---

## Phase 6: `unpause()` and Go Live

```
SLEARN.unpause()
LearnTGVaultsV3 (no pause function — just verify setSlearnContractRole)
```

### Then monitor:

- [ ] Crosswords pay in USDT via `payScholarship`
- [ ] Leaderboard shows SLEARN balances
- [ ] Transparency dashboard shows SLEARN supply
- [ ] `learnTgReserve` balance within 100–1000 USDT range (runbook §3)

---

## Recovery

If anything goes wrong:
- `SLEARN.pause()` — disables all operations
- `LearnTGVaultsV3.emergencyWithdrawUSDT/emergencyWithdrawSLEARN` — owner withdraws all funds

Full disaster recovery: `doc/runbook.md` §6.

---

## Key Addresses Reference

| Component | Sepolia | Mainnet |
|---|---|---|
| SLEARN | `0x430E3f...` | TBD |
| LearnTGVaultsV3 | `0x0db4bb...` | TBD |
| USDT | `0x7d7a73...` | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` |
| Deploy wallet | `0x84272a...` | Your real wallet |
