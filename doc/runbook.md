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
# Course vault
bin/m wallet:send --name admin --to <VAULT> --function "createVault(uint256,uint256,uint256)" --args "<id>,<usdt>,<slearn>"

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
