# Environments and Wallets

> "Whatever you do, work at it with all your heart, as working for the Lord,
> not for human masters." (Colossians 3:23)

Operational map of the environments (sites), wallets, and local run modes for
learn.tg. Read this before editing `apps/.env`, deploying, or running the
stack locally.

## Environments

| | Production | Development |
|---|---|---|
| URL | `https://learn.tg` | `https://learn.tg:9001` |
| Celo network | `celo` (chain 42220) | `celoSepolia` (chain 11142220) |
| Rails admin API | `https://learn.tg:3250/learntg-admin` | `https://learn.tg:3500/learntg-admin` |
| Next.js API | same host | same host (`:9001`) |
| Wallets | one per role (below) | single wallet for all roles |
| Data | real users | development data |

The Rails admin app listens on a **different port per environment** (both under
`https://learn.tg`, behind nginx): **`:3250` in production** and **`:3500` in
development**. The dev port is the one used by the frontend quickstart proxy
(`NEXT_PUBLIC_API_BASE=https://learn.tg:3500/learntg-admin`). The course list and
detail are served by the app itself (`/api/course-catalog`, R-#233 §4.4), so the
public site no longer depends on those Rails ports.

Chain IDs confirmed by the E2E suites: specs targeting `https://learn.tg`
report `chain: 42220` (mainnet), specs targeting `https://learn.tg:9001`
report `chain: 11142220` (Sepolia).

### Who runs what — and who can deploy

Both sites above run on **other machines**. This VM (where the agent works) has
**no access to either**: the agent cannot deploy to `learn.tg` or to the official
development site `learn.tg:9001` (no shell there), and Git writes (`commit`,
`push`, `tag`) are reserved for the human operator (`AGENTS.md` §7). A change
reaches the dev site **only when the operator deploys the branch**; until then the
dev site keeps serving the previous build, so a fix can be in the tree and still
not be visible in a manual test there.

The agent's own sandbox is **`http://localhost:4000`** (`cd apps/nextjs &&
bin/dev`, on this VM), used for unit/E2E/smoke checks. It is **not** the official
development site and is **not** a place for the operator's manual testing.
`bin/dev` runs `make engines-dist` first and **aborts on failure** (a stale
`dist/` would otherwise be served along the new app), so a broken engine surfaces
before the server starts.

**The deploy must rebuild the engines.** `packages/*/dist` is not in git: `make all`
/ `make prod` run `engines-dist` first, and a build that skips it serves stale engine
code with the new app (or vice versa). That mismatch is a **runtime** error, not a
compile one. Measured 2026-09-20: after a deploy the dev site could not create an
in-app wallet (the e2e specs waited forever for the recovery words and the test page
logged "The password must have at least 8 characters") because the deployed
`pdj-wallet-next` still passed `pin` to the renamed `pdj-wallet` core, which expects
`password`; rebuilding the engines fixed it. If a wallet spec fails right after a
deploy, check `engines-dist` before the code.

## Wallets

### Production — one wallet per role

`apps/.env` (see `apps/.env.example`) defines a **separate wallet per role**
on mainnet:

| Role | Private key env | Public address env |
|---|---|---|
| Backend (scholarship payer) | `PRIVATE_KEY` | `NEXT_PUBLIC_ADDRESS` |
| Churches fund | `CHURCHES_WALLET_PRIVATE_KEY` | `NEXT_PUBLIC_CHURCHES_WALLET_ADDRESS` |
| Referral rewards | `PRIVATE_KEY_REFERRAL_WALLET` | `NEXT_PUBLIC_REFERRAL_WALLET_ADDRESS` |
| pdJ treasury | — | `NEXT_PUBLIC_PDJ_TREASURY_ADDRESS` |
| UBI fund | — | `NEXT_PUBLIC_UBI_WALLET_ADDRESS` |
| Reserves | — | `NEXT_PUBLIC_RESERVE_MULTISIG_ADDRESS`, `NEXT_PUBLIC_LEARN_TG_RESERVE_ADDRESS`, `NEXT_PUBLIC_STABLE_SL_RESERVE_ADDRESS` |
| Verifier (admin) | — | `NEXT_PUBLIC_VERIFIER_WALLET` |

`.env.example` states: *"Separate wallet addresses (set to different addresses
for mainnet)"*.

### Development — single wallet

The development site (`https://learn.tg:9001`) uses **one wallet** for all
roles. In the local `apps/.env`, every address collapses to the same account
(backend = treasury = referral = churches = verifier).

Note: the remote dev server exposes its own addresses via the API (e.g. the
churches fund endpoint returned `0x01a72816…`, distinct from the local
wallet), so the remote dev server's own `.env` may differ from this repo's
`apps/.env`.

### The local `.env` wallet (this machine)

The `apps/.env` in this repo holds a **different** wallet from the site
wallets:

- Address: `0x84272a6dd0D5fE9ea2Ab28Cf96e72f4F7da00C5C` (`NEXT_PUBLIC_ADDRESS`)
- Private key: `PRIVATE_KEY` (`0x81b9…`) — the "Hardhat test key" used by the
  E2E suites.
- Registered on **both** development and production.
- On the development site it is a **verifier** (confirmed by
  `e2e/smoke/prerequisites.spec.mjs`: "Verifier confirmed", 3 configured). It
  has a dev profile (userId 191, "DS Dev", profile score 75) and can claim
  CELO UBI (0.75 CELO, mined on Sepolia).
- It has been used for deployment tests: `bin/deploy*` scripts read
  `PRIVATE_KEY`, and `doc/deploy-credentials.md` uses it for `MINTER_ROLE`.

## Local run modes

### 1. Frontend-only (proxy to development) — light

Run only the Next.js client and proxy API requests to the development site.

`apps/.env` (default in this repo):

```
NEXT_PUBLIC_API_URL=https://learn.tg:9001/api
NEXT_PUBLIC_API_BASE=https://learn.tg:3500/learntg-admin
```

```sh
cd apps/nextjs
bin/dev          # Next.js on http://localhost:4000
```

`next.config.ts` rewrites `/api/* → ${NEXT_PUBLIC_API_URL}/:path*`, so the
local frontend uses the remote dev backend for courses, auth, and rewards.
Useful for UI-only frontend work. No database, no Rails, no blockchain writes
needed locally.

### 2. Full stack (Rails + Next.js, no proxy) — heavy

Run the Rails backend and Next.js locally, pointing the frontend at the local
Rails instance. Useful for testing backend+frontend changes together.

Verified on this VM (adJ/OpenBSD 7.8, Ruby 3.4.9, PostgreSQL 17.9). The
database `learntg_des` already exists (132 tables); the DB credentials come
from `apps/.env` (`PGUSER=learntg`, `PGPASSWORD`, `PGDATABASE=learntg_des`).

Setup steps, in order:

```sh
# 1. servidor/.env from the plantilla, using apps/.env DB data
cd servidor
cp .env.plantilla .env
# edit: BD_CLAVE=<PGPASSWORD from apps/.env>, BD_USUARIO=learntg,
#       BD_DES=learntg_des, BD_SERVIDOR=/var/www/var/run/postgresql,
#       DIRAP=/var/www/adJ-ia/learn.tg/servidor/, IPDES=127.0.0.1

# 2. Install native gems (bundler install fails at `chown root:bin`; use
#    `doas gem install -N --install-dir <BUNDLE_PATH>/ruby/3.4/ ...`, which
#    works from any shell). Native gems: bcrypt bootsnap libxml-ruby pg puma
#    nio4r unicorn kgio raindrops sassc ffi msgpack redcarpet bindex
#    websocket-driver etc.
doas gem install -N --install-dir /var/www/adJ-ia/bundler/ruby/3.4/ bcrypt -v 3.1.22
doas gem install -N --install-dir /var/www/adJ-ia/bundler/ruby/3.4/ pg -v 1.6.3
doas gem install -N --install-dir /var/www/adJ-ia/bundler/ruby/3.4/ libxml-ruby -v 5.0.6
# ... (zsh users may use the `gemil` helper instead; not required)

# 3. rbsecp256k1 needs autotools + GNU libtool:
doas pkg_add -I autoconf-2.69p3 automake-1.16.5p0 metaauto-1.0p4 libtool-2.4.2p3
AUTOMAKE_VERSION=1.16 AUTOCONF_VERSION=2.69 doas gem install -N --install-dir /var/www/adJ-ia/bundler/ruby/3.4/ rbsecp256k1 -v 6.0.0
bundle check   # -> "The Gemfile's dependencies are satisfied"

# 4. JS deps + asset build
CXX=c++ yarn install
bundle exec bin/rails msip:enlaces_motores   # engine asset symlinks
yarn build:css                                # postcss -> app/assets/builds/application.css
yarn build                                    # esbuild -> app/assets/builds/*.js
bundle exec bin/rails assets:precompile

# 5. Run the server (must be via `bundle exec`; dotenv lives in the bundle
#    path, not the system gem path). Use R=f to skip the heavy setup steps.
ulimit -d 7340032 && R=f bundle exec ./bin/corre
# -> Puma on http://127.0.0.1:3000, admin at /learntg-admin

# in apps/.env switch the frontend to local endpoints (verified):
#   NEXT_PUBLIC_API_URL=                    (empty -> Next.js serves /api itself)
#   NEXT_PUBLIC_API_BASE=http://localhost:3000/learntg-admin
#   NEXT_PUBLIC_SELF_ENDPOINT=http://localhost:4000/api/self-verify
#   (course list/detail come from Next: /api/course-catalog — R-#233 §4.4)
#   NEXT_PUBLIC_AUTH_URL=http://localhost:4000
#   NEXTAUTH_URL=http://localhost:4000
cd ../nextjs && bin/dev   # http://localhost:4000
```

Important details discovered while verifying:

- **`ulimit -d` must be >= 7 GB** (`bin/dev` in `apps/nextjs` enforces this;
  `bin/corre` does not, but Rails + assets need the memory).
- **`bin/corre` must run via `bundle exec`** — plain `./bin/corre` fails with
  `cannot load such file -- dotenv` because `BUNDLE_DISABLE_SHARED_GEMS=true`
  puts gems in `/var/www/adJ-ia/bundler`, not the system path.
- **No asset load-path config needed.** sprockets-rails auto-adds every
  existing directory under `app/assets/` to the load path at boot
  (`existent_directories`). So once `yarn build` creates `app/assets/builds/`,
  `stylesheet_link_tag "application"` resolves to the built `application.css`.
  Just start the server *after* `yarn build` (the normal `bin/corre` flow
  already does). `R=f` skips `yarn build`, so a fresh-checkout `R=f` run 500s
  until `yarn build:css` + `yarn build` run once and the server restarts.
- **`R=f` skips asset building**, so the first run needs the `msip:enlaces_motores`
  + `yarn build:css` + `yarn build` steps done manually (or run `bin/corre`
  without `R=f` once).

This mode is memory/CPU intensive and not pre-provisioned in the shared VM:
no `servidor/.env`, no DB credentials in env, native gems and JS deps missing.
It must be set up once before first run.

### 3. Next-only (no Rails) — how the site runs today

Since R-#233 (Phase 1 + §4.4 + Phase 2, 2026-09-15) the **public site does not
call Rails at runtime**: the course catalog comes from Next
(`/api/course-catalog`), the verifier admin UI uses Next's `/api/admin/*`, and
every authenticated call is same-origin with the NextAuth session cookie (no API
token, no Rails session). Verified on dev with Rails stopped: `prerequisites`
6/6, `fresh-wallet-first-connect`, `ux-mobile-menu`, `premium-course-checkout`
and `full-flow` all green.

Requirements:

- `NEXT_PUBLIC_API_URL` **empty** (otherwise `next.config.ts` proxies `/api/*`
  to that host). `NEXT_PUBLIC_API_BASE` is unused by app code.
- The shared PostgreSQL DB is the integration point; new schema changes are
  Next-side migrations (`bin/m db:migrate`).

Rails is kept only as an on-demand backoffice (MSIP UI + Devise on `:3250`
prod / `:3500` dev, `usuarios#foto`, its historical migrations). The
`rails-health` smoke skips when Rails is down unless `RAILS_CHECK=1`; see
R-#233 §8 for the plan and pending decisions.

**Production runs without Rails since 2026-09-15**: the operator stopped the
service that day and **removed it from `/etc/rc.conf.local`**, so it does not
start at boot any more. Verified against `https://learn.tg` with Rails down:

- Pages 200: `/`, `/en`, `/es`, `/en/transparency`, `/en/leaderboard`,
  `/en/web3-and-ubi/guide1`, `/en/gdcluster/guide1`; APIs:
  `/api/course-catalog` and `/api/course-catalog/1` return the real catalog
  (served by Next, so `NEXT_PUBLIC_API_URL` is empty as required).
- SIWE on chain 42220 works: `/api/auth/session` returns the address,
  `/api/profile`, `/api/notifications`, `/api/referral/code` and
  `/api/user-transactions/<userId>` answer 200 with the session cookie, and 401
  without it (no token anywhere).
- `GET /api/auth/token` (removed in R-#233 Phase 2) 404s/falls through to
  NextAuth, which confirms the deployed code is the Rails-free one.
- Read-only smokes green: `landing-page` 3/3, `leaderboard`,
  `verification-timezone` 4/4, `pastor-bonus` 6/6 (churches fund 282.15 SLEARN).
- The app code has no runtime reference to Rails (`NEXT_PUBLIC_API_BASE`,
  `learntg-admin`, `:3250/:3500`, `proyectosfinancieros`) and it has no mailer.

What is lost while Rails is stopped: the MSIP backoffice UI (`:3250`), anything
that used it for data fixes or `usuarios#foto`, and any email sent from Rails
(Devise resets). Verifier work is unaffected: it lives in the Next admin UI
(`/{lang}/admin` → `/api/admin/*`, e.g. `/api/admin/check-verifier`).

### 4. Local browser / PWA testing (`bin/dev` + Chrome)

The app (and most of the PWA) can be exercised in a local browser without
deploying to the dev site. This is how the service worker registration, the
manifest and the install prompt were first checked (2026-09-15).

This local server is the **agent's sandbox** (and where local E2E specs are run);
it is not the official development site (`learn.tg:9001`, another machine, see
*Who runs what* above) and the operator does not need it for manual testing.

```sh
cd apps/nextjs
bin/dev          # Next.js on http://localhost:4000 (PORT in apps/.env)
```

- **Open `localhost`, not `127.0.0.1`.** `authorize()` in
  `app/api/auth/auth-options.ts` accepts `learn.tg`, `learntg.pdj.app` and their
  `:9001`, plus — outside production — `localhost`, `localhost:4000` and
  `localhost:4300`. SIWE signs `window.location.host`, so the host you type is the
  host inside the signed message; anything else fails the check.
- Chrome treats `http://localhost` as a **secure context**, so the service worker
  registers and the install prompt can appear **over plain HTTP**: no certificate
  is needed for local PWA checks.
- **The worker is generated in development too** (next-pwa is only disabled with
  `NEXT_PUBLIC_PWA_DISABLE=1`), so `bin/dev` serves `/sw.js` and
  `components/ServiceWorkerRegistrar.tsx` registers it. Locally you can verify:
  DevTools > Application > Service Workers (`sw.js` activated, page controlled),
  the manifest (`/manifest.webmanifest`), the icons and the install prompt.
  `next.config.ts` also sets `allowedDevOrigins: ['learn.tg', '127.0.0.1']`.
- **Offline cannot be tested on a dev server**: `next-pwa` forces `NetworkOnly`
  in `next dev` (no cache, no precache). For offline, stop the dev server (the
  Makefile `build-guard` refuses to build while `next dev` runs), run `make all`
  and start with `bin/start`.
- `NEXT_PUBLIC_PWA_DISABLE=1 bin/dev` builds with the PWA off; that is how to
  verify the cleanup path (the registrar unregisters any leftover worker and
  deletes its caches), and it is also what the unit tests of
  `ServiceWorkerRegistrar` cover.
- For local **HTTPS** (needed to test from another device, e.g. a phone) use
  `pnpm dev` (the package script), which listens on `:4300` with the certificate
  in `../../.cert/` (`llave.pem`, `cert.pem`). A phone on the LAN still needs its
  host added to the `authorize()` allowlist, or the SIWE check rejects it.
- What the local instance talks to comes from `apps/.env`: with
  `NEXT_PUBLIC_API_URL` empty it serves `/api` from the shared PostgreSQL DB (run
  mode 3); set `NEXT_PUBLIC_API_URL=https://learn.tg:9001/api` to proxy to the
  development site instead (run mode 1).

**Driving the browser from Node.** The E2E helpers (`@pasosdejesus/m/e2e`)
resolve from `apps/nextjs`, so a throwaway script placed inside the app
(`e2e/tmp-*.mjs`, not committed — see `e2e/tmp-hyd-probe.mjs`) can drive the local
instance step by step:

```sh
cd apps/nextjs
CHROME_PATH=/usr/local/bin/chrome IPDES=localhost PUERTOPRU=4000 CHAIN_ID=11142220 \
  node e2e/tmp-mi-prueba.mjs
```

`SITE_URL` + `NEXT_PUBLIC_AUTH_URL` are the alternative to `IPDES`/`PUERTOPRU`.

**The E2E specs also run against the local instance** (no dev-site deploy needed).
The helper of `m` fixes `base` as `https://${IPDES}:${PUERTOPRU}`, so each spec
resolves its target with `e2e/helpers/site-target.mjs` (`resolveSiteTarget(env)`),
which honours `SITE_URL` and derives `host`/`domainPort` from it (the SIWE must
sign the host you actually visit, R-#233). Recipe:

```sh
cd apps/nextjs
NEXT_PUBLIC_PWA_DISABLE=1 bin/dev            # http://localhost:4000
bin/warmup-local.mjs                          # 24 rutas, secuencial
SITE_URL=http://localhost:4000 IPDES=localhost PUERTOPRU=4000 CHAIN_ID=11142220 \
  CHROME_PATH=/usr/local/bin/chrome node e2e/specs/<spec>.spec.mjs
```

Return the exit code: a spec that prints `❌` and exits 0 is a bug of the spec
(`doc/e2e-testing.md`). Measured 2026-09-21 on this VM (all of them exit 0):
`header-wallet-dialog`, `in-app-wallet`, `auth-session`,
`church-persistence`, `ux-mobile-menu`, `connect-wallet-flow`,
`wallet-event-disconnect`, `fresh-wallet-first-connect`. Whose fail locally and
why: `profile-data` and `admin-dashboard` hit the navigation race known from
https://github.com/pasosdeJesus/learn.tg/issues/213
(`Execution context was destroyed`), `town-autocomplete` needs data/keys the dev
site has (`Failed to fetch`), `offline-guide` needs a production build and
`offline-crossword` leaves one answer queued locally (the replay needs the rewards
stack). So: **use local for the UI/session specs** and the dev site for the specs
that write on-chain or need the deployed content; the throwaway script remains the
fastest path for a one-off UI probe.

Note: `page.waitForTimeout()` no longer exists in the bundled Puppeteer
(24.x); use a small `sleep()` helper.

### HTTPS local (opcional, nginx)

`http://localhost` ya es contexto seguro para Chrome (service worker y WebAuthn
funcionan sin TLS: medido el 2026-09-21, el desbloqueo con passkey se completó en
`http://localhost:4000`), así que los specs corren en HTTP. HTTPS solo hace falta
para probar desde otro dispositivo, o para reproducir el proxy del dev site
(`Host $http_host` y el upgrade de `/_next/hmr`, ver `doc/siwe-auth-flow.md` §4).
Alternativa sin root: `pnpm dev` (HTTPS en `:4300` con el certificado de `.cert/`).
Con nginx hay que agregar a `/etc/nginx/nginx.conf`, dentro del bloque `http {}`
(requiere root: `doas nginx -t && doas nginx -s reload`):

```nginx
server {
    listen       4300 ssl;          # authorize() ya permite localhost:4300
    server_name  localhost;
    ssl_certificate      /var/www/adJ-ia/learn.tg/.cert/cert.pem;
    ssl_certificate_key  /var/www/adJ-ia/learn.tg/.cert/llave.pem;

    location / {
        proxy_pass         http://127.0.0.1:4000;   # bin/dev o bin/start
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;   # /_next/hmr (sin esto Next 16 no hidrata)
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $http_host;         # NO $host: el puerto entra en el SIWE
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
```

Notas para OpenBSD/adJ: el nginx del paquete usa `/var/www` como prefijo (los
`error_log` y temporales relativos se resuelven ahí) y necesita root, así que un
nginx de usuario no sirve; el certificado debe ser legible por el usuario de nginx;
y cualquier puerto distinto de `4300` hay que agregarlo al allowlist de
`authorize()` (no producción: `localhost`, `localhost:4000`, `localhost:4300`).
Prueba:

```sh
SITE_URL=https://localhost:4300 IPDES=localhost PUERTOPRU=4300 CHAIN_ID=11142220 \
  CHROME_PATH=/usr/local/bin/chrome make test-e2e-spec SPEC=header-wallet-dialog
```

Cambiar `$http_host` por `$host` en ese bloque es la forma de reproducir el fallo
`DOMAIN_MISMATCH` documentado en `doc/siwe-auth-flow.md` §4.

## Contract addresses

Contract addresses are **not** read from `.env`. They come from:

- `@pasosdejesus/mpdj/blockchain/ecosystem-addresses` — `SLEARN_ADDRESSES`
  (helper `deployments` en el motor `@learn-tg/rewards`, https://gitlab.com/pasosdeJesus/m/-/work_items/35 — `packages/rewards/src/lib/deployments.ts`)
- `@pasosdejesus/mpdj/blockchain` — credentials (SBTs)
- `@pasosdejesus/m/blockchain/deployments` (`readDeployment()`) reading
  `apps/hardhat/deployments/<Contract>/<network>.json` — vaults
  (`LearnTGVaults` V3/V4/V5), `ClusterFunds` (V1) y `ClusterFundsV2` (https://github.com/pasosdeJesus/learn.tg/issues/214;
  la app opera con V2)

> `apps/hardhat/deployments/` está en `.gitignore` (artefacto de despliegue): un clon
> nuevo no trae esos JSON y sin el archivo de la red `getClusterFundsAddress()`
> (`packages/gdcluster/src/lib/gd-cluster-routing.ts`) lanza
> `ClusterFundsV2 not deployed — address not found` (no es error de compilación).
> Detalle y direcciones conocidas en
> [apps/hardhat/README.md](../apps/hardhat/README.md) §Deployment Addresses.

## Notes

- pnpm is pinned to v10 (`packageManager: pnpm@10.34.5`); pnpm v11 breaks
  React 19 tests.
- The E2E suites default to `https://learn.tg:9001`; override with
  `SITE_URL` / `NEXT_PUBLIC_AUTH_URL`. Production-targeting specs exist
  (chain 42220).
- The dev server (`:9001`) runs behind **nginx**. The proxy location that
  forwards to `next dev` must (a) forward the WebSocket upgrade for
  `/_next/hmr` (`proxy_http_version 1.1` + `Upgrade`/`Connection` headers) or
  Next 16 dev never hydrates, and (b) forward `Host $http_host` (not `$host`)
  so the SIWE domain matches `window.location.host` on the non-default port.
  See [e2e-testing.md](e2e-testing.md) and [siwe-auth-flow.md](siwe-auth-flow.md).
- **Dev DB — migración de entrevistas:** `usuario.proposed_date_of_interview`
  debe estar en `timestamptz` (migración
  `20260822000000_proposed_interview_timestamptz`); la columna `date` original
  rompe la hora (2PM → 5AM). Aplicar en la BD dev con
  `bin/m db:console "ALTER TABLE usuario ALTER COLUMN proposed_date_of_interview TYPE TIMESTAMPTZ USING (proposed_date_of_interview::timestamp AT TIME ZONE 'UTC');"`.
- **Dev SLEARN roles:** para donaciones al vault/país en dev, el backend dev
  (`0x01a728…`) debe tener `MINTER_ROLE` en SLEARN Sepolia y ClusterFundsV2
  dev (`0xcA9c6A…`) también (el cashback de donaciones usa
  `SLEARN.mintAndReserve`). En mainnet ya están otorgados (ver
  [runbook.md](runbook.md) §4).
- **RPC:** forno a veces retrasa indexar receipts recién minados; el backend
  usa `fetchTxWithReceipt` (multi-RPC: forno/ankr/drpc/publicnode). Ver
  [runbook.md](runbook.md) §5.

## Operación en la máquina compartida (prod + dev, 16G RAM)

La misma máquina aloja **producción** (`https://learn.tg`) y **desarrollo**
(`https://learn.tg:9001`) con **16G RAM + 16G swap** y otras aplicaciones.

### Dos modos para servir el sitio de desarrollo

`learn.tg:9001` puede correr de dos maneras y **no son equivalentes**:

| Modo | Cómo se arranca | Ventaja | Desventaja |
|---|---|---|---|
| **Dev server** | `bin/dev` (`next dev`, con HTTPS) | **Los errores son más legibles y se ubican en las fuentes**: traza y overlay de Next apuntando al archivo y la línea, más HMR al editar | **No permite probar la parte offline** (`next-pwa` fuerza `NetworkOnly`: el service worker se registra pero no hay caché de páginas ni fallback `/offline`), **es lento** (compila cada ruta bajo demanda) y **exige warmup** |
| **Build de producción** | `make all` + `bin/start` (o `make prod`, que compila y arranca) | Es el **comportamiento real**: las rutas salen compiladas del build (rápido, **sin warmup**) y el PWA funciona de verdad (service worker, offline, instalación, `make test-e2e-offline`) | **Los errores llegan minificados y sin la ubicación en las fuentes**, así que para diagnosticar hay que apoyarse en el log del servidor (`instrumentation.ts` → `/tmp/learn-tg-server-errors.log`, `SERVER_ERROR_LOG`; ver `doc/e2e-testing.md` §Diagnóstico de errores del servidor) |

**Regla práctica:** elige por lo que estés verificando. Si la duda es **offline, service worker, instalación o
rendimiento real**, usa el build de producción (`make all` + `bin/start`) — y no hace falta warmup. Si la duda es
**un error del servidor o del render y quieres la traza con archivo y línea**, usa `bin/dev`, sabiendo que ahí la
parte offline no se puede probar, que va lento y que hay que calentar con
`bin/warmup.mjs`. `bin/warmup-local.mjs` (secuencial) es el equivalente para un `bin/dev` en
`localhost:4000`; no uses `bin/warmup.mjs` contra local (su pasada en paralelo tumba al `next dev` de esta VM,
ver `doc/e2e-testing.md`).

### Reglas para no tumbar la máquina

(Lección https://gitlab.com/pasosdeJesus/m/-/work_items/35 §12.8: un `next build` con 15 workers × heap grande
derribó el dev server por OOM.)

1. **NO compilar mientras el dev site sirve requests ni mientras corre la
   suite E2E.** `make all`/`make prod` verifican con `build-guard` que no haya
   `next dev` activo (aborta con instrucciones). Si la suite E2E está en
   marcha, espera a que termine antes de compilar.
2. **Presupuesto de memoria del build:** `webpack.parallelism = 8` (variable
   `WEBPACK_PARALLELISM`) y `--max-old-space-size=2048` (Makefile y
   `bin/prod.sh`). No subir sin medir: 8 × 2048 MB ya compite con prod.
3. **La suite E2E agrega carga al dev site** (SIWE + claims + páginas). Correr
   en horas de bajo tráfico de prod, o desde la VM de desarrollo (ya tiene
   Chromium en `/usr/local/bin/chrome`), con `PUERTOPRU=9001 CHAIN_ID=11142220`.
4. **Secuencia recomendada al desplegar cambios en dev** (modo build de producción):
   1. Detener el servidor del dev site (`pkill -f 'next dev'` o el servicio).
   2. `make all` (compila sin competencia de memoria; incluye `engines-dist`, obligatorio si cambió `packages/`).
   3. Arrancar (`bin/start`, `make prod` o el servicio).
   4. `make test-smoke` y luego `make test-e2e` (m 0.20.1+ rota billeteras y
      pausa entre specs; ver `E2E_SPEC_DELAY_MS`). Aplicar las migraciones pendientes del sitio
      (`bin/m db:migrate`) en la misma ventana que el despliegue.

   Si en cambio el dev site se sirve con **dev server** (`bin/dev`), después de arrancar hay que
   **calentar con `bin/warmup.mjs`** antes de los specs (paso que en el modo build no existe).

## Motores locales (packages/) y pruebas E2E

### Compilar los motores antes de dev/build

Los motores (`packages/rewards`, `packages/gdcluster`) se consumen vía `exports`
→ `dist/`, y `dist/` **no está en git** (artefacto de build). Tras un checkout
fresco hay que compilarlos; imports con `src/` quedan bloqueados por el exports
map (error "not exported from package").

```sh
cd apps/nextjs
make engines-dist        # compila dist de packages/{rewards,gdcluster} (rewards primero)
make engines-assets      # copia assets de los motores a public/ (p.ej. gdcluster.svg)
make engines-sync-abis   # tras regenerar abis en hardhat: copia a src/abis/ y recompila
bin/dev                  # ya ejecuta engines-dist automáticamente; Next en :4000 (modo 2 local)
```

`engines-dist` también compila `pdj-wallet` y `pdj-wallet-next`. El motor
`pdj-wallet` además necesita **sus propias dependencias** (`pnpm install` dentro
de `packages/pdj-wallet`): los specs E2E lo importan desde Node (R-#239) y Node
ESM resuelve `viem` desde la carpeta del paquete, no desde `apps/nextjs`. Su
build usa `moduleResolution: nodenext` (extensiones `.js` explícitas en `dist/`)
por la misma razón.

Pruebas unitarias de esos dos paquetes (viven en el Makefile de la app, igual
que la integración):

```sh
cd apps/nextjs
make test-packages          # pdj-wallet + pdj-wallet-next (85 + 24, ~50 s)
make test-pdj-wallet        # solo el core
make test-pdj-wallet-next   # solo React (compila el core por ti)
```

Cada paquete tiene su propio `Makefile` (`make test`, `make build`, `make install`).

`build-guard` (en `make all`/`make prod`) aborta si el dev server está activo
(no compilar mientras sirve: máquina compartida, ver arriba).

### E2E contra el sitio de desarrollo

```sh
node bin/warmup.mjs      # solo si el sitio se sirve con dev server; pre-compila ~34 rutas (compilación ≠ ausencia de respuesta)
```
- **Smoke directo** (con `node`, no `bin/m`: el CLI recarga `.env` con
  `override:true` y pisa `NEXT_PUBLIC_AUTH_URL`):
  ```sh
  PK=$(grep '^PRIVATE_KEY=' ../.env | cut -d= -f2- | tr -d '"')
  for f in e2e/smoke/*.spec.mjs; do SITE_URL=https://learn.tg:9001 \
    NEXT_PUBLIC_AUTH_URL=https://learn.tg:9001 \
    NEXT_PUBLIC_API_BASE=https://learn.tg:3500/learntg-admin \
    PRIVATE_KEY=$PK NODE_TLS_REJECT_UNAUTHORIZED=0 node "$f" || echo "FAIL $f"; done
  ```
- **Browser specs**: `PUERTOPRU=9001 CHAIN_ID=11142220 make test-e2e` (12s de
  aire entre specs vía `E2E_SPEC_DELAY_MS`).
- **m ≥ 0.21**: `initTestEnv` lee `apps/.env` (billetera local registrada en el
  sitio), soporta `TEST_PRIVATE_KEYS` (multi-billetera), y el runner rota
  `WALLET_INDEX` por spec. Billeteras extra deben estar registradas en el sitio
  (SIWE 401 si no).
- **Retries**: `e2e/helpers/retry.mjs` (`retry`/`retrySpec`); los specs de claim
  reconectan la billetera (limpiar sesión + re-SIWE) si el botón no aparece.
- Rails admin del dev: `https://learn.tg:3500/learntg-admin` (404 si Puma/nginx
  caído); local full-stack: Puma en `127.0.0.1:3000`.
