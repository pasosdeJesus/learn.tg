# SIWE Authentication Flow

How wallet-based authentication works in learn.tg — from wallet connection to API authorization.

## Overview

The platform uses **Sign-In With Ethereum (SIWE)** for passwordless authentication, but with a non-standard twist: the SIWE nonce (NextAuth CSRF token) doubles as the API authentication token stored in the database. NextAuth's JWT session only carries the user address for UI-level checks; actual API authorization is done by validating the token against the `billetera_usuario` table.

## Flow

```
User Wallet                Frontend                   NextAuth API Route              Database
    |                         |                              |                            |
    |--[1] connect wallet---->|                              |                            |
    |                         |--[2] getCsrfToken()--------->|                            |
    |                         |<---- nonce (CSRF token) -----|                            |
    |<--[3] sign SIWE msg ----|                              |                            |
    |    (includes nonce)     |                              |                            |
    |--[4] signature ------->|                              |                            |
    |                         |--[5] POST /api/auth/callback |                            |
    |                         |    {message, signature}      |                            |
    |                         |                              |--[6] siwe.verify()        |
    |                         |                              |    checks: signature,      |
    |                         |                              |    domain, nonce match      |
    |                         |                              |                            |
    |                         |                              |--[7] DB lookup/upsert ---->|
    |                         |                              |    WHERE LOWER(billetera)  |
    |                         |                              |    =LOWER(siwe.address)    |
    |                         |                              |                            |
    |                         |                              |    - New user: INSERT       |
    |                         |                              |      usuario +              |
    |                         |                              |      billetera_usuario      |
    |                         |                              |      (token = nonce)        |
    |                         |                              |    - Existing: UPDATE token  |
    |                         |                              |                            |
    |                         |<--[8] JWT session -----------|                            |
    |                         |    {sub: address}            |                            |
    |                         |    session.address = sub     |                            |
```

## Key Design Decisions

### 1. CSRF token = API auth token

The SIWE nonce (retrieved via NextAuth's `getCsrfToken()`) serves two purposes:
- **CSRF protection** during the SIWE handshake (standard)
- **API authentication token** stored in `billetera_usuario.token` and sent with every authenticated API request

This avoids a separate token generation step. The nonce is already a cryptographically random value tied to the session.

**Why not use the NextAuth JWT token directly?**

- The NextAuth JWT lives in an HTTP-only cookie — inaccessible to client-side JavaScript for inclusion in API request headers/params.
- Extracting and verifying the JWT server-side on every API call would require JWT decoding + signature verification, adding complexity and latency.
- The CSRF token is available client-side via `getCsrfToken()` and can be sent as a plain query/body parameter.
- Storing the token in `billetera_usuario` centralizes auth state in the database: one table links wallet → user → token. No JWT parsing needed — a simple string comparison suffices.
- Each SIWE sign-in generates a fresh nonce, effectively rotating the API token on every wallet connection.

### 2. Two-layer auth model

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| **UI / session** | NextAuth JWT (`session.address`) | Is the user logged in? Which address? |
| **API authorization** | `walletAddress` + `token` → DB lookup | Is this request authorized? |

The frontend checks `session.address` to decide page visibility. But every data-changing API call sends `walletAddress` + `token` as query/body params, and the API route validates them against `billetera_usuario` via `authenticateUser()`.

**Do not rely on `session.address` alone for API authorization** — use `authenticateUser()`.

### 3. Wallet address case normalization

All wallet addresses are stored and compared in **lowercase**:
- `billetera_usuario.billetera` is stored lowercase
- DB lookups use `LOWER(billetera) = LOWER(?)` (case-insensitive)
- `authenticateUser()` lowercases the incoming address before querying
- `session.address` is lowercased in the session callback
- Frontend address comparisons use `.toLowerCase()` on both sides (wagmi returns checksummed addresses)

## Code References

| Component | File | Key Lines |
|-----------|------|-----------|
| SIWE verification + DB upsert | `app/api/auth/auth-options.ts` | `authorize()` function, lines 40-244 |
| Session callback (lowercase) | `app/api/auth/auth-options.ts` | `callbacks.session`, line 259 |
| API token validation | `lib/authenticateUser.ts` | Full file (16 lines of logic) |
| Frontend auth guard pattern | `app/[lang]/profile/page.tsx` | `useEffect` at line 256 |
