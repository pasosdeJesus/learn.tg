# PWA developer guide (service worker, manifest, offline)

How the learn.tg PWA is wired, and what to touch when adding cached routes.
Specs: https://github.com/pasosdeJesus/learn.tg/issues/240 (service worker),
https://github.com/pasosdeJesus/learn.tg/issues/243 (install + docs).

## Pieces

| Piece | Where | Notes |
|-------|-------|-------|
| Service worker generation | `next.config.ts` (`withPWA(pwaConfig)`) | `next-pwa@^5.6.0`, `dest: 'public'`, `skipWaiting: true`, `disable: false`, `register: false` (see *Registration*) |
| Generated worker | `public/sw.js`, `public/workbox-*.js` | Build artefacts, gitignored, never edit by hand |
| **Registration** | `components/ServiceWorkerRegistrar.tsx` | Registers `/sw.js` when the build generated it (`NEXT_PUBLIC_PWA_ENABLED`); when the PWA is off (`NEXT_PUBLIC_PWA_DISABLE=1`) it cleans up any leftover worker. next-pwa's auto-register does not work in the App Router |
| Manifest | `public/manifest.webmanifest` | Linked from `app/layout.tsx` metadata (`manifest`); `viewport.themeColor` too |
| Icons | `public/icons/learntg-{180x180,192x192,512x512,maskable-512x512}.png` | Generated from `public/logo-learntg.png` with ImageMagick; the 180 one is the Apple touch icon (`metadata.icons.apple` + `metadata.appleWebApp` in `app/layout.tsx`) |
| Offline page | `app/offline/page.tsx` | Route `/offline`, precached through `additionalManifestEntries` |
| Offline indicator | `components/OfflineBanner.tsx` + `lib/hooks/useOfflineStatus.ts` | Mounted in `components/Layout.tsx` |
| Install prompt | `components/InstallPrompt.tsx` | `beforeinstallprompt`; dismissal stored for 7 days |
| Offline guide copy | `lib/offline-guide-db.ts` + `lib/hooks/useCachedGuide.ts` | Markdown in IndexedDB, used by the guide page |
| Offline course list | `lib/offline-catalog.ts` | Last catalog fetched while online (`localStorage`, `learn.tg.coursesCache.<lang>`); when the fetch fails the course page shows it and toasts "You are offline: showing the saved course list." (operator request 2026-09-21). It only covers "visited once online": the full offline download of courses is https://github.com/pasosdeJesus/learn.tg/issues/256 |
| **Downloaded courses** | `lib/offline-course-db.ts` (store `courses`), `lib/offline-course-download.ts`, `components/OfflineCourseDownload.tsx` | R-#256: an explicit per-course download (all guides + their crosswords, no answers). The guide HTML lives in the existing `guides` store, so the guide page reads it unchanged; the record keeps the entitlement snapshot (wallet), the revision and the size. `/offline` lists the downloaded courses and their guides |
| Offline submissions | `lib/offline-queue-db.ts` + `lib/hooks/useOfflineQueue.ts` | Generic queue (url + body), replayed on `online`; a server rejection (4xx) is exposed as `lastRejection` so the page tells the user instead of leaving the answer queued silently |

The diligent-records app served by the same Next app keeps its own manifest
(`public/manifest.json`) and cache entry; do not remove them.

## Registration

`register: true` **does not work with the App Router**: next-pwa injects its
`register.js` into the webpack `main.js` entry, which the App Router does not
have, and the injection is skipped silently. Verified on the dev site on
2026-09-15: `/sw.js` answered 200 while `navigator.serviceWorker
.getRegistrations()` was empty and no client chunk contained the registration
code (a manual `register('/sw.js')` worked, so it was not a certificate issue).

So the config keeps `register: false` and `components/ServiceWorkerRegistrar.tsx`
(mounted in `app/RootLayoutClient.tsx`) calls
`navigator.serviceWorker.register('/sw.js')`. Verified with Chrome on
`http://localhost:4000`: one registration, activated, page controlled.

**The PWA is enabled by default, in development and in production builds.** The
reason is that the install flow has to be tried on the dev site
(`learn.tg:9001`); `NEXT_PUBLIC_PWA_DISABLE=1` turns it off in a build.
`next.config.ts` computes `pwaDisabled = NEXT_PUBLIC_PWA_DISABLE === '1'`, passes
`disable: pwaDisabled` and injects `NEXT_PUBLIC_PWA_ENABLED` (via `env`); the
registrar reads both flags and, when the PWA is off, **unregisters any leftover
worker and clears its caches** so a browser cannot keep running stale code.

Careful: `next-pwa` still disables cache and precache in development (it forces
`NetworkOnly` and says so in the build log: *"Build in develop mode, cache and
precache are mostly disabled... offline support is disabled"*) and regenerates the
worker on every compile (*"GenerateSW has been called multiple times"*). The
worker is therefore registered on a dev server, but it cannot serve anything
offline.

Consequence for testing: **offline** (guide cache, offline page) can only be
verified on a **production build** (`make all` / `make prod`, the deployed site).
Installability, by contrast, can be tried on the dev site.

Alternatives if this ever breaks: `serwist` (App Router native) or registering
in a `next/script` with `strategy="afterInteractive"`.

## How the service worker caches

`runtimeCaching` entries are matched in order; the first match wins:

| Pattern | Handler | Cache | Lifetime |
|---------|---------|-------|----------|
| `/[lang]/diligent-records*` | NetworkFirst | `diligent-cache` | 30 days |
| `/_next/static/*` | CacheFirst | `diligent-static` | 7 days |
| `/img/*`, `/icons/*` (png/jpg/jpeg/svg/webp/gif) | CacheFirst | `learntg-images` | 30 days |
| `/en/*` and `/es/*` (pages) | NetworkFirst (5 s) | `learntg-pages` | 24 h |
| `/api/*` GET | NetworkFirst (5 s) | `learntg-api-get` | 1 h |
| `/api/*` POST/PATCH/DELETE | NetworkOnly | - | never cached |

`fallbacks.document = '/offline'` shows the offline page when a navigation is not
in any cache. Workbox only serves a fallback it precached, which is why
`additionalManifestEntries` lists `/offline` explicitly.

Consequence for a **downloaded** course (R-#256): a guide that was never opened
online has no entry in `learntg-pages`, so offline navigation to it falls back to
`/offline` even though its content is in IndexedDB. The download therefore warms
that cache with an explicit `fetch()` of each guide URL (`warmPageCache` in
`lib/offline-course-download.ts`): the `/(en|es)/*` rule matches by URL, so the
request lands in `learntg-pages` exactly like a navigation would.

Mind the trade-off: caching `/api/*` GET responses keeps wallet-scoped data in
the device cache for an hour. If a future endpoint must never be stored, give it
its own entry **before** the generic one with `handler: 'NetworkOnly'`.

## Downloaded courses (R-#256)

`components/OfflineCourseDownload.tsx` (inside the course page) downloads a whole
course: every published guide (via `GET /api/guide`, the same HTML the guide page
shows) and its crossword (via `GET /api/crossword`, which already strips the
solution: cells with `letter: ''` and placements with `word: '-'`). The `courses`
store keeps one record per course and language with the guide list, the puzzles,
the revision hash, the size and the wallet that downloaded it.

Rules that must stay true when touching it:

1. **Never store the solution.** The puzzle payload is what the API returns; do not
   add the answers "to validate offline" (validation happens server-side, on
   reconnect, and is derived from the guide markdown — see `lib/guide-answers.ts`).
2. **Paid courses are per wallet.** `belongsToWallet()` gates reading, and
   `/offline` skips a copy downloaded with another wallet.
3. **Christian courses need the privacy switch** (R-#259 §3.3/§3.6b): a
   `contenido_cristiano` course offers no download unless the learner enabled
   "publish courses with Christian content", and the local copy is deleted when
   that switch goes off, when the wallet is disconnected and when the wallet is
   deleted (`clearPrivateCourseCopies()`), so an inspected phone does not reveal
   the affiliation on its own.
4. **Queued answers survive**: cleanup removes the course and its guides, never the
   `pending` store (R-#240 §4b item 9).
5. **Revalidation**: with a connection, a copy older than 24 h is downloaded again
   in the background and the user is told when the revision changed.

## Adding a cached route

1. Add the `runtimeCaching` entry in `next.config.ts`, **before** broader
   patterns (order matters).
2. Prefer `NetworkFirst` for HTML that changes with data (it degrades to the
   cache when offline) and `CacheFirst` for immutable assets.
3. Keep `expiration.maxEntries` small; the browser evicts by quota but being
   explicit avoids surprises on cheap phones.
4. `pnpm build` regenerates `sw.js`; a running dev server needs a restart to pick
   up `next.config.ts` changes.
5. Test: DevTools > Application > Service Workers (`sw.js` activated), then
   Network throttling > Offline and reload.

`next-pwa` is disabled in development by default; this repo sets
`disable: false` because the demo and the manual tests run against the dev site
with a production build. If a service worker starts to hide local changes, clear
site data before debugging anything else.

## Testing

- Unit: `cd apps/nextjs && make test-hooks test-components` (offline status,
  offline banner, install prompt, guide cache, submission queue).
- Manual: `doc/pdj-wallet-testing.md` §4 (service worker, manifest, offline page)
  and §5 (offline crossword).
- The full E2E suite covers the PWA on the deployed **production** build:
  `make test-e2e-offline` runs `offline-guide` (service worker registers and
  controls the page, guide served from `learntg-pages` offline, banner, and back
  online), `offline-crossword` (queue end to end) and `offline-course-download`
  (R-#256: download `/en/web3-and-ubi`, check the stored crossword has no
  answers, open a guide never visited online with the network off). All three
  reported green on 2026-09-21/22. A `next dev` instance still cannot test offline
  (next-pwa forces `NetworkOnly`); use `make all` + `bin/start` locally or the
  deployed site. `offline-course-download` skips itself when the feature is not
  deployed yet (no download button, no worker).

## Generated files and how to retire the worker

next-pwa writes `public/sw.js`, `public/sw.js.map`, `public/workbox-*.js` and
(in dev) `public/fallback-development.js`; all of them are gitignored and
**regenerated on every compile while the PWA is enabled** (the plugin installs a
`CleanWebpackPlugin` for them), so nothing else is needed while the PWA is on.
`make pwa-clean` removes them anyway, and `bin/dev`, `make all` and `make prod`
call it so the state is deterministic when you switch branches or modes.

When the PWA is **disabled** (`disable: true`), none of that runs: an `sw.js`
left behind by an earlier enabled build stays in `public/` and keeps being
served. That is what happened in production between 2026-02-15
(`be6e1c4` enabled the PWA in production) and 2026-07-25 (`9a5675e` disabled
it): the worker generated on the 25th stayed there (37 KB, caching
`_next/static` and `diligent-records`).

Procedure to retire a deployed worker (do not just delete the file: a 404, or
the 500 that `next start` answers for a missing `/sw.js`, fails the update check
and browsers keep the old worker):

1. `make pwa-kill-switch`: copies `scripts/pwa-kill-switch.js` to
   `public/sw.js`, the same path, so the next update check fetches it
   (`cache-control: max-age=0` makes that prompt). The worker clears every cache
   of the origin, unregisters itself and reloads the open tabs.

2. After a week or two with no `/sw.js` requests in the access log,
   `make pwa-clean` and leave **an empty `public/sw.js`** (or add an nginx rule
   `location = /sw.js { return 404; }`), so the path stops answering 500.

The kill switch was deployed to production on 2026-09-15 for the worker
generated on 2026-07-25. To count how many clients had it registered (a browser
fetches `/sw.js` at registration and then on every update check):

```sh
grep 'GET /sw.js' /var/log/nginx/access.log* | awk '{print $1, $NF}' | sort | uniq -c | sort -rn
```

## Why `next-pwa` and not `serwist`

`next-pwa` was already a dependency and needed one flag plus the caching table
above. `serwist` remains the fallback if a Next.js upgrade breaks the generated
worker (see R-#242, acceptance criterion "next-pwa vs serwist decision").
