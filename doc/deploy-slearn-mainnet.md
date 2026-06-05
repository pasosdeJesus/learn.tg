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
bin/m wallet:send --name admin --to <SLEARN_ADDRESS> --function "pause()" --network celo
```

---

## Phase 3: Configure Contracts on Mainnet

```bash
NEXT_PUBLIC_NETWORK=celo bin/configSLEARN
```

This sets all addresses, grants MINTER_ROLE and BURNER_ROLE, and sets slearnContractRole on V3.
The `DEFAULT_ADMIN_ROLE` stays with the deployer temporarily until Phase 5.

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

```bash
# Backend wallet
bin/m wallet:approve --name backend --token <USDT_ADDRESS> --spender <SLEARN_ADDRESS> --amount 115792089237316195423570985008687907853269984665640564039457584007913129639935 --network celo

# learnTgReserve (L2)
bin/m wallet:approve --name learntgreserve --token <USDT_ADDRESS> --spender <SLEARN_ADDRESS> --amount 115792089237316195423570985008687907853269984665640564039457584007913129639935 --network celo

# stableSlReserve (S2)
bin/m wallet:approve --name stableslreserve --token <USDT_ADDRESS> --spender <SLEARN_ADDRESS> --amount 115792089237316195423570985008687907853269984665640564039457584007913129639935 --network celo
```

---

## Phase 5: Migration

### 5.1 Update Next.js `.env`

Set mainnet config. V3 and SLEARN addresses come from `lib/deployments.ts` automatically.

```
NEXT_PUBLIC_NETWORK=celo
NEXT_PUBLIC_USDT_ADDRESS=0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e
NEXT_PUBLIC_DEPLOYED_AT_V2=<current V2 address>
```

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

### 5.3 Set SLEARN per guide for all courses

After migration, each course vault exists with `amountPerGuideSlearn=0`. Set 1 SLEARN per guide:

```bash
cd apps/hardhat
bin/setSlearnPerCourse
```

> Keeps current USDT amount per guide. Skips courses with no vault or already configured.

### 5.4 Run Learning Points → SLEARN conversion

```bash
cd apps/nextjs
npx tsx scripts/convert-learningpoints-to-slearn.ts
```

> Idempotent — safe to re-run.

### 5.5 Transfer Admin to Cold Wallet

After conversion, transfer `DEFAULT_ADMIN_ROLE` to a cold wallet. The backend keeps only
`MINTER_ROLE` + `BURNER_ROLE`. See `doc/runbook.md` §5.

> **Prerequisite:** Import wallets via `bin/m wallet:import --name admin --private-key <ADMIN_KEY>`

> **Prerequisite:** Import wallets via `bin/m wallet:import --name admin --private-key <ADMIN_KEY>`

```bash
# Grant DEFAULT_ADMIN_ROLE to cold wallet
bin/m wallet:send --name admin --to <SLEARN_ADDRESS> --function "grantRole(bytes32,address)" --args "<DEFAULT_ADMIN_ROLE>,<COLD_WALLET>" --network celo

# Renounce DEFAULT_ADMIN_ROLE from backend
bin/m wallet:send --name admin --to <SLEARN_ADDRESS> --function "renounceRole(bytes32,address)" --args "<DEFAULT_ADMIN_ROLE>,<BACKEND_WALLET>" --network celo
```

> Replace `0x000...000` with the actual `DEFAULT_ADMIN_ROLE` hash from Blockscout → Read Contract.

---

## Phase 6: Go Live

```bash
# Unpause SLEARN
bin/m wallet:send --name admin --to <SLEARN_ADDRESS> --function "unpause()" --network celo
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
