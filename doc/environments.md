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
| Rails admin API | served on the production host | `https://learn.tg:3500/learntg-admin` |
| Next.js API | same host | same host (`:9001`) |
| Wallets | one per role (below) | single wallet for all roles |
| Data | real users | development data |

Chain IDs confirmed by the E2E suites: specs targeting `https://learn.tg`
report `chain: 42220` (mainnet), specs targeting `https://learn.tg:9001`
report `chain: 11142220` (Sepolia).

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
#   NEXT_PUBLIC_API_BUSCA_CURSOS_URL=http://localhost:3000/learntg-admin/proyectosfinancieros.json
#   NEXT_PUBLIC_API_PRESENTA_CURSO_URL=http://localhost:3000/learntg-admin/proyectosfinancieros/curso_id.json
#   NEXT_PUBLIC_SELF_ENDPOINT=http://localhost:4000/api/self-verify
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

## Contract addresses

Contract addresses are **not** read from `.env`. They come from:

- `@pasosdejesus/mpdj/blockchain/ecosystem-addresses` — `SLEARN_ADDRESSES`
  (see `apps/nextjs/lib/deployments.ts`)
- `@pasosdejesus/mpdj/blockchain` — credentials (SBTs)
- `@pasosdejesus/m/blockchain/deployments` (`readDeployment()`) reading
  `apps/hardhat/deployments/<Contract>/<network>.json` — vaults
  (`LearnTGVaults` V3/V4/V5), `ClusterFunds` (V1) y `ClusterFundsV2` (REQ/214;
  la app opera con V2)

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
