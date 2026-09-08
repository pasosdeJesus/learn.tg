# API Security Rules & Route Audit

Scope: the Next.js API routes under `apps/nextjs/app/api/**` (route handlers that
touch the database or files). Rails (`servidor/`) and Web3 engines
(`packages/*`) have their own policies.

## 1. Route authentication rules

Every route handler that reads or writes sensitive data (database, files,
blockchain keys) must authenticate the caller. Three classes exist:

| Class | Meaning | How a route expresses it |
|---|---|---|
| **public** | No auth needed; only non-sensitive data or self-data | Listed in `PUBLIC_ENDPOINTS` of the audit script with a reason comment |
| **authenticated** | Any logged-in user (session cookie first; legacy `wallet`+`token` fallback) | `authenticateUser(db, wallet, token)` from `lib/authenticateUser.ts` |
| **admin-only** | Only verifier/admin wallets | `authenticateAdmin(db, wallet, token)` from `lib/admin-auth.ts` |

> **Auth model (R-#227, session-first):** `authenticateUser` validates the
> NextAuth session cookie first (JWT, `sub` == requested wallet, lowercase) and
> falls back to the `billetera_usuario.token` legacy path only for
> non-browser clients (Rails, specs). CSRF is never an API credential: each
> SIWE sign-in rotates a dedicated random token (256 bits) that the browser
> fetches from `GET /api/auth/token`. `AUTH_SESSION_ONLY=1` disables the legacy
> path to measure residual dependencies; `DEBUG_AUTH=1` adds gated no-PII
> tracing. See `doc/siwe-auth-flow.md`.

Rules:

1. **Default to authenticated.** A new route must call `authenticateUser`
   unless it is deliberately public (landing pages, place lists, blockchain
   read-only data). Do not leave auth code commented out: either the route is
   public (say so in a comment + `PUBLIC_ENDPOINTS`) or it authenticates.
2. **Admin-only = `authenticateAdmin`.** Do not approximate admin checks with
   commented code, `isVerifier` on unrelated paths, or duplicated wallet
   lists — use `lib/admin-auth.ts` (driven by `NEXT_PUBLIC_VERIFIER_WALLET`).
3. **Never expose third-party `nombre` (real name) on non-admin endpoints.**
   Public/authenticated endpoints may expose `nusuario` (username), scores and
   credentials; real names only to the owner (own profile, own ZK
   self-verify), to admins (admin-only routes or an explicit admin field such
   as `referral/lookup`'s `nombre` with explicit `wallet`+`token`), or to
   authorized partners (signature-gated KYC). Self-data endpoints stay in the
   audit's `NOMBRE_ADVISORY_ALLOW` list with the reason.
4. **No PII in logs.** Console logs in routes must not print `nombre`,
   `passport_name`, emails or identity fields; log booleans/reasons only.
5. **Public endpoints that return a private field** (e.g. `referral/lookup`)
   must gate that field behind admin credentials explicitly passed by the
   caller (`wallet`+`token`), never via the browser session cookie of a
   public page.

## 1b. CSRF / origin checks for mutations (R-#227 §4.3)

Cookie-authenticated APIs need CSRF protection on unsafe methods
(`POST`/`PUT`/`PATCH`/`DELETE`). `apps/nextjs/middleware.ts` rejects:

- `Sec-Fetch-Site` header = `cross-site` or `same-site` → **403** (browsers
  always send it; `same-site` is not trusted because sibling subdomains could
  forge requests). `same-origin`/`none` pass.
- No `Sec-Fetch-Site` (non-browser client: specs, scripts, Rails) with an
  `Origin` that does not match the request host → **403**.

Non-browser clients with neither header pass: a CSRF attacker needs a browser
(which always sends `Sec-Fetch-Site`), so there is no ambient-credentials
bypass. NextAuth keeps its own internal CSRF for `/api/auth/*`.

## 2. The route audit script

`apps/nextjs/bin/audit-api-auth.mjs` statically scans every `route.ts` under
`app/api` and classifies each sensitive endpoint (DB or file access):

```sh
cd apps/nextjs && node bin/audit-api-auth.mjs
```

| Marker | Meaning |
|---|---|
| `✅ … (public)` | Endpoint declared public (in `PUBLIC_ENDPOINTS`) |
| `🔒 … (admin-only)` | Authenticated and uses admin auth (`authenticateAdmin`) |
| `✅ … (authenticated)` | Authenticated as a regular user |
| `❌ …` | **DB/file access without auth** — the run fails (exit 1) |
| `ℹ️ …` | Advisory: selects the real `nombre` of a user, but it is allowed (see `NOMBRE_ADVISORY_ALLOW` for the reason) |
| `⚠️ …` | Advisory: selects `nombre` and is **not** in the allow list — review that the response does not expose it |

The audit does **not fail** on advisories (`ℹ️`/`⚠️`); it fails only on routes
that access the DB/files without any auth pattern (`❌`).

Detection patterns (auth, admin, DB, files, `nombre`) live at the top of the
script and are the source of truth; keep them in sync when the auth helpers
change.

### When to run it

- After **adding, removing, or modifying any `app/api/**/route.ts`** that
  touches the DB or files (before opening the PR).
- After changing `lib/authenticateUser.ts`, `lib/admin-auth.ts` or the auth
  env vars (`NEXT_PUBLIC_VERIFIER_WALLET`, `AUTHORIZED_VERIFIERS`).
- In CI, as a cheap static gate (it needs no server, no DB).

### How to fix the three things the audit reports

1. `❌ DB ACCESS WITHOUT AUTH`:
   - public by design → call `authenticateUser`/`authenticateAdmin`, or
   - truly public → declare it in `PUBLIC_ENDPOINTS` with a comment explaining
     why and which data it exposes (and ensure no third-party `nombre`).
2. New admin-only route → use `authenticateAdmin`; the audit marks it `🔒`.
3. New `⚠️` advisory → either stop selecting/returning `nombre` on that route,
   or add it to `NOMBRE_ADVISORY_ALLOW` with the exact reason (self-data,
   admin-gated field, not exposed in the response, etc.).
