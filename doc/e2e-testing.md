# E2E Testing

End-to-end testing for learn.tg uses `@pasosdejesus/m`'s test runner
(`bin/m test:e2e`). Tests are split into two categories: HTTP smoke tests
(no browser) and Puppeteer browser specs.

## Quick Reference

| Command | What | Needs Chrome? | Default target |
|---------|------|:---:|---|
| `make test-smoke` | HTTP smoke tests | ❌ | `https://learn.tg:9001` |
| `bin/m test:e2e` | Browser specs (falls back to smoke) | ✅ | `https://learn.tg:9001` |
| `bin/m test:e2e --smoke` | Smoke only | ❌ | `https://learn.tg:9001` |
| `bin/m test:e2e <pattern>` | Specific spec(s) | ✅ | `https://learn.tg:9001` |
| `bin/m test:e2e --grep <filter>` | Filter by name | ✅ | `https://learn.tg:9001` |

Override target: `SITE_URL=https://learn.tg bin/m test:e2e`

Chrome path: `CHROME_PATH=/usr/local/bin/chrome bin/m test:e2e`

## Smoke Tests (`e2e/smoke/`)

HTTP-only tests using `axios`. No browser required. Run in CI and locally
without display server.

Run with: `make test-smoke` or `bin/m test:e2e --smoke`

| Spec | What it tests |
|------|---------------|
| `auth-cookies.spec.mjs` | SIWE auth + session cookie + profile score update |
| `auth-ux.spec.mjs` | Landing page before/after auth, Connect Wallet button presence |
| `celo-claim.spec.mjs` | Full crossword → submit → scholarship claim flow |
| `full-journey.spec.mjs` | All endpoints: CSRF, SIWE, session, profile, crossword, UBI, signout |
| `leaderboard.spec.mjs` | Leaderboard page + API in ES and EN |
| `rails-auth.spec.mjs` | Rails API calls with auth token in ES and EN |

### Current Status (2026-07-15)

**5/6 passing.** `celo-claim.spec.mjs` fails because the test wallet hits the
24-hour cooldown period on the scholarship contract — not a bug.

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

## Browser Specs (`e2e/specs/`)

Puppeteer-based tests using `@pasosdejesus/m/e2e`'s `setupSIWEMock`.
Requires `CHROME_PATH` set (OpenBSD: `/usr/local/bin/chromium`).

Run with: `bin/m test:e2e` (without `--smoke`)

| Spec | What it tests |
|------|---------------|
| `connect-wallet-flow.spec.mjs` | Full Connect → SIWE sign → session → reload flow |
| `full-flow.spec.mjs` | Complete user journey: connect, view courses, crossword, claim |
| `auth-session.spec.mjs` | Session persistence across navigation |
| `celo-ubi-claim-sepolia.spec.mjs` | CELO UBI claim on Sepolia testnet |
| `church-persistence.spec.mjs` | Church data persistence in profile |
| `diag-session.spec.mjs` | Session diagnostic info |
| `guide-claims.spec.mjs` | Guide completion and claim flow |
| `nav-session-diag.spec.mjs` | Navigation + session diagnostics |
| `profile-data.spec.mjs` | Profile data loading and display |

### SIWE Mock

`e2e/helpers/siwe-wallet-mock.mjs` (migrated to `@pasosdejesus/m/e2e` as
`setupSIWEMock`) injects a mock `window.ethereum` into the Puppeteer page
with real ECDSA signing via `page.exposeFunction`. This enables:

- `eth_requestAccounts` → returns test wallet address
- `personal_sign` → real secp256k1 signature (no gas needed)
- `eth_chainId` → returns Celo Sepolia (11142220)
- `eth_sendTransaction` → simulated tx hash
- `eth_call` + `eth_getBalance` → simulated balances

### Requirements

- `puppeteer-core` (devDependency)
- `CHROME_PATH` set: `/usr/local/bin/chromium` (OpenBSD) or equivalent
- Test wallet in `apps/.env`: `PRIVATE_KEY` + `NEXT_PUBLIC_ADDRESS`
- Dev server running on `https://learn.tg:9001` (or set `IPDES` env var)

### Running a Single Spec

```sh
# By filename pattern
bin/m test:e2e connect-wallet-flow

# By name filter
bin/m test:e2e --grep "session"

# Against production
SITE_URL=https://learn.tg bin/m test:e2e --smoke
```

## Test Environment

All tests target the **development server** at `https://learn.tg:9001` by
default. This server runs locally or on the dev VM with the latest code.

Override with env vars:

| Variable | Default | Purpose |
|----------|---------|---------|
| `SITE_URL` | `https://learn.tg:9001` | Target site |
| `IPDES` | `learn.tg` | Hostname for SIWE domain validation |
| `CHROME_PATH` | — | Path to Chromium/Chrome binary |
| `PRIVATE_KEY` | From `apps/.env` | Test wallet private key |

## CI / Automated Testing

In CI, only smoke tests run (no display server). Puppeteer specs require
a graphical environment or `xvfb` and a Chrome binary.

```sh
# CI pipeline (smoke only)
make test-smoke

# Full pipeline (needs display + Chrome)
CHROME_PATH=/usr/bin/google-chrome make test-e2e
```

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| All specs fail with connection error | Dev server not running | Start with `bin/dev` on port 4000 |
| SSL errors | Self-signed cert | Tests use `rejectUnauthorized: false` |
| "CHROME_PATH not set" | No Chrome binary | Install chromium, set env var |
| Smoke `celo-claim` fails with "24 hours" | Test wallet cooldown | Wait 24h or use different wallet |
| Smoke `auth-ux` shows address ❌ | Client-rendered components | Use Puppeteer specs for UI verification |
| Rails API 401 "Different tokens" | Token mismatch between auth and API | Normal for new wallets; retry authenticating |

## Related Docs

- [SIWE Auth Flow](siwe-auth-flow.md) — Authentication protocol
- [Wallet Auth](wallet-auth.md) — Custom wallet implementation (no wagmi)
- [REQ/179.md](../REQ/179.md) — E2E testing infrastructure spec
