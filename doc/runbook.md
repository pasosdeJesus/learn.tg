# SLEARN Operations Runbook

Operational procedures via `bin/m eng:opwallet:*`. No `cast` required.

> **Prerequisite:** Import wallets:
> ```bash
> bin/m eng:opwallet:import --name admin --private-key <ADMIN_KEY>
> bin/m eng:opwallet:import --name minter --private-key <MINTER_KEY>
> bin/m eng:opwallet:import --name learntgreserve --private-key <L2_KEY>
> ```
> Default network is `celoSepolia`. Use `--network celo` for mainnet.

## 1. Monitoring

```bash
bin/m eng:opwallet:balance --name admin --token <USDT_ADDRESS>
bin/m eng:opwallet:call --name admin --to <SLEARN> --function "totalSupply()"
bin/m eng:opwallet:call --name admin --to <USDT> --function "allowance(address,address)" --args "<RESERVE>,<SLEARN>"
```

## 2. Allowances (One-Time)

Run `bin/configSLEARN` to set all allowances automatically. Manual equivalents:

```bash
# Backend → SLEARN (USDT)
bin/m eng:opwallet:approve --name backend --token <USDT> --spender <SLEARN> --amount max
# Backend → SLEARN (SLEARN)
bin/m eng:opwallet:approve --name backend --token <SLEARN> --spender <SLEARN> --amount max
# Backend → backend (self-approval for OZ v5 transferFrom)
bin/m eng:opwallet:approve --name backend --token <SLEARN> --spender <BACKEND> --amount max
# learnTgReserve → SLEARN (USDT, for processPayment burn release)
bin/m eng:opwallet:approve --name learntgreserve --token <USDT> --spender <SLEARN> --amount max
# Vault → SLEARN authorizedTransfers (for payScholarship SLEARN transfer)
bin/m eng:opwallet:send --name admin --to <SLEARN> --function "addAuthorizedTransfer(address)" --args "<VAULT>"
```

## 3. Emergency

```bash
bin/m eng:opwallet:send --name admin --to <SLEARN> --function "pause()"
bin/m eng:opwallet:send --name admin --to <SLEARN> --function "unpause()"
bin/m eng:opwallet:send --name admin --to <VAULT> --function "emergencyWithdrawUSDT(uint256)" --args "<amount>"
bin/m eng:opwallet:send --name admin --to <VAULT> --function "emergencyWithdrawSLEARN(uint256)" --args "<amount>"
```

`emergencyWithdraw*` transfers the tokens and leaves every `vaults[id].balance*` untouched.
That is how every migration empties the old vault (the same amount is sent to the new one
seconds later), so the tokens stay in the fund: what stays behind is the bookkeeping. On
2026-06-02 V2 was emptied with `emergencyWithdrawUsdt(8248137)` (block 68 480 390), the
8.248137 went straight into V3, and the retired course 106 kept its 8 USDT of bookkeeping up
to V5 (R-#221). Always run the §4 invariant check afterwards, and zero the courses that no
longer exist (or set their balance to what the new vault actually received).

## 4. Routine

```bash
# Course vault (amounts in smallest units: USDT 6 decimals, SLEARN 2 decimals)
bin/m eng:opwallet:send --name admin --to <VAULT> --function "createVault(uint256,uint256,uint256)" --args "<id>,<usdtAmount>,<slearnAmount>"

# Update per-guide amounts (e.g. add SLEARN to existing vault)
# Example: 1.0 USDT + 1.0 SLEARN per guide for course 2
bin/m eng:opwallet:send --name admin --to <VAULT> --function "setAmountPerGuide(uint256,uint256,uint256)" --args "2,1000000,100"

# Missional
bin/m eng:opwallet:send --name minter --to <SLEARN> --function "addMissionalCourse(uint256)" --args "<id>"
bin/m eng:opwallet:send --name minter --to <SLEARN> --function "removeMissionalCourse(uint256)" --args "<id>"
# Verify no orphan missional courses (must have a vault):
bin/m eng:opwallet:call --name admin --to <SLEARN> --function "getMissionalCourses()"

# MIGRATION RULE: after any setVaultBalance (V4→V5 style migrations) or
# emergencyWithdraw*, run the invariant check below and require it to pass.
# It exists because the books can claim more than the vault holds: course 106 kept
# 8 USDT of bookkeeping from V2 to V5 after an emergency withdrawal took the tokens
# (doc/LearnTGVaultsV6.md, R-#221).

# Accounting invariant of the scholarship vault (read-only; exit 1 on a gap).
# `payScholarship` only compares a course's recorded balance with the contract's whole
# balance, so if the recorded per-course balances add up to more than the tokens held the
# last students in line are paid partially or not at all (R-#221).
cd apps/web && make vault-check ARGS="--network celo --json"
#   --vault <addr>          check another vault (default: deployments/LearnTGVaults/V5/<net>.json
#                           or NEXT_PUBLIC_DEPLOYED_AT_V5)
#   --max-course-id <n>     last course id to scan (default 120)
# It also fails when SLEARN.learnTGVault and learnTGVaultSLEARN differ: the USDT half goes
# to the first and the SLEARN half is minted to the second, while both amounts are recorded
# on the first.

# Rate
bin/m eng:opwallet:send --name admin --to <SLEARN> --function "setUsdtToSlearnRate(uint256)" --args "<rate>"

# Key rotation
bin/m eng:opwallet:send --name admin --to <SLEARN> --function "grantRole(bytes32,address)" --args "<ROLE_HASH>,<addr>"
bin/m eng:opwallet:send --name admin --to <SLEARN> --function "revokeRole(bytes32,address)" --args "<ROLE_HASH>,<addr>"
```

## 5. Backend wallet gas (CELO) — incident 2026-08-24

En mainnet el backend wallet (`NEXT_PUBLIC_ADDRESS`, signer `0x358643…`) firma
`processPayment`/`processCountryDonation`. Si se queda sin CELO, el navegador
ve "Transaction … could not be found" o un 500 "total cost (gas * gas fee +
value) exceeds the balance" en el servidor, aunque las tx del usuario sí se
minaron (los tokens llegan al backend pero la donación/compra no se procesa).

- **Chequear saldo:** `bin/m eng:opwallet:balance --name <backend> --network celo`
- **Fijar:** enviar CELO al backend. Cada `processPayment` consume ~0.05-0.1 CELO;
  con 10-20 CELO hay holgura para cientos de operaciones.
- Monitorear el saldo junto con las métricas de donaciones/compras.

## 6. ClusterFundsV2 permissions (mainnet)

- `authorizedTransfers[V2] = true` y `MINTER_ROLE` otorgado en SLEARN mainnet
  (el cashback de donaciones usa `SLEARN.mintAndReserve`, que exige MINTER).
- El backend wallet también debe tener `MINTER_ROLE` en SLEARN (lo usa
  `processPayment`).
- Verificación read-only, sin escribir nada:
  `bin/m eng:opwallet:call --name admin --network celo --to 0x27fd41Bea85C39254f2B12789eB37a1543152CC1 --function "authorizedTransfers(address)" --args "<V2>"` (debe dar `true`).
  En <https://celo.blockscout.com> se revisan también `owner`, `donorCashbackPct`,
  `getFeeConfig` y los saldos por país de ClusterFundsV2 (y que V1 quede en 0).

## 7. RPC lag (forno)

forno (canónico) a veces retrasa indexar receipts recién minados. El backend
usa `fetchTxWithReceipt` (lib/backend-config.ts) que hace polling round-robin
en forno/ankr/drpc/publicnode/1rpc. Si un receipt "no se encuentra", verifica
que el deploy incluya este helper (requiere rebuild de producción).
