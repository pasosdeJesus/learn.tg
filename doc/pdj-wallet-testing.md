# Testing the pdj-wallet packages and the PWA

How to test the in-app wallet (`packages/pdj-wallet`,
`packages/pdj-wallet-next`), its integration in learn.tg, and the PWA shell
(service worker, manifest, offline fallback).

Specs: https://github.com/pasosdeJesus/learn.tg/issues/245 (testing plan),
https://github.com/pasosdeJesus/learn.tg/issues/244 (MVP),
https://github.com/pasosdeJesus/learn.tg/issues/240 (service worker).

The goal is a fast loop: seconds, not the ~45 minute full E2E suite.

## 1. Unit: the packages

Both packages ship their own `vitest.config.ts` (a plain object with an alias
map onto `apps/nextjs/node_modules`). Run them from `apps/nextjs`, which owns
the dependency graph and the installed `vitest`:

```sh
cd apps/nextjs

# Core wallet: create/import/unlock/sign, crypto, provider (18 tests, ~8 s)
./node_modules/.bin/vitest run --root ../../packages/pdj-wallet \
  --config ../../packages/pdj-wallet/vitest.config.ts

# React layer: useInAppWallet + components (14 tests, ~7 s)
./node_modules/.bin/vitest run --root ../../packages/pdj-wallet-next \
  --config ../../packages/pdj-wallet-next/vitest.config.ts
```

Expected: `18 passed | 1 skipped` and `14 passed`.

The skipped one is `IndexedDBStorage`: `fake-indexeddb` is declared in
`packages/pdj-wallet/package.json` but not installed, so the test self-skips.
Install it (`pnpm install` in `apps/nextjs`) to enable it.

`pnpm test` inside a package goes through corepack, which resolves pnpm 11 here
while the repo is pinned to pnpm 10; the commands above avoid that.

## 2. Integration in learn.tg

```sh
cd apps/nextjs
make test-hooks test-components
```

Expected: `lib/hooks/__tests__` 74 passed / 2 skipped and
`components/__tests__` 104 passed / 3 skipped (numbers as of 2026-09-15).

What these cover:

- `useAuthAddress` precedence (`sessionAddress || inAppAddress || storedAddress`)
  and the `inAppAddress` / `isInAppUnlocked` fields.
- `WalletSelector` states (mocked `useInAppWallet`) and its use from `Header`
  and `Layout` (both tests mock `@/components/WalletSelector`).
- `useOfflineStatus` and `OfflineBanner` (3 tests each).
- Locking or deleting the in-app wallet signs out (`WalletEventListener`).
- Offline guide reading: `useCachedGuide` (6 tests) and the IndexedDB store
  `lib/offline-guide-db.ts` (4 tests). jsdom has no IndexedDB, so these exercise
  the in-memory fallback; install `fake-indexeddb` to cover the real store.
- Offline crossword queue: `lib/__tests__/offline-queue-db.test.ts` (5) and
  `lib/hooks/__tests__/useOfflineQueue.test.ts` (5).

If a hook test fails to resolve `@learn-tg/pdj-wallet`, the aliases at the top
of `apps/nextjs/vitest.config.ts` are missing (the linked
`packages/pdj-wallet-next/dist/*.js` imports the core as a bare specifier, which
Vite cannot resolve from outside the app root). Order matters:
`@learn-tg/pdj-wallet-next` must be listed before `@learn-tg/pdj-wallet`.

## 3. Minimal E2E

`e2e/specs/in-app-wallet.spec.mjs` creates the wallet in `/en/test/wallet`,
unlocks it, signs in with SIWE and checks the session cookie. It **skips** when
that page is not deployed (the dev site serves `main` today):

```sh
cd apps/nextjs
CHROME_PATH=/usr/local/bin/chrome make test-e2e-spec SPEC=in-app-wallet
```

It must end with a real NextAuth **session cookie** (there is no API token since
R-#233 Phase 2), so any Node-side call has to forward the `Cookie` header
captured from the browser context.

`e2e/specs/offline-guide.spec.mjs` visits `/en/gdcluster/guide1` online, goes
offline, reloads and checks that the guide is still readable and that the
offline banner shows. It needs the service worker, so it **skips** when the PWA
is not deployed:

```sh
cd apps/nextjs
CHROME_PATH=/usr/local/bin/chrome make test-e2e-spec SPEC=offline-guide
```

## 4. Manual: service worker, manifest and offline

Prerequisites: the branch deployed to the dev site (`https://learn.tg:9001`),
Chrome on a phone (or desktop Chrome with device emulation).

1. Open `https://learn.tg:9001/<lang>` and reload once. The service worker is
   registered (`register: true`, `skipWaiting: true`).
2. DevTools > Application > Service Workers: `sw.js` is activated.
   Application > Manifest: name "Learn.tg - Learn through games", icons
   `/icons/learntg-*.png`.
3. Install: Chrome menu > "Add to Home Screen" / install icon in the address
   bar. The app opens standalone (`display: standalone`).
4. Visit `/en` and `/en/gdcluster/guide1` while online (they get cached).
5. Network throttling > Offline (or airplane mode), then reload `/en`: the page
   still renders from cache (`NetworkFirst` for `/[en|es]/*`, 24 h).
6. Navigate to `/offline`: the fallback page is shown. Uncached navigations show
   it automatically (`fallbacks.document`).
7. With the connection still off, the offline banner ("You are offline. Your
   progress will be saved locally.") shows at the top of every page that uses
   the app shell (`components/Layout.tsx`).
8. Check that `/api/*` POST/PATCH/DELETE are never served from cache
   (`NetworkOnly`).

To discard stale cached pages after deploying changes: DevTools > Application >
Storage > "Clear site data", or unregister the service worker.

## 5. Manual: offline crossword (R-#242)

1. Open `https://learn.tg:9001/en/gdcluster/guide1/test` while online; the puzzle
   is stored in `localStorage` (`crossword-state-<address>`).
2. Turn the connection off and reload: the puzzle is restored without network.
3. Solve it and press submit: instead of an error you get "Sin conexión: tu
   respuesta quedó guardada y se enviará sola cuando vuelvas a tener conexión."
   and a counter `N respuesta(s) guardada(s) sin conexión, pendiente(s) de enviar.`
4. Turn the connection back on: the queue is replayed automatically (watch the
   counter disappear) and the backend processes the reward as usual.
5. If a replayed answer keeps failing it is retried up to five times, then
   dropped (see `MAX_ATTEMPTS` in `lib/offline-queue-db.ts`).

## 6. Troubleshooting (OpenBSD/adJ)

- `CHROME_PATH=/usr/local/bin/chrome` for the browser specs (the m docs also
  mention `/usr/local/bin/chromium`; this VM has `chrome`).
- Browser specs need `IPDES=learn.tg PUERTOPRU=9001 CHAIN_ID=11142220`; running a
  spec directly with `node` does not read them from the Makefile.
- If Puppeteer hangs, remove `/tmp/puppeteer*`.
- A service worker makes "I changed the code but the browser still shows the old
  page" the most likely failure: clear site data before blaming the build.
- Do not run `pnpm build` (or `make all`) while the dev site is serving requests
  or while the E2E suite runs: the shared machine has 16 GB RAM and a build
  competes with production.

## 7. Budget

| Layer | Time | Memory |
|-------|------|--------|
| Package units (both) | ~15 s | <1 GB |
| Integration (`make test-hooks test-components`) | ~2 min | <1 GB |
| Minimal E2E | ~30 s | <1 GB |
| Manual PWA / offline guide / offline crossword | minutes | - |
