# SLEARN Operations Runbook

Operational procedures for the SLEARN token and related contracts on Celo mainnet.

> **Prerequisite:** Wallets must be imported first:
> ```bash
> bin/m wallet:import --name admin --private-key <ADMIN_KEY>
> bin/m wallet:import --name minter --private-key <MINTER_KEY>
> ```
> All commands use `--network celo` for mainnet. For testnet, use `--network celoAlfajores`.

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
# Check USDT address used by SLEARN
bin/m wallet:call --name admin --to <SLEARN_ADDRESS> --function "usdt()" --network celo

# Check L2 USDT balance
bin/m wallet:balance --name admin --token <USDT_ADDRESS> --network celo
# (checks admin's balance; for any address use wallet:call)
bin/m wallet:call --name admin --to <USDT_ADDRESS> --function "balanceOf(address)" --args "<learnTgReserve>" --network celo

# Check SLEARN supply
bin/m wallet:call --name admin --to <SLEARN_ADDRESS> --function "totalSupply()" --network celo

# Check coverage
# (total reserve USD) / (totalSLEARN / 22) >= 1
```

---

## 4. Emergency Procedures

> **Calldata reference:**
> ```bash
> # Compute calldata for any function (one-time, or keep the hex values below)
> cast calldata "pause()"                        # → 0x8456cb59
> cast calldata "unpause()"                      # → 0x3f4ba83a
> cast calldata "emergencyWithdrawUSDT(uint256)" # → 0x...
> cast calldata "emergencyWithdrawSLEARN(uint256)" # → 0x...
> ```

### Pause All Operations

```bash
bin/m wallet:send --name admin --to <SLEARN_ADDRESS> --data 0x8456cb59 --network celo
```

This disables: `processPayment`, `mint`, `mintAndReserve`, `redeemForSLE`, `transfer`, `transferFrom`, `burn`.

### Unpause

```bash
bin/m wallet:send --name admin --to <SLEARN_ADDRESS> --data 0x3f4ba83a --network celo
```

### Emergency Withdraw from Vault

```bash
# USDT
bin/m wallet:send --name admin --to <VAULT_ADDRESS> --data <calldata> --network celo

# SLEARN
bin/m wallet:send --name admin --to <VAULT_ADDRESS> --data <calldata> --network celo
```

---

## 5. Routine Operations

### Register a New Course Vault

```bash
# Compute: cast calldata "createVault(uint256,uint256,uint256)" <courseId> <amountUSDT> <amountSLEARN>
bin/m wallet:send --name admin --to <VAULT_ADDRESS> --data <calldata> --network celo
```

### Register a Missional Course

```bash
# Compute: cast calldata "addMissionalCourse(uint256)" <courseId>
bin/m wallet:send --name minter --to <SLEARN_ADDRESS> --data <calldata> --network celo
```

### Remove a Missional Course

```bash
# Compute: cast calldata "removeMissionalCourse(uint256)" <courseId>
bin/m wallet:send --name minter --to <SLEARN_ADDRESS> --data <calldata> --network celo
```

### Adjust Conversion Rate

```bash
# Compute: cast calldata "setUsdtToSlearnRate(uint256)" <newRate>
bin/m wallet:send --name admin --to <SLEARN_ADDRESS> --data <calldata> --network celo
```

⚠️ Changing the rate affects all future distributions and redemptions. Coordinate with stable-sl before changing.

### Update Backend Wallet (Key Rotation)

```bash
# Grant MINTER_ROLE to new wallet
# Compute: cast calldata "grantRole(bytes32,address)" <MINTER_ROLE_HASH> <new_wallet>
bin/m wallet:send --name admin --to <SLEARN_ADDRESS> --data <calldata> --network celo

# Setup new allowances (see §2)
bin/m wallet:approve --name <new_backend> --token <USDT_ADDRESS> --spender <SLEARN_ADDRESS> --amount 115792089237316195423570985008687907853269984665640564039457584007913129639935 --network celo

# Revoke old wallet
# Compute: cast calldata "revokeRole(bytes32,address)" <MINTER_ROLE_HASH> <old_wallet>
bin/m wallet:send --name admin --to <SLEARN_ADDRESS> --data <calldata> --network celo
```

Granting `MINTER_ROLE` automatically adds the address to `authorizedTransfers`, allowing users to send SLEARN to it.

---

## 6. Disaster Recovery

### Allowance Revoked from Reserve

If `learnTgReserve` or `stableSlReserve` allowance is revoked:

1. Identify which allowance was revoked
2. Re-approve:
   ```bash
   bin/m wallet:approve --name <reserve_wallet> --token <USDT_ADDRESS> --spender <SLEARN_ADDRESS> --amount 115792089237316195423570985008687907853269984665640564039457584007913129639935 --network celo
   ```
3. Verify:
   ```bash
   bin/m wallet:call --name admin --to <USDT_ADDRESS> --function "allowance(address,address)" --args "<RESERVE>,<SLEARN_ADDRESS>" --network celo
   ```

### Contract Compromised

1. `pause()` both SLEARN and LearnTGVaultsV3 (see §4)
2. Deploy new contracts
3. `emergencyWithdraw` all funds from old contracts (see §4)
4. Migrate to new contracts following V2→V3 migration pattern
5. Update backend `.env` with new addresses
6. `unpause()` new contracts (see §4)

---

## 7. Vault Migration (V3 → V4, future)

When migrating to a new vault version:

1. `emergencyWithdrawUSDT` all USDT from old vault (see §4)
2. `emergencyWithdrawSLEARN` all SLEARN from old vault (see §4)
3. Transfer to new vault contract
4. Recreate vaults in new contract with same parameters (see §5)
5. Migrate `guidePaid` records (use migration script pattern from `contract-to-v2.ts`)
6. Update backend `NEXT_PUBLIC_DEPLOYED_AT` to new address
