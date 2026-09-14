# SIWE Authentication Flow

How wallet-based authentication works in learn.tg — from wallet connection to API authorization.

> **See also:** [wallet-auth.md](wallet-auth.md) for the UI components and hooks
> (`ConnectWalletButton`, `useAuthAddress`, `useWriteContract`) that replaced
> RainbowKit + wagmi (R-#186).

## Overview

The platform uses **Sign-In With Ethereum (SIWE)** for passwordless authentication. NextAuth's JWT session (cookie, `sub` = wallet address) is the **primary** identity for both UI-level checks and API authorization (session-first, R-#227); a dedicated API token stored in `billetera_usuario` is the legacy fallback for non-browser clients (Rails, specs). The SIWE nonce (NextAuth CSRF token) is used **only** as the handshake nonce, never as a persistent credential.

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
    |                         |                              |      (token = random 256b)  |
    |                         |                              |    - Existing: UPDATE token |
    |                         |                              |                            |
    |                         |<--[8] JWT session -----------|                            |
    |                         |    {sub: address}            |                            |
    |                         |    session.address = sub     |                            |
    |                         |                              |                            |
    |                         |--[9] GET /api/auth/token --->|                            |
    |                         |    (same session cookie)     |                            |
    |                         |<--- dedicated api token -----|                            |
```

### authorize() step by step

1. Validate hostname (`learn.tg`, `learntg.pdj.app`, or `:9001` for local dev)
2. Parse SIWE message
3. Verify chainId = 42220 (Celo mainnet) or 11142220 (Celo Sepolia) — reject if wrong network
4. `siwe.verify()` — checks signature against address, domain, nonce
5. Look up `billetera_usuario WHERE LOWER(billetera) = LOWER(siwe.address)`
6. New user → INSERT `usuario` + `billetera_usuario` (username = truncated address)
7. Existing user → UPDATE `billetera_usuario.token`, UPDATE `usuario` (sign-in IPs, timestamps)
8. Return `{ id: siwe.address }` → NextAuth creates JWT session

> **R-#227:** step 7 stores a **dedicated random API token** (256 bits, from
> `newApiToken()`) — the SIWE nonce/CSRF is never persisted as an API
> credential. The token is exposed to the browser later via `GET
> /api/auth/token` (same session cookie) and kept in localStorage as
> `learn.tg.authToken` for API calls / Rails; it is a *legacy fallback*
> because `authenticateUser` is now session-first. Since 2026-09-14 the token is
> generated on the first sign-in and **reused** afterwards (no longer rotated),
> so already-open tabs and token-only clients (Rails) keep working.

### Hostname Validation

Only these domains can authenticate:
- `learn.tg` and `learntg.pdj.app` (production)
- `learn.tg:9001` and `learntg.pdj.app:9001` (quickstart mode — proxies to live server)
- `localhost`, `localhost:4000`, `localhost:4300` (local development, non-production only)

### OKX Browser Detection

Multi-pattern UA check (`okx`, `okex`, `web3wallet`, `okxwallet`) to handle
OKX Wallet's embedded browser which uses multiple user-agent formats.

### Events Recorded

| Event | When | Purpose |
|-------|------|---------|
| `siwe_auth_attempt` | Before verification | Correlate login attempts |
| `siwe_wrong_network` | ChainId mismatch | Track wrong-network errors |
| `siwe_auth_success` | After successful auth | Track successful logins |

### Session

JWT-based (`strategy: 'jwt'`). Token contains `sub` = wallet address.
No server-side session store needed.

## Key Design Decisions

### 1. Session-first API auth (R-#227); CSRF is only the SIWE nonce

**The NextAuth session cookie is the primary identity** for API authorization,
not a DB token:

- `authorize()` verifies the SIWE message whose nonce is the CSRF token
  (standard handshake), then creates the JWT session (`sub` = wallet).
- `authenticateUser()` validates the **session cookie first** (JWT signed with
  `NEXTAUTH_SECRET`, `sub` == requested wallet, lowercase) and only falls back
  to the DB token for non-browser clients.
- The CSRF token is **never** persisted as an API credential.

**Why not carry the NextAuth JWT client-side?**

- The NextAuth JWT lives in an HTTP-only cookie — the server reads it directly
  via `getToken()`/`cookies()`; no client-side storage, no per-call JWT
  decode needed server-side beyond the existing `authenticateUser()`.
- CSRF for cookie-authenticated mutations is handled by the middleware
  (`Origin`/`Sec-Fetch-Site`, see `doc/api-security.md` and R-#227 §4.3),
  not by an app-level token in the body.

**Why keep a DB token at all (legacy)?**

- Rails (`servidor/`) and non-browser clients (e2e specs, scripts)
  authenticate exclusively against `billetera_usuario.token`, so the column
  and the legacy path stay during the migration. Since 2026-09-14 `authorize()`
  no longer rotates the token: it generates the **dedicated random token**
  (`newApiToken()`, 256 bits) on the first sign-in and reuses it afterwards,
  exposed to the browser via `GET /api/auth/token` and stored in localStorage as
  `learn.tg.authToken`. Removing the column is pending the Rails migration
  (R-#233).
- Legacy-token staleness is harmless **for Next.js API routes** (the session
  cookie authorizes regardless of the DB token), but **not for the Rails
  endpoints** (`proyectosfinancieros.json`, `presenta_curso`): Rails validates
  `billetera_usuario.token == token`, so a stale token answers `401` there.
  Recover by fetching a fresh dedicated token and retrying (below).

### 2. Two-layer auth model

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| **UI / session** | NextAuth JWT cookie (`session.address`) | Is the user logged in? Which address? |
| **API authorization** | session cookie first; `walletAddress` + `token` legacy fallback | Is this request authorized? |

The frontend checks `session.address` to decide page visibility. Data-changing
API calls are cookie-authenticated (browser) or send `walletAddress` + `token`
(non-browser), and the route validates via `authenticateUser()`.

**Do not rely on `session.address` alone for API authorization** — use `authenticateUser()`.

**Client pages must not gate wallet-scoped fetches on `session.address` alone.**
After a client-side navigation NextAuth's `useSession()` can be "cold" (returns
no address) while the wallet is still connected — see the known issue #5719.
Use the address from `useAuthAddress()` (session **or** the `learn.tg.sessionAddress`
localStorage fallback) and the token from `getApiToken()` to build
`?walletAddress=…&token=…`; otherwise the fetch goes **anonymous** and pages show
wrong/zero state (reported: a newly connected student saw the course in
"cooldown" and 0% progress until reconnecting). For the same reason, treat an
unknown `canSubmit` (`null`) as *unknown* in the UI, never as "in cooldown".

**Recover from a stale token instead of going anonymous or empty.** If the
stored token is obsolete (e.g. `GET /api/auth/token` failed during the first
login and the legacy CSRF was kept, or another tab rotated the token), Rails
answers `401`; the page must fetch `/api/auth/token` again
(`refreshApiToken()` in `lib/auth-token.ts`) and retry **once**, reusing the
still-valid session cookie. Applied to the course list/detail
(`app/[lang]/page.tsx`, `lib/hooks/useCourse.ts`) and to the premium guide
content (`app/[lang]/[pathPrefix]/[pathSuffix]/page.tsx`), which previously
gated the fetch on `session?.address` and showed `401 auth_required` for
premium guides under a cold session.

**Order inside `authenticateUser()`:** (1) session cookie valid and
`sub` == wallet → OK; (2) `AUTH_SESSION_ONLY=1` and no session → 401 (used to
measure residual token dependencies); (3) legacy DB token match → OK. Debug
tracing of every path is gated behind `DEBUG_AUTH=1` (no PII). See
`lib/authenticateUser.ts`.

### 3. Wallet address case normalization

All wallet addresses are stored and compared in **lowercase**:
- `billetera_usuario.billetera` is stored lowercase
- DB lookups use `LOWER(billetera) = LOWER(?)` (case-insensitive)
- `authenticateUser()` lowercases the incoming address before querying
- `session.address` is lowercased in the session callback
- Frontend address comparisons use `.toLowerCase()` on both sides

### 4. Domain binding is port-sensitive

`authorize()` verifies the SIWE `domain` against
`new URL('https://' + validHostname).host`, where `validHostname` comes from
the `x-forwarded-host` / `host` header. The client signs
`domain = window.location.host`, which includes the port on non-default ports
(e.g. `learn.tg:9001`). If a reverse proxy forwards `Host: $host` (port
stripped), the server verifies `learn.tg` against the client's `learn.tg:9001`
and `siwe.verify()` fails with `DOMAIN_MISMATCH` → `401 CredentialsSignin`.

The proxy must preserve the port:

```nginx
proxy_set_header Host $http_host;   # NOT $host
```

This only matters on non-default ports (`:9001`); production (`:443`) is
unaffected because `$host` and `$http_host` are both `learn.tg`.

## Code References

| Component | File | Key Lines |
|-----------|------|-----------|
| SIWE verification + DB upsert | `app/api/auth/auth-options.ts` | `authorize()` function, ~lines 40-240 |
| Session callback (lowercase) | `app/api/auth/auth-options.ts` | `callbacks.session`, ~line 242 |
| API auth (session-first + legacy) | `lib/authenticateUser.ts` | Full file |
| Dedicated API token endpoint | `app/api/auth/token/route.ts` | Full file |
| CSRF/origin middleware | `apps/nextjs/middleware.ts` | Full file |
| Frontend auth guard pattern | `app/[lang]/profile/page.tsx` | `useEffect` at ~line 256 |
