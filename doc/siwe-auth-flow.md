# SIWE Authentication Flow

How wallet-based authentication works in learn.tg — from wallet connection to API authorization.

> **See also:** [wallet-auth.md](wallet-auth.md) for the UI components and hooks
> (`ConnectWalletButton`, `useAuthAddress`, `useWriteContract`) that replaced
> RainbowKit + wagmi (R-#186).

## Overview

The platform uses **Sign-In With Ethereum (SIWE)** for passwordless authentication. NextAuth's JWT session (cookie; `sub` = the wallet that signed in, `usuarioId` = the account, `sessionEpoch` = its session epoch) is the identity for both UI-level checks and API authorization (session-first, R-#227; session-only, R-#233 Phase 2) and is the **only** credential. The SIWE nonce (NextAuth CSRF token) is used **only** as the handshake nonce, never as a persistent credential.

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
    |                         |                              |                             |
    |                         |                              |    - Existing: UPDATE       |
    |                         |                              |      usuario                |
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

`siwe_auth_attempt` and `siwe_auth_success` carry **`wallet_source`** in `event_data`
(https://github.com/pasosdeJesus/learn.tg/issues/246 §8): `in-app`, `window.ethereum` or
`eip6963:<rdns>` (`eip6963:io.metamask.mobile`). The client only *hints* it — the in-app
sign-in sends `in-app` (`lib/in-app-siwe.ts`) and `ConnectWalletButton` sends what
`externalWalletSource()` resolved from `window.ethereum` vs the EIP-6963 announcements
(`lib/external-provider.ts`) — and `sanitizeWalletSource()` in `auth-options.ts` validates
it against that short allowlist, storing `unknown` for anything else. This answers the open
question "do wallet browsers announce through EIP-6963?" with real sign-ins instead of
another manual round.

### Session

JWT-based (`strategy: 'jwt'`), with an explicit lifetime of 30 days (`maxAge`) refreshed
once a day (`updateAge`). No server-side session store is needed for the session itself:
the token carries

| Claim | Meaning |
|---|---|
| `sub` | The wallet address that signed in (checksummed); the request's hint. |
| `usuarioId` | The **account** the session belongs to (R-#265 §3.8: the identity is the account, not the wallet). |
| `sessionEpoch` | The account's `usuario.session_epoch` at sign-in. Bumping it (`UPDATE usuario SET session_epoch = session_epoch + 1`) revokes **every** session of that account (R-#250; a lost or shared phone). |

`authenticateUser()` accepts a request whose `walletAddress` hint is **any** wallet of
the token's account (`usuarioId`), and rejects it when the epoch no longer matches. A
token minted before these claims existed (no `usuarioId`/`sessionEpoch`) keeps the old
behaviour: the hint must equal `sub`.

## Key Design Decisions

### 1. Session-first API auth (R-#227); CSRF is only the SIWE nonce

**The NextAuth session cookie is the primary identity** for API authorization,
not a DB token:

- `authorize()` verifies the SIWE message whose nonce is the CSRF token
  (standard handshake), then creates the JWT session (`sub` = wallet).
- `authenticateUser()` validates the **session cookie** (JWT signed with
  `NEXTAUTH_SECRET`; the `walletAddress` hint must be a wallet of the token's account and
  the account's `session_epoch` must match); that is the only
  credential (no DB fallback since R-#233 Fase 2).
- The CSRF token is **never** persisted as an API credential.

**Why not carry the NextAuth JWT client-side?**

- The NextAuth JWT lives in an HTTP-only cookie — the server reads it directly
  via `getToken()`/`cookies()`; no client-side storage, no per-call JWT
  decode needed server-side beyond the existing `authenticateUser()`.
- CSRF for cookie-authenticated mutations is handled by the middleware
  (`Origin`/`Sec-Fetch-Site`, see `doc/api-security.md` and R-#227 §4.3),
  not by an app-level token in the body.

**Why there is no DB token**

- Rails (`servidor/`) no longer uses one (R-#233, 2026-09-14): the two
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
| **API authorization** | session cookie (`walletAddress` is a wallet of the token's account; `sessionEpoch` matches) | Is this request authorized? |

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

**The address is not the session.** After unlocking or reconnecting the in-app
wallet, `useAuthAddress()` already knows the address (wallet or localStorage) while
the NextAuth cookie still does not exist; `authenticateUser()` only accepts the
cookie, so a wallet-scoped fetch in that window is unauthenticated. The courses
page used to request `/api/scholarship` for every visible course and the route
answered `200` with `"Authentication failed."` in `retMessage`, which the page
turned into one destructive toast per course (operator report, 2026-10-17). The
page now waits for `useSession().status === 'authenticated'` before calling
`/api/profile` and `/api/scholarship`; the effect re-runs when the status changes,
and a lingering auth-only `retMessage` is logged instead of toasted.

**Diagnostics when the cause is different.** The gate, the skipped request, the
ignored auth message and a `401` are logged through `logger` with source
`Courses`; `useScholarshipData` logs `scholarship skipped: courseId=… target=…
ready=…` and any `message`/failure with source `scholarship`. In-app SIWE logs
`signIn: status=… ok=… error=…` (and the retry after linking an invitation) with
source `in-app-siwe`, and `WalletDialog` logs each caught error as
`wallet-dialog`. They reach the browser console always and the DebugConsole when
`NEXT_PUBLIC_M_DEBUGGER_CONSOLE=1` (see `doc/pdj-wallet-testing.md`).

**Order inside `authenticateUser()`:** the session cookie must be valid; its
`walletAddress` hint must belong to the token's account (`usuarioId`) and the account's
`session_epoch` must still match the token; anything else is a 401. Debug
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

### 5. The message chain ID is the app's chain, not the wallet's

`authorize()` rejects any `chainId` other than the one the site runs on
(`IS_PRODUCTION ? 42220 : 11142220`). Both clients send exactly that: the external
wallet flow reads the (already switched) `eth_chainId`, and the in-app flow builds the
message with `getAppChain().id` (`lib/in-app-siwe.ts`). It is **not** the network the
in-app wallet declares: signing does not depend on the network, so a wallet created on
Celo Sepolia can sign in on production and pay there after the payment's chain
pre-flight (`lib/ensure-chain.ts`, operator report 2026-09-27).

### 6. Linking a second wallet signs with the active wallet

Linking another wallet to the account (R-#265 §3.2) uses the same SIWE handshake, but the
signature comes from the **active** wallet: the in-app one when unlocked and not the
session's, otherwise the connected external one (`lib/wallet-link.ts`
`detectActiveWalletSigner`). The session's own wallet is discarded (it is already in the
account), so the control only does something when a *different* wallet is active. Enabling
a browser wallet does **not** grant the site access, so when `eth_accounts` is empty the
external wallet is asked with `eth_requestAccounts` (operator report, 2026-10-16); a
rejection is reported as a cancellation. The server verifies the message with the same
domain/chain/nonce policy (`lib/siwe-server.ts`) and then delegates to the `wallet` engine;
it never trusts the client's claim (`signatureVerified: true` is set by the route only after
a successful verification).

### 7. Invitations: the wallet that signs later, on its own device

`POST /api/wallet/link` needs **both** wallets in the same browser, in the act. The
invitation (R-#265 §3.2) covers the other case: account A invites an **address**; that
wallet opens learn.tg on its own device, signs and accepts.

1. The inviter needs a verified profile: `lib/wallet-invite-policy.ts` uses the profile
   score (≥ 50, the same bar as the on-chain rewards) and `POST /api/wallet/invite`
   answers `403` otherwise.
2. The invited wallet's **plain sign-in is refused**: `authorize()` does not create an
   account for a wallet with a pending invitation
   (`findPendingInvitation`, `app/api/auth/auth-options.ts`), otherwise the wallet would
   silently join the inviter's account or the invitation would become unusable. Legacy or
   expired invitations do not block.
3. The client sees the failed credentials POST and **probes** `POST /api/wallet/accept`
   without `confirm` (only whoever controls the address learns who invited it), asks for
   explicit consent and, if accepted, links the wallet and **retries the same
   `message`/`signature`** in `/api/auth/callback/credentials`: one signature serves to
   accept and to sign in (`lib/wallet-invitations.ts`, called from `lib/in-app-siwe.ts`
   and `components/ConnectWalletButton.tsx`).
4. The inviter can list and cancel pending invitations from the wallet panel's **Accounts**
   tab and from the profile (`components/InviteWalletControl.tsx` → `GET /api/wallet`
   `invitations`, `POST /api/wallet/cancel`).

Endpoint details live in `apps/web/app/api/doc/API.md` (`## Wallet`).

## Code References

| Component | File | Key Lines |
|-----------|------|-----------|
| SIWE verification + DB upsert | `app/api/auth/auth-options.ts` | `authorize()` function, ~lines 40-240 |
| Session callback (lowercase) | `app/api/auth/auth-options.ts` | `callbacks.session`, ~line 242 |
| API auth (session only) | `lib/authenticateUser.ts` | Full file |
| Server-side SIWE verification (shared policy) | `lib/siwe-server.ts` | Full file |
| Wallet linking (routes + client) | `app/api/wallet/link/route.ts`, `lib/wallet-link.ts`, `components/LinkWalletButton.tsx` | Full file |
| Wallet invitations (routes + client) | `app/api/wallet/{invite,accept,cancel}/route.ts`, `lib/wallet-account.ts`, `lib/wallet-invitations.ts`, `components/InviteWalletControl.tsx` | Full file |
| CSRF/origin middleware | `apps/web/middleware.ts` | Full file |
| Frontend auth guard pattern | `app/[lang]/profile/page.tsx` | `useEffect` at ~line 256 |
