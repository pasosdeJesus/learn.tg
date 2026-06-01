# SLEARN Operations Runbook

Operational procedures for the SLEARN token and related contracts on Celo mainnet.

---

## 1. Key Addresses & Roles

| Component | Address | Role |
| :--- | :--- | :--- |
| SLEARN contract | `TBD` | Token + distribution logic |
| LearnTGVaultsV3 contract | `TBD` | Scholarship vaults (USDT + SLEARN) |
| Backend wallet | `TBD` | `MINTER_ROLE`, `BURNER_ROLE`, calls `processPayment` |
| reserveMultisig (SL0) | `TBD` | Master Safe. Holds USDT, CELO, XAUT |
| learnTgReserve (L2) | `TBD` | Hot reserve EOA. Receives from `mintAndReserve`, source for burn→USDT |
| stableSlReserve (S2) | `TBD` | Hot reserve EOA. Source for `redeemForSLE` |
| pdJTreasury | `TBD` | Receives 5% (donations) / 55% (premium) |
| ubiWallet | `TBD` | Receives UBI share, converts USDT→CELO |
| churchesWallet | `TBD` | Receives church share |
| referralWallet | `TBD` | Receives referral program USDT share |

---

## 2. Required Allowances (One-Time Setup)

These `approve` calls must be made after contract deployment and after any key rotation:

| From | To | Token | Purpose |
| :--- | :--- | :--- | :--- |
| Backend wallet | SLEARN contract | USDT | `processPayment` → `transferFrom` |
| Backend wallet | SLEARN contract | SLEARN | `processPayment` → `transferFrom` |
| `learnTgReserve` (L2) | SLEARN contract | USDT | Burn→USDT release in `processPayment` |
| `stableSlReserve` (S2) | SLEARN contract | USDT | `redeemForSLE` → release USDT to stable-sl |

**Critical:** If any of these allowances are revoked, the corresponding operations (donations, redemptions) will fail. Never revoke without replacing first.

---

## 3. Liquidity Management

### Hot Reserve (L2) Rules

| Condition | Action |
| :--- | :--- |
| `learnTgReserve` balance < 100 USDT | ⚠️ Alert admin. Transfer from SL0 master to L2. |
| `learnTgReserve` balance > 1000 USDT | Transfer excess to SL0 master. |
| `learnTgReserve` balance normal | No action needed. |

### Master Reserve (SL0) Rules

- Receives excess from L2 and S2 (when > 1000 USDT)
- Holds USDT, CELO, XAUT
- Convert excess USDT to XAUT periodically (manual decision)
- Coverage ratio: `(SL0_USD + L2_USD + S2_USD) / (totalSLEARN × max(1/22, 1/FxSLE/USD))` must be ≥ 1

### Monitoring

```bash
# Check L2 balance
cast call <SLEARN_ADDRESS> "usdt()(address)" --rpc-url <RPC>
cast balance --erc20 <USDT_ADDRESS> <learnTgReserve_ADDRESS> --rpc-url <RPC>

# Check SLEARN supply
cast call <SLEARN_ADDRESS> "totalSupply()(uint256)" --rpc-url <RPC>

# Check coverage
# (total reserve USD) / (totalSLEARN / 22) >= 1
```

---

## 4. Emergency Procedures

### Pause All Operations

```bash
cast send <SLEARN_ADDRESS> "pause()" --private-key <ADMIN_KEY> --rpc-url <RPC>
```

This disables: `processPayment`, `mint`, `mintAndReserve`, `redeemForSLE`, `transfer`, `transferFrom`, `burn`.

### Unpause

```bash
cast send <SLEARN_ADDRESS> "unpause()" --private-key <ADMIN_KEY> --rpc-url <RPC>
```

### Emergency Withdraw from Vault

```bash
# USDT
cast send <VAULT_ADDRESS> "emergencyWithdrawUSDT(uint256)" <amount> --private-key <OWNER_KEY> --rpc-url <RPC>

# SLEARN
cast send <VAULT_ADDRESS> "emergencyWithdrawSLEARN(uint256)" <amount> --private-key <OWNER_KEY> --rpc-url <RPC>
```

---

## 5. Routine Operations

### Register a New Course Vault

```bash
cast send <VAULT_ADDRESS> "createVault(uint256,uint256,uint256)" \
  <courseId> <amountPerGuideUSDT> <amountPerGuideSLEARN> \
  --private-key <OWNER_KEY> --rpc-url <RPC>
```

### Register a Missional Course

```bash
cast send <SLEARN_ADDRESS> "addMissionalCourse(uint256)" <courseId> \
  --private-key <MINTER_KEY> --rpc-url <RPC>
```

### Remove a Missional Course

```bash
cast send <SLEARN_ADDRESS> "removeMissionalCourse(uint256)" <courseId> \
  --private-key <MINTER_KEY> --rpc-url <RPC>
```

### Adjust Conversion Rate

```bash
cast send <SLEARN_ADDRESS> "setUsdtToSlearnRate(uint256)" <newRate> \
  --private-key <ADMIN_KEY> --rpc-url <RPC>
```

⚠️ Changing the rate affects all future distributions and redemptions. Coordinate with stable-sl before changing.

### Update Backend Wallet (Key Rotation)

```bash
# Grant MINTER_ROLE to new wallet
cast send <SLEARN_ADDRESS> "grantRole(bytes32,address)" \
  <MINTER_ROLE_HASH> <new_wallet> --private-key <ADMIN_KEY>

# Setup new allowances (see §2)
# Revoke old wallet
cast send <SLEARN_ADDRESS> "revokeRole(bytes32,address)" \
  <MINTER_ROLE_HASH> <old_wallet> --private-key <ADMIN_KEY>
```

Granting `MINTER_ROLE` automatically adds the address to `authorizedTransfers`, allowing users to send SLEARN to it.

---

## 6. Disaster Recovery

### Allowance Revoked from Reserve

If `learnTgReserve` or `stableSlReserve` allowance is revoked:

1. Identify which allowance was revoked
2. Re-approve: `cast send <USDT_ADDRESS> "approve(address,uint256)" <SLEARN_ADDRESS> <max_uint256> --private-key <RESERVE_KEY>`
3. Verify: `cast call <USDT_ADDRESS> "allowance(address,address)" <RESERVE> <SLEARN_ADDRESS>`

### Contract Compromised

1. `pause()` both SLEARN and LearnTGVaultsV3
2. Deploy new contracts
3. `emergencyWithdraw` all funds from old contracts
4. Migrate to new contracts following V2→V3 migration pattern
5. Update backend `.env` with new addresses
6. `unpause()` new contracts

---

## 7. Vault Migration (V3 → V4, future)

When migrating to a new vault version:

1. `emergencyWithdrawUSDT` all USDT from old vault
2. `emergencyWithdrawSLEARN` all SLEARN from old vault
3. Transfer to new vault contract
4. Recreate vaults in new contract with same parameters
5. Migrate `guidePaid` records (use migration script pattern from `contract-to-v2.ts`)
6. Update backend `NEXT_PUBLIC_DEPLOYED_AT` to new address
