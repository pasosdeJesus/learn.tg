# SLEARN Integration Guide for External Apps

> *"Freely you have received; freely give"* (Matthew 10:8)

How external apps in the Pasos de Jesús ecosystem (e.g., `sivel.xyz`, `stable-sl.pdJ.app`)
mint SLEARN tokens directly for their users, replacing the legacy Learning Points API.

## 1. Quick Reference

| Item | Value |
|------|-------|
| Token | SLEARN (ERC-20, 2 decimals) |
| Network | Celo Mainnet (42220) |
| Rate | 1 USDT = 22 SLEARN (adjustable by admin, range 10-22) |
| **Mint function** | `mintAndReserve(address to, uint256 usdtAmount)` — **REQUIRED for external apps** |
| **Forbidden** | `mint()` — breaks reserve backing, do NOT use for external reward programs |

## 2. Getting MINTER_ROLE

An external app needs `MINTER_ROLE` on the SLEARN contract to mint tokens.
The SLEARN admin (learn.tg) grants this role.

### 2.1 Requesting MINTER_ROLE

Contact the SLEARN admin with:
- Your app's backend wallet address (the one that will sign mint transactions)
- Expected monthly SLEARN volume
- Purpose (e.g., donation rewards, course scholarships)

### 2.2 Admin grants the role

```bash
bin/m wallet:send --name admin --to <SLEARN_ADDRESS> \
  --function "grantRole(bytes32,address)" \
  --args "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6,<YOUR_BACKEND>"
```

> `0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6` = `keccak256("MINTER_ROLE")`

### 2.3 Verify MINTER_ROLE

```bash
bin/m wallet:call --name admin --to <SLEARN_ADDRESS> \
  --function "hasRole(bytes32,address)" \
  --args "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6,<YOUR_BACKEND>"
```

Returns `true` if the role is granted.

### 2.4 Side effect: transfer authorization

When `MINTER_ROLE` is granted, the wallet is automatically added to `authorizedTransfers`.
This means users can send SLEARN **to** your backend wallet (transfer restriction allows
sends to authorized addresses). Your backend is ready to receive SLEARN from users.

## 3. Minting SLEARN — `mintAndReserve()` (REQUIRED)

```solidity
function mintAndReserve(address to, uint256 usdtAmount)
  external onlyRole(MINTER_ROLE) whenNotPaused returns (uint256 slearnAmount);
```

This is **the only mint function external apps should use.** It guarantees every minted SLEARN
is fully backed by USDT in the reserve (Whitepaper §4).

**How it works:**

1. Your backend transfers USDT to the SLEARN contract
2. You call `mintAndReserve(to, usdtAmount)`
3. The contract sends that USDT to the hot reserve (`learnTgReserve`)
4. The contract mints SLEARN to `to` at the current `usdtToSlearnRate`
5. Returns the amount of SLEARN minted

**Prerequisites:**

| Requirement | How to fulfill |
|---|---|
| `MINTER_ROLE` | Admin grants it (§2) |
| USDT in SLEARN contract | Transfer USDT to SLEARN address **before** calling `mintAndReserve()` |
| `learnTgReserve` set | Already configured by learn.tg, verify with `learnTgReserve()` |
| USDT approval | One-time: your backend approves SLEARN contract to spend USDT |
| Contract not paused | `mintAndReserve` reverts if paused — call `paused()` to check |

**Critical rules:**

- **Transfer USDT FIRST.** The contract checks `usdt.balanceOf(address(this)) >= usdtAmount`. If you call `mintAndReserve` before transferring, it reverts with `"insufficient USDT balance"`.
- **`usdtAmount` is 6 decimals.** USDT uses 6 decimals. `100_000000` = 100 USDT.
- **SLEARN uses 2 decimals.** Check the return value or call `usdtToSLEARN(usdtAmount)` to get the exact SLEARN amount.
- **USDT goes to the global reserve,** not to the user. The user receives SLEARN. The USDT stays in `learnTgReserve` backing the token.
- **Rate is adjustable.** Admin can change `usdtToSlearnRate` (range 10-22). Always call `usdtToSLEARN(usdtAmount)` on-chain if you need the exact SLEARN amount before minting.

### 3.1 Two-step atomicity

`mintAndReserve` reads USDT from the **contract's balance**, not from `msg.sender`.
This means the contract has a shared USDT pool across all minters.

The two-step flow (transfer → mint) is **not atomic** on-chain. Between steps 1 and 2,
another minter could consume part of the shared balance, causing `mintAndReserve` to revert
with `"insufficient USDT balance"`.

**This is not a security vulnerability** (any wallet with `MINTER_ROLE` can call `mint()`
directly — shared pool can't be drained for profit), but it requires **proper retry logic**
to handle the occasional collision.

**Recommended pattern — retry on `insufficient USDT balance`:**

```typescript
async function mintWithRetry(
  donor: `0x${string}`,
  usdtAmount: bigint,
  maxRetries = 3,
): Promise<`0x${string}`> {
  const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`)
  const client = createWalletClient({ chain: celo, transport: http(), account })
  const slearn = process.env.NEXT_PUBLIC_SLEARN_ADDRESS as `0x${string}`

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Step 1: Transfer USDT to SLEARN contract (adds to shared pool)
    const transferHash = await client.writeContract({
      address: usdt, abi: USDT_ABI,
      functionName: 'transfer',
      args: [slearn, usdtAmount],
      chain: celo, account,
    })
    await client.waitForTransactionReceipt({ hash: transferHash })

    // Step 2: Mint SLEARN (consumes from shared pool)
    try {
      const hash = await client.writeContract({
        address: slearn, abi: SLEARN_ABI,
        functionName: 'mintAndReserve',
        args: [donor, usdtAmount],
        chain: celo, account,
      })
      await client.waitForTransactionReceipt({ hash })
      return hash
    } catch (err: any) {
      if (err.message?.includes('insufficient USDT balance') && attempt < maxRetries - 1) {
        // Another minter consumed our USDT before we could mint.
        // Re-transfer and retry (previous transfer already contributed to pool).
        console.warn(`[slearn] Collision, retrying (${attempt + 1}/${maxRetries})...`)
        await new Promise(r => setTimeout(r, 1000))
        continue
      }
      throw err
    }
  }
  throw new Error(`mintAndReserve failed after ${maxRetries} retries`)
}
```

**Why this works:**
- If the first transfer added 10 USDT to the shared pool but another minter consumed it,
  the retry adds another 10 USDT and tries again
- The donor still gets the correct SLEARN amount
- The total USDT in reserve is correct (multiple transfers, one successful mint per attempt)

**To minimize collision window** between steps 1 and 2:
- Use consecutive nonces (transfer at nonce N, mint at nonce N+1)
- Set a high `gasPrice` so both transactions land in the same or adjacent blocks
- Keep the backend single-threaded for mint operations (no parallel donations)

**TypeScript example (Viem, 2-step flow):**

```typescript
import { createWalletClient, http, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo } from 'viem/chains'

const SLEARN_ABI = parseAbi([
  'function mintAndReserve(address to, uint256 usdtAmount) external returns (uint256)',
  'function usdtToSLEARN(uint256 usdtAmount) view returns (uint256)',
])

const USDT_ABI = parseAbi([
  'function transfer(address to, uint256 amount) external returns (bool)',
])

async function mintWithReserve(donor: `0x${string}`, usdtAmount: bigint) {
  const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`)
  const client = createWalletClient({ chain: celo, transport: http(), account })
  const slearn = process.env.NEXT_PUBLIC_SLEARN_ADDRESS as `0x${string}`
  const usdt = process.env.NEXT_PUBLIC_USDT_ADDRESS as `0x${string}`

  // Step 1 (REQUIRED FIRST): Transfer USDT from your backend to SLEARN contract.
  // mintAndReserve pulls USDT from the contract's balance, so the contract
  // must have USDT BEFORE you call it.
  const transferHash = await client.writeContract({
    address: usdt, abi: USDT_ABI,
    functionName: 'transfer',
    args: [slearn, usdtAmount],
    chain: celo, account,
  })
  // Wait for confirmation
  await client.waitForTransactionReceipt({ hash: transferHash })

  // Step 2: Mint SLEARN. Contract sends USDT to hot reserve, mints SLEARN to donor.
  const hash = await client.writeContract({
    address: slearn, abi: SLEARN_ABI,
    functionName: 'mintAndReserve',
    args: [donor, usdtAmount],
    chain: celo, account,
  })

  return hash
}

// Donor gets ~2200 SLEARN (100 USDT × 22 rate)
await mintWithReserve('0xdonor...', 100_000000n) // 100 USDT (6 decimals)
```

> **For sivel.xyz:** donations already flow USDT. Send part of that USDT to the SLEARN
> contract, then call `mintAndReserve()` for the donor's SLEARN reward.

## 4. Checking SLEARN Balances

```typescript
import { createPublicClient, http, parseAbi } from 'viem'
import { celo } from 'viem/chains'

const BALANCE_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
])

async function getSlearnBalance(wallet: `0x${string}`): Promise<number> {
  const client = createPublicClient({ chain: celo, transport: http() })
  const balance = await client.readContract({
    address: process.env.NEXT_PUBLIC_SLEARN_ADDRESS as `0x${string}`,
    abi: BALANCE_ABI,
    functionName: 'balanceOf',
    args: [wallet],
  })
  return Number(balance) / 100 // SLEARN has 2 decimals
}
```

## 5. Transfer Restrictions

SLEARN has restricted transfers. Users can only send SLEARN **to** authorized addresses.

- **Authorized addresses** = wallets with `MINTER_ROLE` (backends) + manually added addresses
- `transfer()` checks: `authorizedTransfers[sender] || authorizedTransfers[to]`
- `transferFrom()` checks: `authorizedTransfers[from] || authorizedTransfers[spender]`

**For external apps:** if your backend has `MINTER_ROLE`, users can transfer SLEARN to you
automatically (MINTER_ROLE grants auto-authorization). This means users can pay you in SLEARN
for goods/services.

## 6. User Verification API

learn.tg provides a verification endpoint for partners to check if a user has completed
KYC via Self.xyz (passport verification). Returns identity data for verified users.

**`GET /api/verify?wallet=<address>&timestamp=<unix>&signature=<sig>`**

The request must be signed (EIP-191) by an authorized verifier. The message is:
```
keccak256(encodePacked(['address', 'uint256'], [wallet, timestamp]))
```

Timestamp must be within 5 minutes of the server's clock.

**Response:**

```json
// Verified user:
{ "verified": true, "name": "John Doe", "countryId": 694 }

// Not verified:
{ "verified": false }
```

**Authorization:** To use this endpoint, your backend address must be listed in
`AUTHORIZED_VERIFIERS` env var on learn.tg (comma-separated, supports env var resolution
like `SIVEL_ADDRESS`).

**Verification logic:** A user is verified when:
- `passport_name === usuario.nombre` (name matches Self.xyz credential)
- `passport_nationality === usuario.pais_id` (country matches)

If the user changes their name or country in their profile, verification is lost immediately.
This ensures the API is a living source of truth, not a one-time check.

## 7. Security Considerations

- **MINTER_ROLE is powerful** — it can mint unlimited SLEARN. Guard the private key.
- **Always use `mintAndReserve()`** — `mint()` breaks the reserve backing. Do not use it.
- **Check `paused()` before minting** — SLEARN may be paused during emergencies.
- **Verify rate before minting** — `usdtToSlearnRate` can change. Call `usdtToSLEARN(usdtAmount)` on-chain to get exact SLEARN amount.
- **Monitor hot reserve balance** — `mintAndReserve()` will revert if the contract has insufficient USDT.
- **Gas for Celo** — minting costs ~0.001 CELO. Keep the backend wallet funded.

## 8. Contract Addresses

| Network | SLEARN |
|---------|--------|
| Celo Sepolia | `0x9fBa3A2Ca0275c4D7A3eA341923f8c531e913BFA` |
| Celo Mainnet | `0x27fd41Bea85C39254f2B12789eB37a1543152CC1` |

## 9. learn.tg Internal (not for external apps)

These functions are used internally by learn.tg's donation and payment flows. External apps
should use `mintAndReserve()` instead.

### 9.1 processPayment — learn.tg donations and course payments

```solidity
function processPayment(
    address payer, uint256 usdtAmount, uint256 slearnAmount,
    uint256 courseId,
    uint256 percentagePdJ, uint256 percentageReward,
    uint256 percentageMissional, uint256 percentageUBI,
    uint256 percentageReferral, uint256 percentageChurches
) external onlyRole(MINTER_ROLE) nonReentrant whenNotPaused;
```

All-in-one function for learn.tg's donation and premium course payment flows. Users transfer
USDT/SLEARN to learn.tg's backend first, then the backend calls this. It pulls tokens,
burns SLEARN, releases backing USDT from hot reserve, distributes per percentages, and
auto-mints SLEARN rewards.

### 9.2 mint() — deprecated for external use

```solidity
function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused;
```

Mints SLEARN without adding USDT to the reserve. **Do not use for external reward programs.**
It breaks the reserve backing rule (Whitepaper §4). Only learn.tg may use it for migration
or emergency scenarios.

## 10. Related Documentation

- [SLEARN Whitepaper](../SLEARN-WHITEPAPER.md) — full economic model and tokenomics
- [SLEARN FAQ](../SLEARN-FAQ.md) — user-facing questions
- [Deploy SLEARN to Mainnet](deploy-slearn-mainnet.md) — deployment checklist
- [Runbook](runbook.md) — operations and emergency procedures

---

> *"Whatever you do, work at it with all your heart, as working for the Lord, not for human masters."* (Colossians 3:23)
