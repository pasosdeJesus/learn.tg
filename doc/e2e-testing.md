# E2E Testing

End-to-end testing for learn.tg uses `@pasosdejesus/m`'s test runner
(`bin/m test:e2e`). Tests are split into two categories: HTTP smoke tests
(no browser) and Puppeteer browser specs.

## Quick Reference

| Command | What | Needs Chrome? | Default target |
|---------|------|:---:|---|
| `make test-smoke` | All HTTP smoke tests | ❌ | `https://learn.tg:9001` |
| `make test-e2e` | All browser specs | ✅ | `https://learn.tg:9001` |
| `make test-e2e-<name>` | Single browser spec by filename pattern | ✅ | `https://learn.tg:9001` |
| `bin/m test:e2e` | Browser specs (falls back to smoke if none found) | ✅ | `https://learn.tg:9001` |
| `bin/m test:e2e --smoke` | Smoke only | ❌ | `https://learn.tg:9001` |
| `bin/m test:e2e <pattern>` | Specific spec(s) matching filename | ✅ | `https://learn.tg:9001` |
| `bin/m test:e2e --grep <filter>` | Filter specs by test name | ✅ | `https://learn.tg:9001` |

Override target: `SITE_URL=https://learn.tg bin/m test:e2e`

Chrome path: `CHROME_PATH=/usr/local/bin/chrome bin/m test:e2e`

## `bin/m test:e2e` in Detail

The runner (`@pasosdejesus/m/e2e`) searches `e2e/specs/` first (browser),
then falls back to `e2e/smoke/` (HTTP) with a warning when no browser specs
match the pattern.

```sh
# Run all browser specs
bin/m test:e2e

# Run smoke tests only (no Chrome needed)
bin/m test:e2e --smoke

# Run a single spec by filename substring
bin/m test:e2e connect-wallet-flow        # → e2e/specs/connect-wallet-flow.spec.mjs
bin/m test:e2e leaderboard                # → e2e/smoke/leaderboard.spec.mjs

# Filter by test name inside a spec file
bin/m test:e2e --grep "session"

# Run against production
SITE_URL=https://learn.tg bin/m test:e2e --smoke
```

Each spec is a standalone Node.js script — you can also run them directly:

```sh
CHROME_PATH=/usr/local/bin/chrome node e2e/specs/connect-wallet-flow.spec.mjs
node e2e/smoke/leaderboard.spec.mjs
```

## Smoke Tests (`e2e/smoke/`)

HTTP-only tests using `axios` (some use `fetch`). No browser required.
Run in CI and locally without display server.

Run with: `make test-smoke` or `bin/m test:e2e --smoke`

| Spec | What it tests |
|------|---------------|
| `auth-cookies.spec.mjs` | SIWE auth + session cookie + profile score update |
| `auth-ux.spec.mjs` | Landing page before/after auth, Connect Wallet button presence |
| `caldav-completa.spec.mjs` | CalDAV full cycle: create event, list, verify, delete (Radicale) |
| `caldav-http.spec.mjs` | CalDAV connectivity: PROPFIND, OPTIONS to Radicale |
| `celo-claim.spec.mjs` | Full crossword → submit → scholarship claim flow |
| `full-journey.spec.mjs` | All endpoints: CSRF, SIWE, session, profile, crossword, UBI, signout |
| `landing-page.spec.mjs` | `/en` and `/es` return 200, no "Failed to load courses" error |
| `leaderboard.spec.mjs` | Leaderboard page + API in ES and EN |
| `prerequisites.spec.mjs` | Wallet registration + verifier check + profile setup + self-verify → ≥50 score |
| `rails-auth.spec.mjs` | Rails API calls with auth token in ES and EN |
| `verification-timezone.spec.mjs` | Verification availability API: timezone handling, 7-day window |

### Current Status (2026-07-28)

**10 smokes.** `leaderboard.spec.mjs` fails on profileScore explanation text
not rendered (minor content issue). `rails-auth.spec.mjs` shows token mismatch
for new wallets (expected for wallets without Rails-side session).
`caldav-*` smokes skip gracefully when `CALDAV_URL` is not set.

### Known Limitation: Client-Rendered Auth UI

`auth-ux.spec.mjs` checks for "Connect Wallet" button absence and wallet
address presence via raw HTTP response. Since `ConnectWalletButton`,
`WalletEventListener`, and `Header` are all client-rendered (React
`useSession`), these elements don't appear in the server-side HTML.

The test currently shows:
```
"Connect Wallet" absent: ❌
Wallet address visible: ❌
```
These are **false negatives** — the UI works correctly in the browser.
Full verification requires Puppeteer E2E specs (see below).

## Wallet Prerequisites for Browser Specs

Browser specs (`full-flow.spec.mjs`, `celo-ubi-claim-sepolia.spec.mjs`,
`guide-claims.spec.mjs`) run against the **development server** at
`https://learn.tg:9001` (a different server, not localhost). They require
a test wallet that is:

1. **Registered** on the dev server — SIWE sign-in must work
2. **Whitelisted** as a verifier — listed in `NEXT_PUBLIC_VERIFIER_WALLET`
   on the dev server
3. Has **profile score ≥ 50** — needed for crossword rewards and UBI claims

### Automated Setup: `prerequisites.spec.mjs`

Run this smoke test before any browser spec to ensure the wallet is ready:

```sh
bin/m test:e2e prerequisites
```

It performs the full setup via HTTP API calls:

| Step | API Call | What it does |
|------|----------|--------------|
| 1 | `POST /api/auth/callback/credentials` | SIWE sign-in with `apps/.env` wallet |
| 2 | `GET /api/admin/check-verifier` | Confirms verifier role |
| 3 | `PATCH /api/profile` | Sets `nombre`, `email`, `whatsapp`, `place_of_worship` |
| 4 | `PATCH /api/admin/user/:id` | Self-verifies: `passport_name`, `passport_nationality`, `verified_email`, `verified_whatsapp`, `verified_place_of_worship` |
| 5 | `GET /api/profile` | Confirms `profilescore ≥ 50` (77 pts expected) |

The wallet in `apps/.env` must already be registered and have verifier
privileges on the dev server. See [Developer Wallet Whitelist](../apps/nextjs/README.md#developer-wallet-whitelist)
in the Next.js README.

## Browser Specs (`e2e/specs/`)

Puppeteer-based tests using `@pasosdejesus/m/e2e`'s test harness
(`initTestEnv`, `launchBrowser`, `setupSIWEMock`, `ok`/`fail`/`summary`).
Requires `CHROME_PATH` set (OpenBSD: `/usr/local/bin/chromium`).

Run with: `bin/m test:e2e` (without `--smoke`) or `make test-e2e`

### Naming Convention

| Prefix | Target | Port | Use |
|--------|--------|------|-----|
| *(none)* | Dev server | `:9001` | Default — daily development |
| `prod-` | Production | `:443` | Smoke-check live site |

Specs prefixed with `prod-` run against the production site at
`https://learn.tg`. They use `PUERTOPRU=443` and a production wallet
(not the same as the dev wallet). See `prod-landing-to-profile.spec.mjs`
for an example.

### Spec Index

| Spec | What it tests |
|------|---------------|
| `connect-wallet-flow.spec.mjs` | Full Connect → SIWE sign → session → reload flow |
| `full-flow.spec.mjs` | Complete user journey: connect → profile fill → admin self-verify → courses → crossword → UBI claim → disconnect |
| `auth-session.spec.mjs` | Session persistence across navigation |
| `celo-ubi-claim-sepolia.spec.mjs` | CELO UBI claim on Sepolia testnet |
| `church-persistence.spec.mjs` | Church data persistence in profile |
| `diag-session.spec.mjs` | Session diagnostic info |
| `guide-claims.spec.mjs` | Guide completion and claim flow |
| `nav-session-diag.spec.mjs` | Navigation + session diagnostics |
| `profile-data.spec.mjs` | Profile data loading and display |
| `admin-dashboard.spec.mjs` | Admin dashboard: widgets load, APIs respond, user/church detail, PATCH |
| `prod-landing-to-profile.spec.mjs` | Production landing page → wallet connect → profile save flow |
| `town-autocomplete.spec.mjs` | Town search API + profile autocomplete UI (Sierra Leone data) |

### Current Status (2026-07-28)

**12 specs.** `full-flow.spec.mjs` — now fills profile and self-verifies
via admin API to reach ≥50 score before crossword/UBI steps.
`prod-landing-to-profile.spec.mjs` fails on wallet connection timing (React
hydration on OpenBSD). Pre-existing, not a regression.

### SIWE Mock

`e2e/helpers/siwe-wallet-mock.mjs` (migrated to `@pasosdejesus/m/e2e` as
`setupSIWEMock`) injects a mock `window.ethereum` into the Puppeteer page
with real ECDSA signing via `page.exposeFunction`. This enables:

- `eth_requestAccounts` → returns test wallet address
- `personal_sign` → real secp256k1 signature (no gas needed)
- `eth_chainId` → returns Celo Sepolia (11142220)
- `eth_sendTransaction` → simulated tx hash
- `eth_call` + `eth_getBalance` → simulated balances

Usage in specs:

```js
import { initTestEnv, launchBrowser, setupSIWEMock, ok, fail, summary } from '@pasosdejesus/m/e2e'

const TEST_PRIVATE_KEY = process.env.PRIVATE_KEY
const TEST_ADDRESS = process.env.NEXT_PUBLIC_ADDRESS

const page = await browser.newPage()
await setupSIWEMock(page, TEST_ADDRESS, TEST_PRIVATE_KEY)
await page.goto(SITE_URL)
// Wallet is now mocked — SIWE sign-in works without real wallet
```

The mock survives page reloads (injected via `evaluateOnNewDocument`).

### Requirements

- `puppeteer-core` (devDependency in `apps/nextjs/package.json`)
- `CHROME_PATH` set: `/usr/local/bin/chromium` (OpenBSD) or equivalent
- Test wallet in `apps/.env`: `PRIVATE_KEY` + `NEXT_PUBLIC_ADDRESS`
- Dev server running on `https://learn.tg:9001` (or set `IPDES` env var)

## Test Environment

All tests target the **development server** at `https://learn.tg:9001` by
default. This server runs locally or on the dev VM with the latest code.

Override with env vars:

| Variable | Default | Purpose |
|----------|---------|---------|
| `SITE_URL` | `https://learn.tg:9001` | Target site |
| `IPDES` | `learn.tg` | Hostname for SIWE domain validation |
| `CHROME_PATH` | — | Path to Chromium/Chrome binary (required for browser specs) |
| `PRIVATE_KEY` | From `apps/.env` | Test wallet private key |
| `NEXT_PUBLIC_ADDRESS` | From `apps/.env` | Test wallet address |
| `CALDAV_URL` | — | Radicale/CalDAV server URL (smoke: `caldav-*`) |
| `CALDAV_USER` | — | CalDAV username (smoke: `caldav-*`) |
| `CALDAV_PASS` | — | CalDAV password (smoke: `caldav-*`) |

CalDAV smokes skip gracefully when these are not set:

```
ℹ️  CALDAV not configured — skipping CalDAV smoke test
```

## CI / Automated Testing

In CI, only smoke tests run (no display server). Puppeteer specs require
a graphical environment or `xvfb` and a Chrome binary.

```sh
# CI pipeline (smoke only)
make test-smoke

# Full pipeline (needs display + Chrome)
CHROME_PATH=/usr/bin/google-chrome make test-e2e
```

## OpenBSD / adJ Specifics

- Chrome 141+ requires `--ozone-platform=headless` (handled by `@pasosdejesus/m/e2e`)
- Clean `/tmp/puppeteer*` between runs if Chrome hangs
- `CHROME_PATH=/usr/local/bin/chromium`
- Self-signed cert: tests use `NODE_TLS_REJECT_UNAUTHORIZED=0` internally

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| All specs fail with connection error | Dev server not running | Start with `bin/dev` on port 4000 |
| SSL errors | Self-signed cert | Tests use `rejectUnauthorized: false` |
| "CHROME_PATH not set" | No Chrome binary | Install chromium, set env var |
| Smoke `celo-claim` fails with "24 hours" | Test wallet cooldown | Wait 24h or use different wallet |
| Smoke `auth-ux` shows address ❌ | Client-rendered components | Use Puppeteer specs for UI verification |
| Rails API 401 "Different tokens" | Token mismatch between auth and API | Normal for new wallets; retry authenticating |
| Chrome hangs on OpenBSD | Zombie Puppeteer processes | `rm -rf /tmp/puppeteer*` and retry |
| CalDAV smokes skipped | `CALDAV_URL` not set | Set env vars if CalDAV testing is needed |
| `full-flow.spec.mjs` UBI claim fails | Test wallet profile score < 50 | Run `bin/m test:e2e prerequisites` to set up |

## Related Docs

- [SIWE Auth Flow](siwe-auth-flow.md) — Authentication protocol
- [Wallet Auth](wallet-auth.md) — Custom wallet implementation (no wagmi)
- [REQ/179.md](../REQ/179.md) — E2E testing infrastructure spec
- [apps/nextjs/CONTRIBUTING.md](../apps/nextjs/CONTRIBUTING.md) — Testing policy and coverage targets
