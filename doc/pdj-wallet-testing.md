# Testing the pdj-wallet packages and the PWA

How to test the in-app wallet (`packages/pdj-wallet`,
`packages/pdj-wallet-next`), its integration in learn.tg, and the PWA shell
(service worker, manifest, offline fallback).

Specs: https://github.com/pasosdeJesus/learn.tg/issues/245 (testing plan),
https://github.com/pasosdeJesus/learn.tg/issues/244 (MVP),
https://github.com/pasosdeJesus/learn.tg/issues/240 (service worker).

The goal is a fast loop: seconds, not the ~45 minute full E2E suite.

**Device capabilities first:** `public/pdj-wallet-probe.html` is a self-contained
page (no build, no React) that reports what the device can do before any code
depends on it: `isUserVerifyingPlatformAuthenticatorAvailable()`,
`getClientCapabilities()` (`extension:prf`), a real passkey + PRF evaluation, and
whether `localStorage` / `sessionStorage` / **IndexedDB** survive closing and
reopening the app. Open `https://learn.tg:9001/pdj-wallet-probe.html` or
`http://localhost:4000/pdj-wallet-probe.html` (after `bin/dev`), press the four
buttons, and paste the report into
https://github.com/pasosdeJesus/learn.tg/issues/246 §8. It is the input for the
three-layer unlock design (PIN, WebAuthn gesture, WebAuthn PRF).

## 1. Unit: the packages

Both packages ship their own `vitest.config.ts` (a plain object with an alias
map onto `apps/nextjs/node_modules`), and the app's Makefile exposes them like
any other suite:

```sh
cd apps/nextjs

make test-packages          # los dos paquetes (90 + 24 tests, ~50 s)
make test-pdj-wallet        # solo el core (90 tests, ~48 s)
make test-pdj-wallet-next   # solo React; compila el core antes (~12 s)
```

Equivalentes directos (si prefieres el comando crudo):

```sh
cd apps/nextjs
./node_modules/.bin/vitest run --root ../../packages/pdj-wallet \
  --config ../../packages/pdj-wallet/vitest.config.ts
./node_modules/.bin/vitest run --root ../../packages/pdj-wallet-next \
  --config ../../packages/pdj-wallet-next/vitest.config.ts
```

Y dentro de cada paquete hay `Makefile` (`make test`, `make build`, `make install`).

Expected (medido 2026-09-21): `90 passed` (core) y `24 passed` (next). `make test` (la suite completa)
ya incluye `test-packages`.

Lo que cubre el core sobre R-#246: sellado de la clave con el
secreto PRF y comprobación de que el registro guardado **no contiene la clave
privada**, desbloqueo con un gesto, determinismo entre recargas (misma sal → mismo
secreto), el PIN como respaldo, `auth-failed` con un secreto que no coincide,
`no-prf` y `no-webauthn` sin romper, baja/borrado del sello, un sello que
pertenece a otra billetera, y la confirmación de fondos (L1) del proveedor: pide el
gesto en `eth_sendTransaction`, no lo pide en lecturas ni en `personal_sign`, un
gesto cancelado rechaza con código `4001` sin transmitir, sin passkey deja pasar la
transacción y se puede desactivar con `requireUserVerification: false`.

En `pdj-wallet-next` tres pruebas cubren el auto-lock por inactividad: tras
`INACTIVITY_LOCK_MS` (una hora) sin actividad la clave se suelta con
`lockReason: 'idle'`, la actividad real de un teléfono lo reinicia
(`visibilitychange` llega a `document`, no a `window` — el defecto de R-#246), y el
✕ de la cabecera marca `'user'`.

The core package declares its own dependencies (`viem`, `vitest`, `fake-indexeddb`,
`typescript`): run `pnpm install` inside `packages/pdj-wallet` once (`make -C
../../packages/pdj-wallet install`). That is also what enables the
`IndexedDBStorage` test, which used to self-skip because `fake-indexeddb` was not
installed (2026-09-15: now it runs). It is also needed to import the built core
from Node (E2E, R-#239).

`pnpm test` inside a package goes through corepack, which resolves pnpm 11 here
while the repo is pinned to pnpm 10; los targets del Makefile y los comandos de
arriba evitan eso.

## 2. Integration in learn.tg

```sh
cd apps/nextjs
make test-hooks test-components
```

Expected (medido 2026-09-21): `make test-hooks` 83 passed / 2 skipped (12 archivos)
y `make test-components` 169 passed / 3 skipped (21 archivos, incluye
`components/ui/__tests__` y `providers/__tests__`). La suite completa `make test`
da **969 passed / 6 skipped en 135 archivos** (0 fallas), y la mayor parte del
tiempo es el montaje de jsdom por archivo, no las aserciones.

What these cover:

- `useAuthAddress` solo se **mockea** (`useGuideData`); su precedencia
  (`sessionAddress || inAppAddress || storedAddress`) y los campos `inAppAddress` /
  `isInAppUnlocked` **no** los cubre ninguna prueba directa todavía.
- `WalletSelector` states (mocked `useInAppWallet`) and its use from `Header`
  and `Layout` (both tests mock `@/components/WalletSelector`).
- `useOfflineStatus` and `OfflineBanner` (3 tests each).
- Locking or deleting the in-app wallet signs out (`WalletEventListener`).
- Offline guide reading: `useCachedGuide` (6 tests) and the IndexedDB store
  `lib/offline-guide-db.ts` (4 tests). jsdom has no IndexedDB, so these exercise
  the in-memory fallback; install `fake-indexeddb` to cover the real store.
- Offline crossword queue: `lib/__tests__/offline-queue-db.test.ts` (5) and
  `lib/hooks/__tests__/useOfflineQueue.test.ts` (5).
- Both payment modals tell the user to unlock the wallet when it is locked
  instead of the misleading "Connect and sign with your wallet"
  (`DonateModal.test.tsx` and `CheckoutModal.light.test.tsx`, 4 tests): the amber
  notice appears, the old message does not, and the
  `data-testid="wallet-unlock-request"` button dispatches
  `learn-tg:open-in-app-wallet-dialog`.

If a hook test fails to resolve `@learn-tg/pdj-wallet`, the aliases at the top
of `apps/nextjs/vitest.config.ts` are missing (the linked
`packages/pdj-wallet-next/dist/*.js` imports the core as a bare specifier, which
Vite cannot resolve from outside the app root). Order matters:
`@learn-tg/pdj-wallet-next` must be listed before `@learn-tg/pdj-wallet`.

## 3. Minimal E2E

`e2e/specs/in-app-wallet.spec.mjs` creates the wallet in `/en/test/wallet`,
unlocks it, signs in with SIWE and checks the session cookie. On the dev site
(which serves this branch since 2026-09-15) it passes in ~18 s; it **skips**
instead of failing where that page is not deployed:

```sh
cd apps/nextjs
make test-e2e-wallet                                        # = SPEC=in-app-wallet
CHROME_PATH=/usr/local/bin/chrome make test-e2e-spec SPEC=in-app-wallet
```

`e2e/specs/header-wallet-dialog.spec.mjs` drives the **real header + modal**
instead of `/en/test/wallet`: it opens the wallet from the header, creates one,
closes the modal, checks that reopening starts a fresh flow, unlocks from the
header, signs in with SIWE and verifies that the header **keeps the session
after a reload** (the R-#238 regression where it fell back to "Unlock your
in-app wallet"), then disconnects with `✕`. It passes in ~32 s against the dev
site.

```sh
cd apps/nextjs
CHROME_PATH=/usr/local/bin/chrome make test-e2e-spec SPEC=header-wallet-dialog
```

`e2e/specs/donate-unlock-dialog.spec.mjs` cubre el camino que reportó el
operador el 2026-09-16 ("quise donar y el botón de desbloquear no hacía nada"):
con sesión de la billetera in-app (que queda **bloqueada** tras recargar) abre el
modal de donación del curso, presiona el botón del aviso y exige que el diálogo
de la billetera aparezca **encima** (`elementFromPoint`) con el formulario de PIN.
Acepta `SITE_URL` para apuntar a un servidor local (`next dev -p 4000` sirve
HTTP, mientras que `initTestEnv()` siempre arma `https://`).

```sh
cd apps/nextjs
CHROME_PATH=/usr/local/bin/chrome make test-e2e-spec SPEC=donate-unlock-dialog
SITE_URL=http://localhost:4000 IPDES=localhost PUERTOPRU=4000 CHAIN_ID=11142220 \
  CHROME_PATH=/usr/local/bin/chrome ./bin/m test:e2e donate-unlock-dialog
```

`e2e/specs/biometric-unlock.spec.mjs` (R-#246) cubre el desbloqueo por huella con
un **authenticator virtual de Chrome por CDP** (`WebAuthn.addVirtualAuthenticator`
con `hasPrf: true`, que auto-verifica al usuario como haría Face ID): crea la
billetera desde la cabecera, activa "desbloquear con huella la próxima vez",
recarga —la clave salió de memoria— y comprueba que **un gesto** deja la billetera
lista y que el modal de donación deja de pedir desbloqueo.

```sh
cd apps/nextjs
CHROME_PATH=/usr/local/bin/chrome make test-e2e-spec SPEC=biometric-unlock
```

Dos defectos de R-#244 relacionados: (1) `WalletSelector` devolvía la cabecera
con sesión sin montar `WalletDialog`, el único que atiende
`OPEN_IN_APP_WALLET_DIALOG`, así que el evento no tenía quien lo escuchara; (2)
`WalletDialog` volvía a firmar el SIWE aunque la sesión ya fuera de esa
billetera, y el `window.location.reload()` posterior aterrizaba con la clave
fuera de memoria (billetera bloqueada otra vez): un ciclo en el que la donación
nunca se podía completar.

`e2e/specs/offline-crossword.spec.mjs` (R-#242) fills the crossword at
`/en/gdcluster/guide1/test`, submits it offline, checks the `offline-pending`
indicator, reloads and waits for the queue to drain. It needs **no** service
worker, so it also works against a dev server; it signs in with the core through
`e2e/helpers/in-app-wallet.mjs` (R-#239).

It must end with a real NextAuth **session cookie** (there is no API token since
R-#233 Phase 2), so any Node-side call has to forward the `Cookie` header
captured from the browser context.

`e2e/specs/offline-guide.spec.mjs` visits `/en/gdcluster/guide1` online, goes
offline, reloads and checks that the guide is still readable and that the
offline banner shows. It needs the service worker (a **production build**: the
deployed site, or `make all` + `bin/start` locally) and it **skips** when the site
has none:

```sh
cd apps/nextjs
make test-e2e-offline      # = SPEC=offline: corre offline-guide y offline-crossword
CHROME_PATH=/usr/local/bin/chrome make test-e2e-spec SPEC=offline-guide
```

Medido el 2026-09-21 contra el dev site con el build de `make prod`: los dos specs
en **0 failures** (el worker se registra y controla la página, la guía se sirve de
`learntg-pages` sin conexión, 289 caracteres, con el banner, y vuelve a cargar al
recuperar la conexión). En local con `make all` + `bin/start` y
`SITE_URL=http://localhost:4000` el spec también recorre el camino completo, pero
la guía sale corta porque el curso GD es premium y la billetera local no tiene
entitlement.

## 4. Manual: service worker, manifest and offline

Prerequisites: a **production build** deployed (the site, or a dev instance
started with `make all` + `bin/start`), Chrome on a phone (or desktop Chrome with
device emulation). A plain `next dev` instance will not do: next-pwa disables
cache and precache in development, so there is no offline to test (see
`doc/pwa-developer-guide.md`).

1. Open `https://learn.tg/<lang>` and reload once. The service worker is
   registered by `components/ServiceWorkerRegistrar.tsx` (`skipWaiting: true`,
   and `NEXT_PUBLIC_PWA_ENABLED=1` because the build does not set
   `NEXT_PUBLIC_PWA_DISABLE`). On a dev server the worker also registers, but it
   is `NetworkOnly`: offline only works on a production build.
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

No service worker needed: this works on a dev server too.

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
