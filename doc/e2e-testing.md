# E2E Testing

End-to-end tests for learn.tg run on `@pasosdejesus/m`'s runner (`bin/m test:e2e`).
There are two kinds:

- **HTTP smoke tests** (`apps/web/e2e/smoke/`) — axios/fetch, no browser.
- **Browser specs** (`apps/web/e2e/specs/`) — Puppeteer through the shared helpers.

Related: [SIWE auth flow](siwe-auth-flow.md), [wallet auth](wallet-auth.md),
[environments](environments.md), [API security](api-security.md), and the
[app's testing policy](../apps/web/CONTRIBUTING.md).

---

## 1. Where the suites run

| Environment | URL | Chain | How it is served |
|-------------|-----|-------|------------------|
| **Local** | `http://localhost:4000` | `11142220` | `bin/dev` / `next dev` on this machine |
| **Dev site** | `https://learn.tg:9001` | `11142220` | Shared development server (operator deploys) |
| **Production** | `https://learn.tg` | `42220` | Live site (operator deploys) |

The default target of the `make` shortcuts is the **dev site**. Production has
its own section, [§2](#2-production-read-only-checks), because almost every
suite writes.

### 1.1 Quick reference (`apps/web/Makefile`)

| Command | What | Chrome? | Target |
|---------|------|:---:|--------|
| `make test-smoke-prod` | Read-only smoke set (GET only) | no | **production** |
| `make test-smoke` | All HTTP smoke tests | no | dev site `:9001` |
| `make test-smoke-multiwallet` | `SPEC=multiwallet-rules` (R-#265) | no | dev site `:9001` |
| `make test-e2e` | All browser specs | yes | dev site `:9001` |
| `make test-e2e-retry` | Browser specs + per-spec retry of failures | yes | dev site `:9001` |
| `make test-e2e-spec SPEC=<pattern>` | One spec (or a family) by name | yes | dev site `:9001` |
| `make test-e2e-wallet` | `SPEC=in-app-wallet` (R-#245) | yes | dev site |
| `make test-e2e-biometric` | `SPEC=biometric-unlock` (R-#246) | yes | dev site |
| `make test-e2e-collectibles` | `SPEC=wallet-panel-collectibles` (R-#249) | yes | dev site |
| `make test-e2e-offline` | `SPEC=offline` (guide + crossword + download) | yes | dev site |
| `make test-e2e-two-courses` | `SPEC=offline-two-courses` (R-#242) | yes | dev site |
| `make test-e2e-pwa` | wallet + offline | yes | dev site |
| `make test-e2e-gooddollar-not-whitelisted` | Browser check on mainnet, **no transactions** | yes | **production** |
| `bin/m test:e2e:summary <log…>` | Compare the results of two or more runs | no | local files |

The browser targets (`test-e2e`, `test-e2e-retry`, `test-e2e-spec` and the
shortcuts) export `IPDES=learn.tg PUERTOPRU=9001 CHAIN_ID=11142220`; the smoke
specs default to `:9001` themselves, `test-smoke-prod` sets
`SITE_URL=https://learn.tg`, and the `prod-*` specs force `443`/`42220` on their
own. Override with `IPDES=… PUERTOPRU=… CHAIN_ID=…` or `SITE_URL=…`.

### 1.2 `bin/m test:e2e` without `make` points to PRODUCTION

`initTestEnv()` (`@pasosdejesus/m/dist/e2e/env.js`) defaults to host `learn.tg`,
port `443` and **chain `42220`** (mainnet). Measured on 2026-09-16:
`./bin/m test:e2e premium-course-checkout` without variables signed SIWE for
chain `42220` against a site that expects `11142220`; `auth-options.ts` drops
the message (`return null`, `apps/web/app/api/auth/auth-options.ts:129`) and the
callback answers **401 CredentialsSignin**, so the spec fails with "Buy button
not visible" — a wrong target, not a product defect. With
`make test-e2e-spec SPEC=premium-course-checkout` (variables exported) it passes.

**Rule: use the `make` shortcuts, or export the three variables yourself.**

### 1.3 Pattern and flag order

```sh
cd apps/web
./bin/m test:e2e <pattern> [flags]        # pattern FIRST
```

- A pattern is turned into `*<pattern>*.spec.mjs` **unless** it already contains
  `*` or ends in `.spec.mjs`; in those two cases it is used verbatim. So
  `pastor-bonus` also matches `pastor-bonus-verify.spec.mjs`, while
  `pastor-bonus.spec.mjs` matches only that file.
- `--smoke` forces the smoke directory; without it the runner searches
  `e2e/specs/` first and falls back to `e2e/smoke/` with a warning.
- `--grep <text>` filters by **spec file name**, not by test name.
- Flags after a pattern are fine; a pattern after `--smoke` is ignored (the
  runner then runs every smoke).

Running a spec file directly needs the environment too
(https://github.com/pasosdeJesus/learn.tg/issues/224):

```sh
CHROME_PATH=/usr/local/bin/chrome node e2e/specs/connect-wallet-flow.spec.mjs
node e2e/smoke/leaderboard.spec.mjs
```

---

## 2. Production: read-only checks

Most suites **write**: signing in with SIWE creates a `usuario` and a session,
donations and purchases move testnet/mainnet tokens, the pastor bonus transfers
SLEARN, the admin specs `PATCH` church/user rows. None of that is safe against
`:443`.

`make test-smoke-prod` runs the subset that is **strictly read-only**: public
`GET`s, no session, no wallet, no DB access, no transactions.

```sh
cd apps/web
make test-smoke-prod                    # https://learn.tg
SITE_URL=http://localhost:4000 make test-smoke-prod   # same set elsewhere
```

Exit code is `1` if any check fails; each spec prints its own `passed / failed`.

### 2.1 What the set covers

| Spec | Verifies on production |
|------|------------------------|
| `landing-page.spec.mjs` | `/en` and `/es` answer 200 and do not show "Failed to load courses" |
| `leaderboard.spec.mjs` | Leaderboard page and API in both languages |
| `migration-guide.spec.mjs` | `/en/migration-in-app-wallet` and `/es/migracion-billetera-app` render their title |
| `transparency.spec.mjs` | `/en/transparency` and `/es/transparency` plus the `/api/transparency` contract (`data`, `totals`, `rules`) |
| `verification-timezone.spec.mjs` | `/api/verification/availability` answers; with CalDAV unconfigured the `500` is informational, not a failure |
| `pastor-bonus.spec.mjs` | Churches fund (`/api/churches/fund`, balances), `/en/pastor` and `/es/pastor`, and the legacy `gdcluster/pastors` → `/pastor` redirects |
| `gd-cluster-status.spec.mjs` | R-#220: `/api/gdcluster/ranking/clusters` exposes the `status` of every cluster (pending/active, disbanded excluded), the country ranking answers, the ranking page renders, and `/api/admin/clusters` answers **403** without a session |

Measured against `https://learn.tg` on 2026-10-27: **6/6 specs ok**
(`landing-page` 3 checks, `transparency` 11, `pastor-bonus` 10, fund with
184.56 SLEARN / 3.05 USDT). `gd-cluster-status.spec.mjs` joined the set the same
day for R-#220 and answered **6/6 ok** on production in a read-only run; note that
the production ranking had **0 clusters** that day, so its `status` assertion was
vacuous there. The real check is the dev-site run with a cluster created by
`cluster-formation.spec.mjs`; until the R-#220 build is deployed the first check
reports the missing `status` (the deployed build is the previous one).

### 2.2 What is deliberately NOT in the set

| Suite / spec | Why it is not production-safe |
|--------------|-------------------------------|
| `make test-smoke` (all 25) | Includes the specs below |
| `premium-courses`, `premium-price`, `rails-auth`, `prerequisites` | SIWE sign-in: creates a `usuario`/session (and profiles) |
| `premium-purchase` | Registers a pastor and, with `PURCHASE=1`, pays on-chain |
| `donate-course`, `donate-gd`, `donate-campaign` | Sign in and post to the donation endpoints (payloads are rejected, the session is not) |
| `celo-claim`, `full-journey`, `multiwallet-rules` | Submit crosswords, claim UBI, link/unlink wallets |
| `referral-payout`, `referral-premium` | Claim referrals and pay rewards |
| `pastor-bonus-verify`, `admin-referrer` | Verifier session; `admin-referrer` `PATCH`es a user (restores it) |
| `caldav-completa` | `PUT`/`DELETE` on the Radicale calendar |
| `prod-landing-to-profile` | Completes the test wallet's profile and reschedules a real interview |
| Any browser spec except `gooddollar-not-whitelisted` | They register wallets, fill profiles, claim or pay |

`church-directory` is a borderline case: its `POST`/`PATCH` are **expected** to
be rejected (`401`/`403`) and nothing changes when authorization works, but it
is not part of the read-only target because a regression would write.

`verification-timezone` is kept in the target because a production site without
CalDAV answers `500`; the spec treats that as "not configured" (2026-10-27).

### 2.3 The one browser spec cleared for production

`gooddollar-not-whitelisted` (R-#271/R-#275) checks that an unverified address
resolves to `verify` (opens GoodID) and sends **no** transaction:

```sh
cd apps/web
make test-e2e-gooddollar-not-whitelisted      # PROD_SPECS=1, learn.tg:443, chain 42220
```

It still opens the site in Chrome and uses the wallet in `apps/.env`, which must
therefore be the **production** wallet for that run (see
[environments](environments.md)). The read-only smoke set needs no wallet at all.

### 2.4 Example: verifying a specific fix on production

The same read-only discipline applies to one-off verifications. For the
new-wallet "cooldown" fix (R-#227, verified 2026-09-12 with `0 failures`,
`ANÓNIMAS 0` in both phases):

```sh
CHROME_PATH=/usr/local/bin/chrome \
  IPDES=learn.tg PUERTOPRU=443 CHAIN_ID=42220 SITE_URL=https://learn.tg \
  bin/m test:e2e fresh-wallet-first-connect
```

It creates a throwaway wallet and only reads the course list
(`/api/course-catalog`, same origin), so it is acceptable on production even
though it is a browser spec. Expect `ANÓNIMAS 0` (never an anonymous
`/api/scholarship`) and `¿cooldown?: no` in both phases.

Note: `packages/*/dist` is **gitignored**. On the deploy machine rebuild the
engines after `pull` (`make engines-dist`) before verifying, otherwise the
change is not live.

---

## 3. Preparing an environment

### 3.1 Requirements

- `puppeteer-core` (devDependency of `apps/web`).
- `CHROME_PATH` for browser specs: `/usr/local/bin/chrome` (OpenBSD).
- Test wallet in `apps/.env` (`PRIVATE_KEY` + `NEXT_PUBLIC_ADDRESS`) for anything
  that signs in or pays. The wallet must be **registered**, a **verifier** when
  the spec says so, and have **profile score ≥ 50**.
- The target site running. For the dev site no setup is needed; for local see
  §3.3.

### 3.2 Wallet prerequisites: `prerequisites.spec.mjs`

Run it before the browser specs that depend on an eligible wallet:

```sh
cd apps/web
make test-e2e-spec SPEC=prerequisites      # dev site (exports IPDES/CHAIN_ID)
```

Do **not** run `bin/m test:e2e prerequisites` on its own: without the exported
variables it targets production with chain `42220` (§1.2) and would edit a
profile there. It performs the setup over HTTP:

| Step | Call | Effect |
|------|------|--------|
| 1 | `POST /api/auth/callback/credentials` | SIWE sign-in with the `apps/.env` wallet |
| 2 | `GET /api/admin/check-verifier` | Confirms the verifier role |
| 3 | `PATCH /api/profile` | Sets `nombre`, `email`, `whatsapp`, `place_of_worship` |
| 4 | `PATCH /api/admin/user/:id` | Self-verifies `passport_name`, `passport_nationality`, `verified_email`, `verified_whatsapp`, `verified_place_of_worship` |
| 5 | `GET /api/profile` | Confirms `profilescore ≥ 50` (77 expected) |

The wallet must already be registered and be a verifier on the target server
(see the *Developer Wallet Whitelist* section of
[apps/web/README.md](../apps/web/README.md)).

### 3.3 Running against a local server

Useful to separate a product failure from a dev-site environment problem
(nginx hop, RPC, remote compilation).

```sh
cd apps/web
# apps/.env in "full stack" mode: NEXT_PUBLIC_API_URL empty, so Next serves
# /api and talks to Postgres through Kysely (Rails is not needed for this).
NEXT_PUBLIC_PWA_DISABLE=1 bin/dev             # http://localhost:4000
bin/warmup-local.mjs                           # 24 routes, SEQUENTIAL
# other terminal:
IPDES=localhost PUERTOPRU=4000 CHAIN_ID=11142220 \
  SITE_URL=http://localhost:4000 ./bin/m test:e2e pastor-journey
```

Traps that cost time:

- **`SITE_URL` is mandatory.** The helper builds `https://${IPDES}:${PUERTOPRU}`
  (fixed scheme), so without it the browser goes to `https://localhost:4000` and
  dies with `ERR_SSL_PROTOCOL_ERROR`. Since 2026-09-21 every spec resolves its
  target through `resolveSiteTarget(env)` from `@pasosdejesus/m/e2e`, which
  honours `SITE_URL` and derives `host`/`domainPort` (SIWE signs the host that is
  visited).
- **Do not use `bin/warmup.mjs` for local.** Its second pass fires 55 requests in
  parallel and on this VM (1 CPU, chroot data limit) kills `next dev` with
  `Fatal error ... Check failed: (result.ptr) != nullptr`. Use
  `bin/warmup-local.mjs` (sequential, 180s timeout per route).
- **Memory.** Even so, `next dev` can fall under the heaviest spec
  (`in-app-wallet-payments`, measured 2026-09-20); `NEXT_PUBLIC_PWA_DISABLE=1`
  reduces webpack work (offline specs skip in dev anyway).
- **Failures that only appear locally are usually local.** Measured
  `PATCH /api/admin/church/[id]` → 500, caused on-chain: the 22 SLEARN bonus is
  signed with `CHURCHES_WALLET_PRIVATE_KEY`, the test key in `apps/.env`
  (`0x84272a6d…`), which at that moment was **not** in the SLEARN
  `authorizedTransfers` list, so the contract reverted with
  `SLEARN: neither sender nor receiver authorized`; the real fund wallet
  (`0x01a72816…`, used by the dev site) was authorized. **Updated 2026-09-21:**
  `authorizedTransfers(0x84272a6d…) = true` on the Sepolia SLEARN
  `0x9fBa3A2Ca0275c4D7A3eA341923f8c531e913BFA`, so the fixture can now send
  SLEARN. If a step fails locally and passes on the dev site, check keys and the
  local server (unmigrated database, `next dev`) before the code.

### 3.4 Dev-site warmup: `bin/warmup.mjs`

Only applies when the dev site is served by the **dev server** (`next dev`):
each route is compiled on demand and the first request is very slow (suite
timeouts). With a **production build** (`make all` + `bin/start`, or `make prod`)
the routes come precompiled and warmup is unnecessary (see
[environments](environments.md), "Dos modos para servir el sitio de desarrollo").

```sh
cd apps/web
bin/warmup.mjs                            # SITE_URL defaults to learn.tg:9001
SITE_URL=https://learn.tg bin/warmup.mjs   # production (read-only routes)
```

It includes the campaign donation routes of
https://github.com/pasosdeJesus/learn.tg/issues/223
(`/en/donations/lensenia`, `/api/donations/lensenia/balance`,
`/api/donations/lensenia/verify`) because they compile the `gdcluster` engine's
client chunks and route handlers.

---

## 4. Smoke tests (`e2e/smoke/`)

HTTP only, no browser, runnable in CI and without a display server. 26 specs as
of 2026-10-27.

Run with `make test-smoke` (dev site) or `make test-smoke-prod` (production,
read-only subset, §2).

**Writes** column: `—` = GET only; `Session` = SIWE sign-in (creates/reuses a
user and a session); `User` = creates or edits a user/profile; `Funds` = moves
tokens or pays; `Data` = creates/deletes domain rows.

| Spec | Writes | What it tests |
|------|:---:|---------------|
| `landing-page.spec.mjs` | — | `/en` and `/es` return 200, no "Failed to load courses" |
| `leaderboard.spec.mjs` | — | Leaderboard page + API in ES and EN |
| `migration-guide.spec.mjs` | — | The in-app wallet migration guide in both languages |
| `transparency.spec.mjs` | — | `/en/transparency` and `/es/transparency` plus the `/api/transparency` contract (`data`, `totals`, `rules`; reserves and coverage when the on-chain reads answer; `premiumSlearn` without the per-course accounting, which is internal) |
| `verification-timezone.spec.mjs` | — | `/api/verification/availability`: 7-day window and timezone echo (`America/Bogota`, `America/Caracas`, `UTC`); a `500` means CalDAV is not configured |
| `pastor-bonus.spec.mjs` | — | R-#192/R-#283: churches fund (address + SLEARN/USDT), `/en/pastor` and `/es/pastor` landing, and the legacy `gdcluster/pastors` + `redgd/pastores` paths → `308` to `/{lang}/pastor` |
| `gd-cluster-status.spec.mjs` | — | R-#220: `/api/gdcluster/ranking/clusters` exposes the `status` of every row (pending/active, disbanded excluded), `/api/gdcluster/ranking/countries` answers, `/en/gdcluster/ranking` renders, and `/api/admin/clusters` → **403** without a session |
| `rails-health.spec.mjs` | — | Rails backend health (`NEXT_PUBLIC_API_BASE/proyectosfinancieros.json`): 200 with courses → UP; network error/502 → DOWN. Informative: exits 0 unless `RAILS_CHECK=1`. Production does not need Rails |
| `caldav-http.spec.mjs` | — | CalDAV connectivity (PROPFIND/OPTIONS to Radicale) |
| `church-directory.spec.mjs` | —* | R-#164: `GET /api/directory/churches` shape (`churches`/`total`/`notRecommended`), detail and 404, country filter, claim without session → 401, admin list without a verifier → 403, `/en/directory/churches` → 200. (*The POST/PATCH are expected to be rejected) |
| `pastor-bonus-verify.spec.mjs` | Session | Admin side of the 22 SLEARN bonus: verifier SIWE → `GET /api/admin/pastor-bonus` lists only pastors whose role is verified (`verified_church_relationship='pastor'`, R-#283) → notifications, the church `registration_photo` and the fund. SKIP if the `.env` wallet is not a verifier |
| `admin-referrer.spec.mjs` | Session, Data | Referrer correction from the admin (R-#163 §7.1): read the user (own code, "referred by", rewards paid), validate self-referral and a non-existent referrer (400), re-submitting the current one changes nothing, change and **restore the original**. SKIP without a verifier wallet or any user with a referrer |
| `rails-auth.spec.mjs` | Session | Rails API calls (public course endpoints) in ES and EN |
| `premium-courses.spec.mjs` | Session, User | Course catalogue/purchase endpoints with a **fresh** wallet (its own SIWE): price, eligibility, purchase rejection paths |
| `premium-price.spec.mjs` | Session, User | Price per country (R-#128 §4.2): creates two profiles (Sierra Leone and Colombia) and compares `/api/courses/premium/price` — high HDI pays more, SLEARN keeps 10%, amounts fall in the calibration (SL ~0.70, CO ~3.00). No Chrome, no funds |
| `prerequisites.spec.mjs` | Session, Data | The wallet setup of §3.2 |
| `donate-course.spec.mjs` | Session | Course donation endpoint `/api/add-donation`: validation paths (400/401) |
| `donate-gd.spec.mjs` | Session | GD cluster/country donation `/api/gdcluster/donations/verify`: validation paths (400/401/403) |
| `donate-campaign.spec.mjs` | Session | Campaign donation (R-#223, `/api/donations/{slug}/verify` + balance): 404/400/401, `pdjSharePct` bounds and the multi-chain balance shape |
| `premium-purchase.spec.mjs` | Session, Funds | Money path of a premium purchase over HTTP (R-#128 §4.2): new verified pastor → price → pastor transfers to the backend → `POST /api/courses/premium/purchase` → `processPayment` on-chain → distribution → course access → row in `mine`. **Off by default**: without `PURCHASE=1` only price and authentication are checked. With `PURCHASE=1 SLEARN_PCT=0\|50\|100` it spends test funds and asks for payment from the wallet that publishes `/api/churches/fund` |
| `celo-claim.spec.mjs` | Session, Funds | Full crossword → submit → scholarship claim → CELO UBI claim, plus `/api/metrics` checks |
| `full-journey.spec.mjs` | Session, Funds | All endpoints: CSRF, SIWE, session, profile, crossword, UBI, signout |
| `multiwallet-rules.spec.mjs` | Session, Funds, Data | R-#265: link a new wallet, one UBI claim per account per day, one scholarship per account **and** guide (`alreadyPaid` with the other-wallet message), unlink reports `revoked`/`revokeFailures`, and the wallet is always unlinked at the end. Moves testnet UBI if the account did not claim that day. SKIP without `apps/.env` or a resolvable paid guide |
| `referral-payout.spec.mjs` | Session, Funds | R-#163 Form 2: referred wallet → claim → profile ≥ 50 → perfect missional crossword → `referral_reward` 10% in history. SKIP if the referral wallet has no funds |
| `referral-premium.spec.mjs` | Session, Funds | R-#163 Forms 1 + 3: referred **pastor** → claim → SL profile → church (22 SLEARN bonus) → GD course purchase → `referral_reward` 10% + `referral_bonus` 1 USDT. SKIP if the referral wallet has no funds |
| `caldav-completa.spec.mjs` | Data | CalDAV full cycle: create, list, verify, delete (Radicale) |

The `caldav-*` specs skip when `CALDAV_URL` is unset:

```
ℹ️  CALDAV not configured — skipping CalDAV smoke test
```

Status (2026-10-19): 25 specs. `leaderboard.spec.mjs` may fail when the profile
score explanatory text is not rendered (minor content). Rails course routes are
public (R-#233), so `rails-auth` needs no credential. The two report-only smokes
(`auth-ux`, `auth-cookies`) were removed on 2026-09-21: they could not fail (or
hardcoded a score). Their coverage — SIWE, session cookie, profile — comes from
`prerequisites`, `full-journey` and the browser specs.

---

## 5. Browser specs (`e2e/specs/`)

Puppeteer through `@pasosdejesus/m/e2e` (`initTestEnv`, `launchBrowser`,
`ok`/`fail`/`summary`). 48 specs as of 2026-10-27. **They are not read-only**:
they register wallets, complete profiles, claim UBI, donate and buy (see §2.2).

### 5.1 Wallet in the specs (R-#239 / R-#284)

The wallet **mock** is `setupFullWalletMock` (`m/REQ/14` + `m/REQ/49` P8): it
signs `personal_sign`/`eth_signTypedData_v4` for real (viem) and announces an
EIP-6963 provider (plus `window.ethereum`). Without `rpcUrl` the reads and
`eth_sendTransaction` are mocked; shape them with `fakeCallResult`/`fakeCelo`/
`fakeTxHash`/`fakeReceipt`.

```js
import { setupFullWalletMock } from '@pasosdejesus/m/e2e'
import { connectExternalWallet } from '../helpers/in-app-wallet.mjs'

await setupFullWalletMock(page, { privateKey: pk, address: addr, chainId })  // before goto
await page.goto(`${base}/`)
await connectExternalWallet(page)   // R-#265 §3.9: header = WalletConnect; opens the
                                    // choice modal and signs with the external wallet
```

- `waitForExternalConnect(page)` only **checks** that a connect entry point is on
  screen. Use `connectExternalWallet` to actually sign in, and
  `openWalletDialog(page)` to open learn.tg's in-app dialog (it opens the engine
  choice modal first when there is no session).
- `signInWithCoreWallet(page, { privateKey, address, chainId, baseUrl })` (local
  helper) skips the UI: builds the SIWE message in Node, signs with viem and
  posts the callback inside the page, so the session cookie lands in the browser
  jar.
- `e2e/helpers/in-app-wallet.mjs` keeps only what is app-specific: that SIWE
  sign-in and the dialog/header drivers (`chooseWalletProtection`,
  `completeBackupVerification`, `waitForExternalConnect`). The wallet mock comes
  from `m` by version (`m/REQ/284`); the old local copy
  (`e2e/helpers/siwe-wallet-mock.mjs`) and `setupSIWEMock` are gone.
- Specs that create/import the wallet in the browser answer the protection step
  with `chooseWalletProtection(page, { gesture })` (R-#269): right after the
  password the dialog asks **how to unlock** — the gesture (fingerprint/Face ID)
  is the default, "only with the password" the alternative — and without an
  answer the flow never reaches the 12 words. The helper waits for the step and
  returns `false` on builds without it, so a spec keeps passing against the
  deployed site until the change lands. `gesture: true` keeps the default option
  (`biometric-unlock` answers "password only" during creation and enrols the
  gesture in its own second step).

The helper imports `viem`/`viem/accounts`/`siwe` from `apps/web/node_modules`, so
there is nothing to build.

What the mock answers: `eth_requestAccounts` → the test address,
`personal_sign` → a real secp256k1 signature (no gas), `eth_chainId` → the
configured chain, `eth_sendTransaction` → a simulated hash, `eth_call` and
`eth_getBalance` → simulated results. It survives page reloads (injected through
`evaluateOnNewDocument`).

### 5.2 Prefixes and production

| Prefix | Target | Port | Use |
|--------|--------|------|-----|
| *(none)* | Dev site | `:9001` | Daily development |
| `prod-` | Production | `:443` | Smoke-check the live site |

`prod-landing-to-profile` **writes to production** (completes the test wallet's
profile and cancels/reschedules a real interview), so it self-skips unless
`PROD_SPECS=1`:

```sh
cd apps/web
PROD_SPECS=1 CHROME_PATH=/usr/local/bin/chrome make test-e2e-spec SPEC=prod-landing-to-profile
```

Only `gooddollar-not-whitelisted` and `fresh-wallet-first-connect` are
acceptable on production outside that flag, and neither moves funds — see §2.3
and §2.4.

### 5.3 Spec index

| Spec | What it tests |
|------|---------------|
| `connect-wallet-flow.spec.mjs` | Full Connect → SIWE sign → session → reload |
| `full-flow.spec.mjs` | Complete journey: connect → profile → admin self-verify → courses → crossword → UBI claim → disconnect |
| `auth-session.spec.mjs` | Session persistence across navigation |
| `celo-ubi-claim-sepolia.spec.mjs` | CELO UBI claim on Sepolia |
| `church-persistence.spec.mjs` | Church data persistence in the profile |
| `guide-claims.spec.mjs` | Guide completion and claim flow |
| `cluster-formation.spec.mjs` | R-#220: admin list with search and status/country filters, cluster CRUD, member add/remove, `PUT` pseudonym + status, the **status field and column** in the ranking (API and UI), the admin clusters page (`/{lang}/admin/clusters`) and the disband (soft delete + exclusion from the ranking). The 3-pastor invitation flow (accept/reject/activation at 3 churches) is covered by the engine's unit tests; the steps that need that fixture print `[SKIP]` when it is missing |
| `course-list-compact.spec.mjs` | R-#272: the course list (`/en`, `/es`) shows compact cards — image, title, description, "Go to course" and the three state circles on the border — without the stats paragraph or the donation row |
| `profile-data.spec.mjs` | Profile data loading and display |
| `admin-dashboard.spec.mjs` | Admin dashboard: widgets load, APIs respond, user/church detail, PATCH |
| `admin-calendar-delete.spec.mjs` | R-#280: verifier SIWE → `POST /api/admin/calendar/block` → the block shows in `GET /api/admin/calendar/events` under the **same** uid → `DELETE` → gone → a second `DELETE` is idempotent (200, not 502). Needs a verifier wallet |
| `admin-course-enrolled.spec.mjs` | R-#282: the verifier lists people **enrolled** in a paid course — admin-only roster (403 without a wallet), 400/404 for bad ids, per-course detail matching `GET /api/admin/premium-purchases` 1:1, and the Premium purchases widget in `/{lang}/admin`. Needs a verifier wallet |
| `prod-landing-to-profile.spec.mjs` | Production landing → wallet connect → profile save (writes, `PROD_SPECS=1`) |
| `town-autocomplete.spec.mjs` | Town search API + profile autocomplete UI (Sierra Leone data) |
| `offline-crossword.spec.mjs` | R-#242: crossword solved and submitted **offline** → queued (`offline-pending`, counter and IndexedDB agree) → survives a reload → drains when the connection returns → server 200 and the scholarship is paid → guide completed → outcome left as an `offline_answer` notice (matched by `ref_key`). No service worker needed |
| `offline-two-courses.spec.mjs` | R-#242 (+ `LearnTGVaultsV5` cooldown **per course**): a **new wallet** the spec registers by SIWE and takes to `profilescore >= 50`; loads the guides and crosswords of **two different courses online**, submits both **offline** (two tabs, one queue) and **both must pay** when the connection returns. Skips (never fails) without two eligible courses or without the verifier wallet |
| `offline-guide.spec.mjs` | R-#241: guide readable offline from the PWA cached page (needs a production build; `0 failures` on the `make prod` build) |
| `offline-course-download.spec.mjs` | R-#256: full course download and offline reading of a guide that was never opened online. Test course `/en/web3-and-ubi` (free, no sensitive content) |
| `in-app-wallet.spec.mjs` | R-#245: in-app wallet created in `/en/test/wallet`, unlocked, SIWE and session cookie (skips when the page is not deployed) |
| `in-app-wallet-default.spec.mjs` | R-#270 §3.1/§3.2: the in-app wallet is the default option — without an injected provider it is the only path; with an extension (`isMetaMask`) it is primary, the external one secondary and the phrase import is offered |
| `in-app-wallet-payments.spec.mjs` | Reproduces the 2026-09-19 bugs found by hand on the dev site: donation/purchase modals showing zero balances and failing with "Unsupported method: eth_call" (the in-app EIP-1193 provider) |
| `wallet-panel-collectibles.spec.mjs` | R-#249: the in-app wallet panel shows its collectibles (credentials/SBT) by address via Blockscout, as Web3 & UBI guide 2 promises |
| `wallet-event-disconnect.spec.mjs` | R-#227 problem 1: `WalletEventListener` does not lose the session or reload the page on transient wallet events (mobile/Rabby/OneKey emit `accountsChanged([])` or `disconnect`) |
| `wallet-link-second-wallet.spec.mjs` | R-#265 §3.2: linking a **second** wallet to the account (the extension existed but the site had no `eth_accounts` permission yet) |
| `wallet-invitation-two-devices.spec.mjs` | R-#265 §3.2: account A invites an **address**; that wallet opens the site in another browser context, signs and accepts on entry (a normal sign-in is rejected on purpose) |
| `wallet-handover.spec.mjs` | R-#288: the in-app wallet is added to an existing **verified** account and the duplicate account (created by the in-app wallet) is deleted. Two isolated browser contexts |
| `header-wallet-dialog.spec.mjs` | R-#245: real header + modal — create → close → reopen starts fresh → unlock from the header → SIWE → session survives a reload → `✕` returns to signed-out |
| `donate-unlock-dialog.spec.mjs` | R-#244: in-app session with the wallet locked — the donation modal's unlock button opens the wallet dialog **on top** with the PIN form, and unlocking removes the notice |
| `biometric-unlock.spec.mjs` | R-#246: real header + dialog with a **CDP virtual authenticator (`hasPrf`)** — create → enable fingerprint → reload → one gesture unlocks → the donation modal stops asking to unlock |
| `privacy-settings.spec.mjs` | R-#259: the two privacy switches of `/{lang}/settings` vs the public profile (`GET /api/user/<id>` without cookies) — off removes the credentials, on returns them, **and the switch is checked visually** (thumb moves, track changes colour; `data-state` alone changes even when the CSS is missing) |
| `pastor-journey.spec.mjs` | New pastor journey: connect → Sierra Leone profile → verifier verifies via admin API → claim UBI → 22 SLEARN bonus |
| `donate-campaign-real.spec.mjs` | **Real campaign donation (R-#223):** USDT testnet → `donations/lensenia/verify` → immediate auto-forward (100%, and 90/10 campaign/pdJ), **round C with cashback ON (10 USDT @ pdJ 5%)**: campaign net 85% (8.50), pdJ 5%, cashback 22.00 SLEARN via `mintAndReserve` (+ donor and `learnTgReserve` on-chain balances), campaign wallet balance and user-transaction rows (deltas vs baseline, cumulative on dev) |
| `donate-campaign-celo-real.spec.mjs` | **Real native CELO donation (R-#223):** `sendTransaction` (value) to the backend → `verify` with `payToken='celo'` → native auto-forward 100% and 90/10, CELO balance and `crypto=celo` rows |
| `donate-campaign-celo-modal.spec.mjs` | **Native CELO donation modal (R-#223, real UI):** real RPC bridge over the SIWE mock; the selector shows CELO, hint "Donable (máx., menos gas)", donates CELO and verifies the campaign wallet's on-chain increase |
| `donate-flow.spec.mjs` | Donation modals of the course vault and of the GD country/cluster ranking: distribution info, submit and toast with SLEARN cashback and the tx link |
| `donate-course-real.spec.mjs` | **Real donation to the GD course vault:** success dialog data from the backend response and the transactions recorded for the user |
| `donate-gd-real.spec.mjs` | **Real donation to a GD country fund:** success dialog data, recorded transactions, and the country fund growing by exactly 80% of the donation |
| `fresh-wallet-first-connect.spec.mjs` | **Brand-new wallet, cold session (#5719):** registers it by SIWE and checks the course page **never** queries `/api/scholarship` anonymously (cause of the false "cooldown" and 0% progress) and that the card shows the real state |
| `premium-course-checkout.spec.mjs` | GD checkout: price next to the Buy button (USDT + SLEARN, `data-testid="premium-price"`) → modal → slider. With `FUND_FRESH=1` it also **buys for real** (`SLEARN_PCT=100\|0\|50`, test funds transferred from the fixture wallet to the new pastor) and verifies the success state with the hash, "Purchased", the purchase in the profile and access to `guide1`; without it those steps report as skipped. It creates its own eligible pastor, so it does not depend on the fixture wallet's purchase state |
| `referral-program.spec.mjs` | R-#163 §14: the public referral landing, the CTA per state (score ≤ 90 → "Complete your profile"), the requirements checklist and the referral wallet fund |
| `ux-mobile-menu.spec.mjs` | UX regressions R-#230/R-#231 (header + ☰ menu), R-#228 (horizontal scroll of guide tables), R-#217 (no woff2 preload warnings) and R-#218 (no hydration mismatch, footer with `/{lang}`) |
| `sw-stale-shell.spec.mjs` | A stale course-list shell served by the service worker (ChunkLoadError on a chunk removed by a deploy) must recover, not show "This page couldn't load" |
| `interview-date.spec.mjs` | Booking a 2PM interview stores/displays the exact instant (timestamptz regression: 2PM → "05:00 AM") |
| `verified-city-gate.spec.mjs` | Purchase eligibility: unverified pastor NOT eligible (`verified_city_required`), verified pastor eligible |
| `vault-both-donate.spec.mjs` | Vault donation with BOTH USDT+SLEARN through `/api/add-donation` (real testnet tokens to the dev backend) |
| `gas-insufficient-panel.spec.mjs` | Donation without CELO for gas → the modal is replaced by the "Se necesita CELO" panel (EN/ES) with a link to the Web3 & UBI course (Guide 2) and a Close button; regression with enough CELO keeps the form. Mocks `eth_getBalance` |
| `gooddollar-not-whitelisted.spec.mjs` | R-#271/R-#275: an unverified address resolves to `verify` (GoodID) and no `claim()` is sent. Production-safe |
| `gooddollar-claim-real.spec.mjs` | Real GoodDollar claim (mainnet) for a whitelisted address |

`admin-dashboard` waits for widget content before sampling flicker, and
`guide-claims` waits up to 30s for the UBI button — both were flaky under the
full suite (cold on-demand compilation) but pass individually. `full-flow` can
time out on SIWE under suite load (passes alone).

### 5.4 Dev-server prerequisites for on-chain specs

| Spec | Requires on the dev server |
|------|----------------------------|
| `interview-date` | `proposed_date_of_interview` migrated to `timestamptz` (`db/migrations/20260822000000_proposed_interview_timestamptz.ts`) |
| `verified-city-gate`, `premium-course-checkout` | Verifier wallet (`apps/.env`) whitelisted; eligibility = verified worship city. With `FUND_FRESH=1` the fixture wallet also needs USDT (≥3), SLEARN and CELO for gas to fund the new pastor. Measured 2026-09-21: at the current price (SL: 0.70 USDT / 13.86 SLEARN) the 100% mix needs **15.94 SLEARN** and the 50/50 **7.97** (15% margin each); the `premium-purchase` smoke documents the three mixes |
| `vault-both-donate` | Dev backend wallet (`0x01a728…`) with MINTER on dev SLEARN and CELO for gas; local `apps/.env` wallet with USDT+SLEARN |
| `donate-campaign-real` | Campaign engine deployed (`donations/[slug]/verify`, network-aware); dev MockUSDT (`NEXT_PUBLIC_USDT_TESTNET`); `NEXT_PUBLIC_PDJ_TREASURY_ADDRESS` on the dev site (single-role wallet). Round C (cashback ON) needs MINTER_ROLE on the SLEARN of the dev site + CELO for gas; rounds A/B (cashback OFF) do not |
| `pastor-journey`, `referral-premium` | Dev churches/referral fund (`0x01a728…`, published by `/api/churches/fund`) with **≥22 SLEARN** for the pastor bonus, otherwise the on-chain `transfer` reverts. Top it up from the test wallet (e.g. 300 SLEARN) when the balance is low |

---

## 6. Flakiness, retries and comparing runs

The full suite runs ~48 specs sequentially against the remote dev site from a
1-CPU VM. Under that load some specs fail on timing (a navigation race, a slow
RPC, a route compiling on demand) and **the same spec passes alone**: those are
**environmental, not product defects**. `make test-e2e-retry` runs the suite and
re-runs each failed spec on its own (`bin/m test:e2e --retry $E2E_RETRIES`,
default 2; `m/REQ/49` P3), so a transient failure does not poison the result. Use
it for the final verification; use `make test-e2e` when you want the raw picture.
Before either, warm the dev site (`bin/warmup.mjs`) **if it is served by the dev
server**; a production build needs no warmup. `make test-e2e` and
`test-e2e-retry` also space specs by 12s (`E2E_SPEC_DELAY_MS`) because the dev
site rate-limits per wallet/IP. The shared helper provides `gotoWithRetry()` /
`retry()` (used by the flaky specs), and specs skip gracefully when a
prerequisite is missing (testnet CELO balance, no courses listed on `/en`).

**A spec is only reported green if it exits with the right code.** The runner
decides by the process exit code: a spec that calls `fail()` and ends with
`summary(t0)` without `process.exit(failures > 0 ? 1 : 0)` is reported as
**passed** even when its last line says `❌ 1 failures`. Measured 2026-09-20:
`pastor-journey.spec.mjs` failed the course purchase and the runner accepted it
(no retry). Always end with:

```js
const failures = summary(t0)
process.exit(failures > 0 ? 1 : 0)
```

The `--retry` policy is per exit code, so a badly terminated spec is never
retried.

**Compare two runs** to tell a product failure from an environmental one (for
example the dev site vs a local server):

```sh
cd apps/web
./bin/m test:e2e:summary /tmp/e2e-retry-site2.log /tmp/e2e-local.log
```

`--retry` writes `<E2E_LOG_DIR>/e2e-<timestamp>.log` (`/tmp` by default) with one
`[e2e-result] <spec> <ok|fail|skip>` line per spec; `summary` reads those lines
(or the human format) and prints the results side by side, flagging the specs that
differ: one that fails on the dev site and passes locally points at the
environment, not the code.

**Never run two suites at once.** Both use the same wallet (`apps/.env`) on the
same chain: concurrent runs fight over nonces and shared state (church balance,
premium course already bought) and produce failures that do not exist.

---

## 7. Diagnosing failures

### 7.1 Server errors

A 500 can arrive without a visible cause: in `next dev` the error overlay
sometimes does not paint (measured 2026-09-20: `invalid type: boolean 'false',
expected enum CodeFrameColorMode`) and neither the route's `console.error` nor
the error page reach the console. **The underlying cause is patched** since
2026-09-27 (https://github.com/pasosdeJesus/learn.tg/issues/267):
`apps/web/patches/next@16.3.5.patch` normalizes the options before the WASM
binding (`color: false` is dropped, `color: true` → `'Error'`, `maxWidth:
undefined` → `100`), so the overlay paints again; see R-#267 §6 to regenerate it.

Since 2026-09-20:

- `apps/web/instrumentation.ts` (`onRequestError` + `unhandledRejection` /
  `uncaughtException`) logs every server error, including streaming routes, to
  `stderr` **and** to a file.
- The file is `/tmp/learn-tg-server-errors.log` (`SERVER_ERROR_LOG` overrides it);
  each entry has method, URL, route, `extra`, the stack, and `sql`/`detail`/`code`
  for Postgres errors.
- `lib/server-errors.ts` (`logServerError`, `devErrorDetail`) is the helper.
  `PATCH /api/admin/church/[id]` uses it and adds `detail` to the response outside
  production; `pastor-journey` prints that body when the PATCH fails.

`e2e/diag/church-patch-check.mjs` is a standalone probe for that endpoint
(https://github.com/pasosdeJesus/learn.tg/issues/229): it replays the form
payload with an empty `pastor_whatsapp`.

### 7.2 Hydration / SIWE on the dev server (R-#208)

The dev site `https://learn.tg:9001` sits behind an **nginx reverse proxy**. Two
settings are required on Next 16, otherwise `ConnectWalletButton` never hydrates
(broken HMR socket) and SIWE returns `401 CredentialsSignin` (domain mismatch):

```nginx
location @learntgdes {
    # 1. WebSocket upgrade for /_next/hmr (otherwise it answers 200, not 101,
    #    and Next 16 dev blocks client hydration).
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    # 2. Preserve the port in Host so authorize() sees the same domain the client
    #    signs (window.location.host = learn.tg:9001).
    proxy_set_header Host $http_host;   # NOT $host (which strips the port)
    # ...
}
```

Symptoms: `buttonCount: 0` and no `useAuthAddress:` logs (hydration never runs),
or `[ConnectWallet] callback failed: 401`.

---

## 8. CI

**No CI runs the smoke or browser specs today.** The wiring is:

| Pipeline | Runs | File |
|----------|------|------|
| Public GitHub CI | `pnpm test -- --exclude **/api/**` (API route tests need the private submodule) and `node bin/audit-api-auth.mjs` | `.github/workflows/ci.yml` |
| GitLab CI | The Rails app only (rspec/minitest + PostGIS) | `servidor/.gitlab-ci.yml` |

`make test-smoke` and `make test-e2e` are run by hand (or by the agent) against
the dev site; browser specs additionally need a display/`xvfb` and Chrome.

---

## 9. OpenBSD / adJ specifics

- Chrome 141+ needs `--ozone-platform=headless` (handled by `@pasosdejesus/m/e2e`).
- Clean `/tmp/puppeteer*` between runs if Chrome hangs.
- `CHROME_PATH=/usr/local/bin/chrome`.
- Self-signed certs: the tests set `NODE_TLS_REJECT_UNAUTHORIZED=0` internally.

---

## 10. Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `SITE_URL` | `https://learn.tg:9001` (smokes) / `https://learn.tg` (`bin/m test:e2e`) | Target site |
| `IPDES` | `learn.tg` | Hostname for the SIWE domain |
| `PUERTOPRU` | `9001` (`make`) / `443` (bare `bin/m`) | Port |
| `CHAIN_ID` | `11142220` (`make`) / `42220` (bare `bin/m`) | Chain the wallet signs for |
| `CHROME_PATH` | — | Chromium/Chrome binary (required for browser specs) |
| `E2E_SPEC_DELAY_MS` | `12000` in `make test-e2e*` | Pause between specs |
| `E2E_RETRIES` | `2` | Retries per failed spec in `make test-e2e-retry` |
| `E2E_LOG_DIR` | `/tmp` | Where `--retry` writes its log |
| `PRIVATE_KEY` | from `apps/.env` | Test wallet private key |
| `NEXT_PUBLIC_ADDRESS` | from `apps/.env` | Test wallet address |
| `PROD_SPECS` | — | Enables the `prod-*` specs (they write) |
| `PURCHASE`, `SLEARN_PCT` | — | Enable real purchases in `premium-purchase` |
| `FUND_FRESH` | — | Enable the real purchase in `premium-course-checkout` |
| `CALDAV_URL` / `CALDAV_USER` / `CALDAV_PASS` | — | Radicale/CalDAV (`caldav-*` smokes; skip when unset) |
| `SERVER_ERROR_LOG` | `/tmp/learn-tg-server-errors.log` | Server error log file |
| `RAILS_CHECK` | — | Makes `rails-health` fail instead of skipping |

---

## 11. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| All specs fail with a connection error | Site not running | `bin/dev` on port 4000, or check the dev site |
| Every request returns HTML `502 Bad Gateway` | The target site is down (nginx has no upstream) | Start it (`bin/dev`) or run `make test-smoke-prod` against production to confirm the code is fine |
| SSL errors | Self-signed cert / wrong scheme | Set `SITE_URL` with the right scheme; tests already ignore self-signed certs |
| "CHROME_PATH not set" | No Chrome binary | Install chromium, export `CHROME_PATH` |
| Browser spec fails with `401 CredentialsSignin` | Running with `bin/m` defaults (production, chain `42220`) or wrong host in `Host` header | Use the `make` shortcuts (§1.2) and fix nginx (§7.2) |
| Smoke `celo-claim` fails with "24 hours" | Test wallet cooldown | Wait 24h or use another wallet |
| Chrome hangs on OpenBSD | Zombie Puppeteer processes | `rm -rf /tmp/puppeteer*` and retry |
| CalDAV smokes skipped | `CALDAV_URL` not set | Set the three `CALDAV_*` variables |
| `verification-timezone` reports `500` | CalDAV not configured on that site | Informational ("CalDAV not configured"); configure CalDAV to assert timezones |
| `full-flow.spec.mjs` UBI claim fails | Wallet profile score < 50 | Run `bin/m test:e2e prerequisites` |
| "Transaction … could not be found" on a donation/purchase | forno does not index fresh receipts | Already mitigated by `fetchTxWithReceipt` (multi-RPC) in `lib/backend-config.ts`; check the deploy includes the rebuild |
| Donation/purchase 500 with "exceeds the balance" | Backend wallet out of CELO for gas | Fund `NEXT_PUBLIC_ADDRESS` with CELO ([runbook](runbook.md) §5) |
| `premium-course-checkout` shows no Buy button | Wallet not eligible | The spec creates its own eligible pastor; if it still fails, check the verified city on the dev server |
| `interview-date` shows another hour | `timestamptz` migration not applied on the dev DB | Apply `db/migrations/20260822000000_proposed_interview_timestamptz.ts` |
| A spec passes but prints `❌` | Missing `process.exit(1)` | See §6 |

---

## 12. Related docs

- https://github.com/pasosdeJesus/learn.tg/issues/179 — E2E infrastructure spec
- [SIWE auth flow](siwe-auth-flow.md) — authentication protocol
- [Wallet auth](wallet-auth.md) — custom wallet implementation (no wagmi)
- [Environments](environments.md) — production vs development, run modes, wallets
- [API security](api-security.md) — which routes are public, authenticated or admin
- [apps/web/CONTRIBUTING.md](../apps/web/CONTRIBUTING.md) — testing policy and coverage targets
