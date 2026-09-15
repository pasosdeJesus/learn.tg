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
```

### authorize() step by step

1. Validate hostname (`learn.tg`, `learntg.pdj.app`, or `:9001` for local dev)
2. Parse SIWE message
3. Verify chainId = 42220 (Celo mainnet) or 11142220 (Celo Sepolia) — reject if wrong network
4. `siwe.verify()` — checks signature against address, domain, nonce
5. Look up `billetera_usuario WHERE LOWER(billetera) = LOWER(siwe.address)`
6. New user → INSERT `usuario` + `billetera_usuario` (username = truncated address)
7. Existing user → UPDATE `usuario` (sign-in IPs, timestamps)
8. Return `{ id: siwe.address }` → NextAuth creates JWT session

> **R-#233 Fase 2 (2026-09-15):** no API token is created or stored. The session
> cookie (HttpOnly JWT, `sub` = wallet) is the only credential; `authorize()` no
> longer writes `billetera_usuario.token`, and `GET /api/auth/token`,
> `lib/auth-token.ts` and the `learn.tg.authToken` localStorage entry were
> removed. The SIWE nonce/CSRF is never persisted as a credential either: it is
> only the handshake nonce.

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

- Rails (`servidor/`) **no longer uses the token** (R-#233, 2026-09-14): the two
  endpoints it exposed (`proyectosfinancieros#index/#show`) return public course
  data and are now unauthenticated, and the unused
  `usuarios#actualiza_mi_usuario` was removed.
- **R-#233 Fase 2 (2026-09-15):** the column and the API token are gone. No
  client stores or sends a token: `authenticateUser()` authenticates only with
  the session cookie and the migration
  `db/migrations/20260915120000_drop_billetera_usuario_token.ts` removes
  `billetera_usuario.token`. The e2e specs use the session cookie (Node-side
  calls send the `Cookie` header captured from the browser context).

### 2. Two-layer auth model

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| **UI / session** | NextAuth JWT cookie (`session.address`) | Is the user logged in? Which address? |
| **API authorization** | session cookie (`sub` == `walletAddress`) | Is this request authorized? |

The frontend checks `session.address` to decide page visibility. Data-changing
API calls are cookie-authenticated; `walletAddress` travels only as an identity
hint that must match the session subject, and the route validates via
`authenticateUser()`.

**Do not rely on `session.address` alone for API authorization** — use `authenticateUser()`.

**Client pages must not gate wallet-scoped fetches on `session.address` alone.**
After a client-side navigation NextAuth's `useSession()` can be "cold" (returns
no address) while the wallet is still connected — see the known issue #5719.
Use the address from `useAuthAddress()` (session **or** the `learn.tg.sessionAddress`
localStorage fallback) to build `?walletAddress=…`; otherwise the fetch goes
**anonymous** and pages show
wrong/zero state (reported: a newly connected student saw the course in
"cooldown" and 0% progress until reconnecting). The single standard mechanism is
`lib/hooks/useAuthedApi.ts` (R-#235): its `ready` flag is false until the
identity resolves, so pages wait instead of querying anonymously. For the same
reason, treat an
unknown `canSubmit` (`null`) as *unknown* in the UI, never as "in cooldown".

**Wait for the identity instead of going anonymous or empty.** With a cold
session (#5719) a page must not fetch wallet-scoped data until the address
resolves. `lib/hooks/useAuthedApi.ts` (R-#235) exposes `ready` for that: it is
false until the component mounted and the session status settled, so pages wait
(never a token refresh, which no longer exists). Applied to the course
list/detail (`app/[lang]/page.tsx`, `lib/hooks/useCourse.ts`) and to the premium
guide content (`app/[lang]/[pathPrefix]/[pathSuffix]/page.tsx`), which previously
gated the fetch on `session?.address` and showed `401 auth_required` for
premium guides under a cold session.

**Order inside `authenticateUser()`:** the session cookie must be valid and its
`sub` must equal the requested wallet; anything else is a 401. Debug
tracing of the decision is gated behind `DEBUG_AUTH=1` (no PII). See
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
| API auth (session only) | `lib/authenticateUser.ts` | Full file |
| CSRF/origin middleware | `apps/nextjs/middleware.ts` | Full file |
| Frontend auth guard pattern | `app/[lang]/profile/page.tsx` | `useEffect` at ~line 256 |
