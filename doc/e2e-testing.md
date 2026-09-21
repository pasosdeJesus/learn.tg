# E2E Testing

End-to-end testing for learn.tg uses `@pasosdejesus/m`'s test runner
(`bin/m test:e2e`). Tests are split into two categories: HTTP smoke tests
(no browser) and Puppeteer browser specs.

## Quick Reference

| Command | What | Needs Chrome? | Default target |
|---------|------|:---:|---|
| `make test-smoke` | All HTTP smoke tests | ❌ | `https://learn.tg:9001` |
| `make test-e2e` | All browser specs | ✅ | `https://learn.tg:9001` |
| `make test-e2e-retry` | All browser specs + retry the ones that fail | ✅ | `https://learn.tg:9001` |
| `make test-e2e-<name>` | Single browser spec by filename pattern | ✅ | `https://learn.tg:9001` |
| `make test-e2e-wallet` | Atajo: `SPEC=in-app-wallet` (billetera in-app, R-#245) | ✅ | `https://learn.tg:9001` |
| `make test-e2e-biometric` | Atajo: `SPEC=biometric-unlock` (desbloqueo por huella, R-#246) | ✅ | `https://learn.tg:9001` |
| `make test-e2e-offline` | Atajo: `SPEC=offline` (offline-guide + offline-crossword) | ✅ | `https://learn.tg:9001` |
| `make test-packages` | Unit tests de `packages/pdj-wallet{,−next}` | ❌ | local |
| `bin/m test:e2e` | Browser specs (falls back to smoke if none found) | ✅ | ⚠️ **`https://learn.tg` (producción)** |
| `bin/m test:e2e --smoke` | Smoke only | ❌ | `https://learn.tg:9001` |
| `bin/m test:e2e <pattern>` | Specific spec(s) matching filename | ✅ | ⚠️ **`https://learn.tg` (producción)** |
| `bin/m test:e2e --grep <filter>` | Filter specs by test name | ❌ | `https://learn.tg:9001` |

Override target: `SITE_URL=https://learn.tg bin/m test:e2e`

Chrome path: `CHROME_PATH=/usr/local/bin/chrome bin/m test:e2e`

### ⚠️ `bin/m test:e2e` directo apunta a PRODUCCIÓN

Los atajos de `make` exportan
`IPDES=learn.tg PUERTOPRU=9001 CHAIN_ID=11142220` (`apps/nextjs/Makefile:184`),
por eso llegan al sitio de desarrollo. `bin/m test:e2e` **sin esos tres
variables** usa los valores por defecto de `initTestEnv()`
(`@pasosdejesus/m/dist/e2e/env.js`): host `learn.tg`, puerto `443` y
**cadena `42220`** (mainnet).

Consecuencia medida (2026-09-16): corriendo `./bin/m test:e2e
premium-course-checkout` sin variables, el spec firmaba SIWE con cadena `42220`
contra un sitio que espera `11142220`; `auth-options.ts` descarta el mensaje por
red equivocada (`return null`, `apps/nextjs/app/api/auth/auth-options.ts:129`) y el
callback responde **401 CredentialsSignin**. El spec falla con "Buy button not
visible" porque no hay sesión, no por un defecto del producto. Con
`make test-e2e-spec SPEC=premium-course-checkout` (variables exportadas) pasa.

Regla: usar siempre los atajos de `make`, o exportar las tres variables.

### Estabilidad: reintentar los fallos (`make test-e2e-retry`)

La suite completa corre 37 specs en secuencia contra el dev site remoto desde una
VM de 1 CPU. Bajo esa carga algunas specs fallan por timing (una carrera de
navegación, un RPC lento, una ruta compilando bajo demanda) y la **misma spec pasa
al correrla sola**: son fallos **ambientales, no defectos de producto**.
`make test-e2e-retry` corre la suite y vuelve a correr cada spec fallida por
separado hasta `E2E_RETRIES` veces (`bin/e2e-retry.mjs`), de modo que un fallo
transitorio no envenene el resultado. Úsalo para la verificación final; usa
`make test-e2e` cuando quieras la foto cruda. Antes de cualquiera, calienta el dev
site (`bin/warmup.mjs`).

**Un spec solo se reporta verde si sale con el código correcto.** El runner
(`@pasosdejesus/m/dist/tasks/e2e.js:116`) decide por el exit code, y `fail()`
solo imprime `❌` y suma un contador: un spec que llama `fail()` y termina con
`summary(t0)` sin `process.exit(failures > 0 ? 1 : 0)` **se reporta como
aprobado** aunque su último renglón diga `❌ 1 failures`. Medido el 2026-09-20:
`pastor-journey.spec.mjs` falló la compra del curso y el runner lo dio por bueno
(no se reintentó). Regla: terminar siempre con
`const failures = summary(t0); process.exit(failures > 0 ? 1 : 0)`.
`bin/e2e-retry.mjs` además lee los bloques de la primera pasada y trata como
fallida cualquier spec cuyo resumen diga `❌ N failures` con N > 0, así que un
spec mal terminado igual se reintenta.

### Comparar dos corridas: `bin/e2e-summary.mjs`

Para distinguir un fallo de producto de uno ambiental conviene correr lo mismo en
otro entorno (por ejemplo un servidor local) y comparar:

```sh
cd apps/nextjs
node bin/e2e-summary.mjs /tmp/e2e-retry-site2.log /tmp/e2e-local.log
```

Imprime una fila por spec con `ok`, `FALLA`, `SKIP` o `?` (arrancó y no dejó
resumen), y marca con `<-- difiere` las filas cuyo estado cambia entre corridas:
un spec que falla en el dev site y pasa en local apunta al entorno del sitio, no
al código.

**No corras dos suites a la vez.** Ambas usan la misma billetera (`apps/.env`)
sobre la misma cadena: dos corridas simultáneas compiten por los nonces y por el
estado compartido (saldo de la iglesia, curso premium ya comprado) y producen
fallos que no existen. Secuéncialas.

### Correr los specs contra un servidor local

Sirve para separar un fallo de producto de uno del entorno del dev site (paso de
nginx, RPC, carga remota). Preparación:

```sh
cd apps/nextjs
# apps/.env debe estar en modo "pila completa": NEXT_PUBLIC_API_URL vacío
# (Next sirve /api y habla con Postgres vía Kysely; NO necesita Rails para esto).
NEXT_PUBLIC_PWA_DISABLE=1 bin/dev            # http://localhost:4000
bin/warmup-local.mjs                          # calienta 24 rutas, SECUENCIAL
# en otra terminal:
IPDES=localhost PUERTOPRU=4000 CHAIN_ID=11142220 \
  SITE_URL=http://localhost:4000 ./bin/m test:e2e pastor-journey
```

Detalles que cuestan tiempo si se ignoran:

- **`SITE_URL` es obligatorio**: el helper de `m` arma `base` como
  `https://${IPDES}:${PUERTOPRU}` (fijo), así que sin `SITE_URL` el spec navega a
  `https://localhost:4000` y muere con `ERR_SSL_PROTOCOL_ERROR`. Los specs de
  billetera ya lo respetaban; desde 2026-09-20 también `pastor-journey`,
  `header-wallet-dialog`, `donate-campaign-celo-modal`, `in-app-wallet` y
  `premium-course-checkout`.
- **No uses `bin/warmup.mjs` contra local**: su pasada 2 dispara 55 requests en
  paralelo y en esta VM (1 CPU, límite de datos del chroot) mata al `next dev`
  con `Fatal error ... Check failed: (result.ptr) != nullptr`. Para local usa
  `bin/warmup-local.mjs` (secuencial, timeout de 180s por ruta).
- **Memoria**: aun así, `next dev` se cae bajo el spec más pesado
  (`in-app-wallet-payments`, medido 2026-09-20); `NEXT_PUBLIC_PWA_DISABLE=1` baja
  el trabajo de webpack (los specs offline se saltan en dev de todos modos).
- **Fallos que solo aparecen en local** suelen ser del entorno local: medido
  `PATCH /api/admin/church/[id]` → 500, y con el diagnóstico de la sección
  siguiente la causa resultó ser **on-chain**: el bono de 22 SLEARN se firma con
  la llave de `CHURCHES_WALLET_PRIVATE_KEY` y en el `apps/.env` local esa llave es
  la de prueba (`0x84272a6d…`), que **no** está en la lista de transferencias
  autorizadas del SLEARN (`authorizedTransfers(0x84272a6d…) = false` en Sepolia),
  mientras que la billetera real del fondo (`0x01a72816…`, la que usa el dev site)
  sí (`true`). El contrato revierte con `SLEARN: neither sender nor receiver
  authorized`. Si un paso falla en local y pasa en el dev site, revisa antes las
  llaves/el servidor local (base de datos sin migrar, `next dev`) que el código.

### Diagnóstico de errores del servidor

Un 500 puede quedarse sin causa visible: en `next dev` el overlay de errores a
veces no se pinta (medido 2026-09-20: `invalid type: boolean \`false\`, expected
enum CodeFrameColorMode`) y ni el `console.error` del route ni la página de error
llegan a la consola. Desde entonces:

- `apps/nextjs/instrumentation.ts` (`onRequestError` + `unhandledRejection` /
  `uncaughtException`) registra todo error del servidor, incluidas las rutas de
  streaming, en `stderr` **y** en un archivo.
- El archivo es `/tmp/learn-tg-server-errors.log` (`SERVER_ERROR_LOG` lo cambia);
  cada entrada trae método, URL, route, `extra` y el stack, más `sql`, `detail` y
  `code` de los errores de Postgres.
- `lib/server-errors.ts` (`logServerError`, `devErrorDetail`) es el helper. El
  `PATCH /api/admin/church/[id]` ya lo usa y, fuera de producción, agrega
  `detail` a la respuesta; el spec `pastor-journey` imprime ese cuerpo cuando el
  PATCH falla (`apiPatch` lanza con el mensaje del servidor en vez del
  `AxiosError` pelado).

## Dev-server warmup: `bin/warmup.mjs`

Tras un deploy, Next.js compila cada ruta bajo demanda y el primer request es
lentísimo (timeouts en la suite). `apps/nextjs/bin/warmup.mjs` toca las páginas
y APIs clave **antes** de correr los specs: pasada 1 secuencial (compila con
timeout generoso por ruta), pasada 2 en paralelo (caché caliente, verifica
tiempos).

```sh
cd apps/nextjs
bin/warmup.mjs                   # SITE_URL por defecto (learn.tg:9001)
SITE_URL=https://learn.tg bin/warmup.mjs   # producción
```

Incluye las rutas de las donaciones a campaña (https://github.com/pasosdeJesus/learn.tg/issues/223):
`/en/donations/lensenia`, `/api/donations/lensenia/balance` y
`/api/donations/lensenia/verify` (la página compila los client chunks y los
route handlers del motor `gdcluster`).

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
| `referral-payout.spec.mjs` | Referral payout (https://github.com/pasosdeJesus/learn.tg/issues/163 Form 2): referred wallet → claim → profile ≥50 → perfect missional crossword → `referral_reward` 10% in history (SKIP si la billetera de referidos no tiene fondos) |
| `referral-premium.spec.mjs` | Referral payout (https://github.com/pasosdeJesus/learn.tg/issues/163 Form 1 + Form 3): referred PASTOR → claim → perfil SL verificado → iglesia (bonus 22 SLEARN) → compra curso GD → `referral_reward` 10% + `referral_bonus` 1 USDT en history (SKIP si la billetera de referidos no tiene fondos) |
| `rails-auth.spec.mjs` | Rails API calls (public course endpoints) in ES and EN |
| `verification-timezone.spec.mjs` | Verification availability API: timezone handling, 7-day window |
| `donate-course.spec.mjs` | Course donation endpoint (`/api/add-donation`): validation paths (400/401) |
| `donate-gd.spec.mjs` | GD cluster/country donation endpoint (`/api/gdcluster/donations/verify`): validation paths (400/401/403) |
| `donate-campaign.spec.mjs` | Campaign donation (https://github.com/pasosdeJesus/learn.tg/issues/223, `/api/donations/{slug}/verify` + balance): 404/400/401, bounds de `pdjSharePct` y forma del balance multi-cadena |
| `rails-health.spec.mjs` | Health check del backend Rails del dev site (`NEXT_PUBLIC_API_BASE/proyectosfinancieros.json`): 200 con cursos → UP; error de red/502 → DOWN (exit 1). Correr antes de las suites que dependen de Rails |

### Current Status (2026-07-28)

**10 smokes** (más las donaciones `donate-course`, `donate-gd` y
`donate-campaign`). `leaderboard.spec.mjs` fails on profileScore explanation text
not rendered (minor content issue). The Rails course endpoints are public
(R-#233), so no credential is needed for `rails-auth.spec.mjs`.
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
(`initTestEnv`, `launchBrowser`, `ok`/`fail`/`summary`).
Requires `CHROME_PATH` set (OpenBSD: `/usr/local/bin/chrome`).

### Wallet in the specs (R-#239)

The wallet is the real `@learn-tg/pdj-wallet` **core running in Node**, not a
mock: `e2e/helpers/in-app-wallet.mjs` imports the key from `apps/.env` (or creates
a fresh one) with `FileStorage`, exposes a thin `window.ethereum` shim in the page
and bridges `personal_sign` to the core (`signSIWE`).

```js
import { installCoreWalletMock, waitForExternalConnect } from '../helpers/in-app-wallet.mjs'

await installCoreWalletMock(page, { privateKey: pk, address: addr, chainId })  // before goto
await page.goto(`${base}/`)
await waitForExternalConnect(page)   // R-#238: header = WalletSelector; this clicks
                                     // "Use external wallet" until Connect shows up
```

`signInWithCoreWallet(page, { privateKey, baseUrl, chainId })` skips the UI: it
builds the SIWE message in Node, signs it with the core and posts the callback
inside the page so the NextAuth session cookie lands in the browser jar.

This replaced the `setupSIWEMock` / `simulateSIWE` helpers of
`@pasosdejesus/m/e2e` in `connect-wallet-flow`, `full-flow`, `diag-session`,
`town-autocomplete` and `prod-landing-to-profile` (2026-09-15).
`e2e/helpers/siwe-wallet-mock.mjs` (a local copy, unused) was deleted.

Requirements for Node: the package needs its own `node_modules`
(`cd packages/pdj-wallet && pnpm install`) and its `dist/` built
(`make engines-dist`), because Node ESM resolves `viem` from the package folder.

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

**`prod-landing-to-profile` writes to production** (it completes the test wallet's
profile and cancels/reschedules a real interview), so it is **excluded from the
default suite**: it self-skips unless `PROD_SPECS=1` is set.

```sh
cd apps/nextjs
PROD_SPECS=1 CHROME_PATH=/usr/local/bin/chrome make test-e2e-spec SPEC=prod-landing-to-profile
```

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
| `offline-crossword.spec.mjs` | R-#242: crossword filled, submitted offline → queued (`offline-pending`), survives a reload, and drains when the connection returns (no service worker needed) |
| `offline-guide.spec.mjs` | R-#241: guide readable offline from the PWA cached page (skips when the site serves the development worker) |
| `in-app-wallet.spec.mjs` | R-#245: in-app wallet created in `/en/test/wallet`, unlocked, SIWE and session cookie (skips when the page is not deployed) |
| `header-wallet-dialog.spec.mjs` | R-#245: the real header + wallet modal flow — create → close → reopen must start fresh → unlock from the header → SIWE → the header **keeps the session after a reload** → `✕` returns to signed-out |
| `donate-unlock-dialog.spec.mjs` | R-#244: with an in-app session and the wallet locked, the donation modal's unlock button must open the wallet dialog **on top** with the PIN form, and unlocking must remove the notice |
| `biometric-unlock.spec.mjs` | R-#246: drives the real header + dialog with a **CDP virtual authenticator (`hasPrf`)** — create → enable fingerprint → reload → one gesture unlocks → the donation modal stops asking to unlock |
| `pastor-journey.spec.mjs` | New pastor full journey: connect → fill Sierra Leone profile → verifier verifies via admin API → claim UBI → 22 SLEARN bonus check |
| `donate-campaign-real.spec.mjs` | **Real donation to a campaign (https://github.com/pasosdeJesus/learn.tg/issues/223):** transfer USDT testnet → `donations/lensenia/verify` → auto-forward inmediato (100% y 90/10 campaña/pdJ), **ronda C con cashback ON (10 USDT @ pdJ 5%)**: campaña neta 85% (8.50), pdJ 5%, cashback 22.00 SLEARN vía `mintAndReserve` (+saldo on-chain del donante y del `learnTgReserve`), balance de la billetera campaña y filas en user-transactions (deltas vs baseline, acumulativo en dev) |
| `donate-campaign-celo-real.spec.mjs` | **Real donation in native CELO (https://github.com/pasosdeJesus/learn.tg/issues/223):** `sendTransaction` (value) al backend → `verify` con `payToken='celo'` (verify por `tx.value`) → auto-forward nativo 100% y 90/10, balance CELO on-chain y filas `crypto=celo` |
| `donate-campaign-celo-modal.spec.mjs` | **Donation modal in native CELO (https://github.com/pasosdeJesus/learn.tg/issues/223, UI real):** RPC bridge real (eth_sendTransaction) sobre el mock de SIWE; selector muestra CELO, hint "Donable (máx., menos gas)", dona CELO y verifica el incremento on-chain de la billetera campaña |
| `fresh-wallet-first-connect.spec.mjs` | **Billetera NUEVA conectada por primera vez (sesión fría #5719):** crea una billetera, la registra por SIWE y verifica que la página de cursos **no consulte `/api/scholarship` en anónimo** (causa del "cooldown" falso y del 0% de avance) y que la tarjeta muestre el estado real. La lista de cursos la sirve la app (`/api/course-catalog`, R-#233 §4.4), same-origin. |

### Current Status (2026-08-24)

**21 browser specs at that date** (37 browser specs and 20 HTTP smoke specs
measured 2026-09-20). New specs cover the 2026-08 regressions: interview date
(timestamptz migration), verified-city purchase gate, session fallback, and
the vault donation with both cryptos:

|| Spec | What it tests |
||------|---------------|
|| `premium-course-checkout.spec.mjs` | GD checkout UI (Buy button → CheckoutModal → slider). Creates a fresh eligible pastor via API, so it never depends on the fixture wallet's purchase state |
|| `interview-date.spec.mjs` | Booking a 2PM interview stores/displays the exact instant (timestamptz regression: 2PM → "05:00 AM" bug) |
|| `verified-city-gate.spec.mjs` | Purchase eligibility: unverified pastor NOT eligible (`verified_city_required`), verified pastor eligible |
|| `church-selector-diag.spec.mjs` | Session-cookie auth in `authenticateUser` + `ChurchSelector` options/assigned church |
|| `vault-both-donate.spec.mjs` | Vault donation with BOTH USDT+SLEARN through `/api/add-donation` (sends real testnet tokens to the dev backend) |
|| `gas-insufficient-panel.spec.mjs` | Donación sin CELO para gas → el modal se reemplaza por el panel "Se necesita CELO" (EN/ES) con enlace al curso Web3 & UBI (Guía 2) y botón Cerrar; regresión con CELO suficiente (formulario se mantiene). Mockea `eth_getBalance` |

`admin-dashboard` waits for widget content before sampling flicker, and
`guide-claims` waits up to 30s for the UBI button — both were flaky under the
full suite (cold on-demand compilation) but pass individually. `full-flow` can
time out on SIWE under suite load (passes solo).

### Dev-server prerequisites for on-chain specs

| Spec | Requires on the dev server |
|------|----------------------------|
| `interview-date` | `proposed_date_of_interview` migrated to `timestamptz` (see `db/migrations/20260822000000_proposed_interview_timestamptz.ts`) |
| `verified-city-gate`, `premium-course-checkout` | Verifier wallet (`apps/.env`) whitelisted; eligibility = verified worship city |
| `vault-both-donate` | Dev backend wallet (`0x01a728…`) with MINTER on dev SLEARN and CELO for gas; local `apps/.env` wallet with USDT+SLEARN |
| `donate-campaign-real` | Motor de campañas desplegado (`donations/[slug]/verify`, network-aware); dev MockUSDT (`NEXT_PUBLIC_USDT_ADDRESS`); `NEXT_PUBLIC_PDJ_TREASURY_ADDRESS` en el dev (billetera única). La ronda C (cashback ON) requiere MINTER_ROLE de SLEARN en el backend (otorgado en el SLEARN Sepolia del dev) + CELO en la billetera de prueba para el gas; las rondas A/B (cashback OFF) no lo requieren |
| `church-selector-diag` | Session cookie auth (`lib/authenticateUser.ts`, session only) |
| `pastor-journey`, `referral-premium` | Dev churches/referral fund (`0x01a728…`, shown by `/api/churches/fund`) with **≥22 SLEARN** for the pastor bonus; otherwise the on-chain `transfer` reverts. Top it up from the test wallet (e.g. 300 SLEARN) when `/api/churches/fund` reports a low balance |

### Verifying the new-wallet "cooldown" fix on production

**Verified on production 2026-09-12** (new wallet, `https://learn.tg`): `0
failures`, `ANÓNIMAS 0` in both phases, no false "cooldown".

After deploying the cold-session fix (`app/[lang]/page.tsx`,
`lib/hooks/useCourse.ts`, guide page, `packages/rewards`) to
`https://learn.tg`, verify that a **new wallet** no longer sees a course in a
false "cooldown" / 0% (see R-#227):

```sh
CHROME_PATH=/usr/local/bin/chrome \
  IPDES=learn.tg PUERTOPRU=443 CHAIN_ID=42220 SITE_URL=https://learn.tg \
  bin/m test:e2e fresh-wallet-first-connect
```

The course list is served by the app itself (`/api/course-catalog`, R-#233 §4.4)
same-origin, so no port/mock is needed.

Expected in both phases: `ANÓNIMAS 0` (never an anonymous `/api/scholarship`)
and `¿cooldown?: no`; phase B (second load) also queries with the wallet.
Manual alternative: connect a brand-new wallet on `https://learn.tg`, open the
course list and check "A relationship with Jesus" shows the real state (not
"cooldown"), then reconnect and confirm it does not change.

Note: `packages/*/dist` is **gitignored** — on the deploy machine rebuild the
engines after `pull` (`cd packages/<engine> && ../../apps/nextjs/node_modules/.bin/tsc -b`)
before verifying, otherwise the `canSubmit: null` change in `packages/rewards`
is not live.

### Hydration / SIWE gotcha on the dev server (https://github.com/pasosdeJesus/learn.tg/issues/208)

The dev server `https://learn.tg:9001` sits behind an **nginx reverse proxy**.
Two nginx settings are required for the browser specs to pass on Next 16, or
`ConnectWalletButton` never hydrates (HMR socket broken) and SIWE returns
`401 CredentialsSignin` (domain mismatch):

```nginx
location @learntgdes {
    # 1. WebSocket upgrade for /_next/hmr (otherwise it returns 200, not 101,
    #    and Next 16 dev blocks client hydration).
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    # 2. Preserve the port in Host so authorize() sees the same domain the
    #    client signs (window.location.host = learn.tg:9001).
    proxy_set_header Host $http_host;   # NOT $host (strips the port)
    # ...
}
```

Symptoms: `buttonCount: 0` and no `useAuthAddress:` logs in the browser console
(hydration never runs), or `[ConnectWallet] callback failed: 401`. See
https://github.com/pasosdeJesus/learn.tg/issues/208 for the full diagnosis.

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

> **Browser specs and `IPDES`/`PUERTOPRU`:** the shared helper
> `@pasosdejesus/m/e2e/env` defaults to **production** (`learn.tg:443`) when
> `IPDES`/`PUERTOPRU` are unset. `make test-e2e` (and `make test-e2e-spec
> SPEC=…`) export `IPDES=learn.tg PUERTOPRU=9001 CHAIN_ID=11142220` so the
> documented default really is the dev site; the `prod-*` specs force
> `learn.tg:443 / 42220` themselves. Running a spec directly with `node
> e2e/specs/x.spec.mjs` **requires those envs** (https://github.com/pasosdeJesus/learn.tg/issues/224).

Under a full 30-spec run the shared 16G dev VM saturates and navigation can time
out; `e2e/helpers/retry.mjs` provides `gotoWithRetry()`/`retry()` (used by the
flaky specs) and specs skip gracefully when an environment prerequisite is
missing (testnet CELO balance, mainnet stress opt-in `PROD_STRESS=1`, no courses
listed on `/en`).

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
| Chrome hangs on OpenBSD | Zombie Puppeteer processes | `rm -rf /tmp/puppeteer*` and retry |
| CalDAV smokes skipped | `CALDAV_URL` not set | Set env vars if CalDAV testing is needed |
| `full-flow.spec.mjs` UBI claim fails | Test wallet profile score < 50 | Run `bin/m test:e2e prerequisites` to set up |
| "Transaction … could not be found" en donación/compra | forno no indexa receipts recién minados | Ya mitigado con `fetchTxWithReceipt` (multi-RPC) en `lib/backend-config.ts`; verifica que el deploy incluya el rebuild |
| Donación/compra falla con 500 y "exceeds the balance" en el servidor | Backend wallet sin CELO para gas | Funde `NEXT_PUBLIC_ADDRESS` con CELO (ver `doc/runbook.md` §3) |
| `premium-course-checkout` sin botón Buy | La wallet no es elegible (compra/eligibilidad) | El spec ahora crea su propio pastor elegible vía API; si falla, revisa la verificación de ciudad en el dev server |
| `interview-date` muestra otra hora | Migración timestamptz no aplicada en la BD dev | Aplica `db/migrations/20260822000000_proposed_interview_timestamptz.ts` |

## Related Docs

- [SIWE Auth Flow](siwe-auth-flow.md) — Authentication protocol
- [Wallet Auth](wallet-auth.md) — Custom wallet implementation (no wagmi)
- https://github.com/pasosdeJesus/learn.tg/issues/179 — E2E testing infrastructure spec
- [apps/nextjs/CONTRIBUTING.md](../apps/nextjs/CONTRIBUTING.md) — Testing policy and coverage targets
