# SLEARN Operations Runbook

Operational procedures via `bin/m wallet:*`. No `cast` required.

> **Prerequisite:** Import wallets:
> ```bash
> bin/m wallet:import --name admin --private-key <ADMIN_KEY>
> bin/m wallet:import --name minter --private-key <MINTER_KEY>
> bin/m wallet:import --name learntgreserve --private-key <L2_KEY>
> ```
> Default network is `celoSepolia`. Use `--network celo` for mainnet.

## 1. Monitoring

```bash
bin/m wallet:balance --name admin --token <USDT_ADDRESS>
bin/m wallet:call --name admin --to <SLEARN> --function "totalSupply()"
bin/m wallet:call --name admin --to <USDT> --function "allowance(address,address)" --args "<RESERVE>,<SLEARN>"
```

## 2. Allowances (One-Time)

Run `bin/configSLEARN` to set all allowances automatically. Manual equivalents:

```bash
# Backend → SLEARN (USDT)
bin/m wallet:approve --name backend --token <USDT> --spender <SLEARN> --amount max
# Backend → SLEARN (SLEARN)
bin/m wallet:approve --name backend --token <SLEARN> --spender <SLEARN> --amount max
# Backend → backend (self-approval for OZ v5 transferFrom)
bin/m wallet:approve --name backend --token <SLEARN> --spender <BACKEND> --amount max
# learnTgReserve → SLEARN (USDT, for processPayment burn release)
bin/m wallet:approve --name learntgreserve --token <USDT> --spender <SLEARN> --amount max
# Vault → SLEARN authorizedTransfers (for payScholarship SLEARN transfer)
bin/m wallet:send --name admin --to <SLEARN> --function "addAuthorizedTransfer(address)" --args "<VAULT>"
```

## 3. Emergency

```bash
bin/m wallet:send --name admin --to <SLEARN> --function "pause()"
bin/m wallet:send --name admin --to <SLEARN> --function "unpause()"
bin/m wallet:send --name admin --to <VAULT> --function "emergencyWithdrawUSDT(uint256)" --args "<amount>"
bin/m wallet:send --name admin --to <VAULT> --function "emergencyWithdrawSLEARN(uint256)" --args "<amount>"
```

## 4. Routine

```bash
# Course vault (amounts in smallest units: USDT 6 decimals, SLEARN 2 decimals)
bin/m wallet:send --name admin --to <VAULT> --function "createVault(uint256,uint256,uint256)" --args "<id>,<usdtAmount>,<slearnAmount>"

# Update per-guide amounts (e.g. add SLEARN to existing vault)
# Example: 1.0 USDT + 1.0 SLEARN per guide for course 2
bin/m wallet:send --name admin --to <VAULT> --function "setAmountPerGuide(uint256,uint256,uint256)" --args "2,1000000,100"

# Missional
bin/m wallet:send --name minter --to <SLEARN> --function "addMissionalCourse(uint256)" --args "<id>"
bin/m wallet:send --name minter --to <SLEARN> --function "removeMissionalCourse(uint256)" --args "<id>"
# Verify no orphan missional courses (must have a vault):
bin/m wallet:call --name admin --to <SLEARN> --function "getMissionalCourses()"

# Rate
bin/m wallet:send --name admin --to <SLEARN> --function "setUsdtToSlearnRate(uint256)" --args "<rate>"

# Key rotation
bin/m wallet:send --name admin --to <SLEARN> --function "grantRole(bytes32,address)" --args "<ROLE_HASH>,<addr>"
bin/m wallet:send --name admin --to <SLEARN> --function "revokeRole(bytes32,address)" --args "<ROLE_HASH>,<addr>"
```

## 3. Backend wallet gas (CELO) — incident 2026-08-24

En mainnet el backend wallet (`NEXT_PUBLIC_ADDRESS`, signer `0x358643…`) firma
`processPayment`/`processCountryDonation`. Si se queda sin CELO, el navegador
ve "Transaction … could not be found" o un 500 "total cost (gas * gas fee +
value) exceeds the balance" en el servidor, aunque las tx del usuario sí se
minaron (los tokens llegan al backend pero la donación/compra no se procesa).

- **Chequear saldo:** `bin/m wallet:balance --name <backend> --network celo`
- **Fijar:** enviar CELO al backend. Cada `processPayment` consume ~0.05-0.1 CELO;
  con 10-20 CELO hay holgura para cientos de operaciones.
- Monitorear el saldo junto con las métricas de donaciones/compras.

## 4. ClusterFundsV2 permissions (mainnet)

- `authorizedTransfers[V2] = true` y `MINTER_ROLE` otorgado en SLEARN mainnet
  (el cashback de donaciones usa `SLEARN.mintAndReserve`, que exige MINTER).
- El backend wallet también debe tener `MINTER_ROLE` en SLEARN (lo usa
  `processPayment`).
- Verificación read-only: `scripts/verify-mainnet-v2.cjs` (apps/nextjs).

## 5. RPC lag (forno)

forno (canónico) a veces retrasa indexar receipts recién minados. El backend
usa `fetchTxWithReceipt` (lib/backend-config.ts) que hace polling round-robin
en forno/ankr/drpc/publicnode/1rpc. Si un receipt "no se encuentra", verifica
que el deploy incluya este helper (requiere rebuild de producción).
