# PWA developer guide (service worker, manifest, offline)

How the learn.tg PWA is wired, and what to touch when adding cached routes.
Specs: https://github.com/pasosdeJesus/learn.tg/issues/240 (service worker),
https://github.com/pasosdeJesus/learn.tg/issues/243 (install + docs).

## Pieces

| Piece | Where | Notes |
|-------|-------|-------|
| Service worker generation | `next.config.ts` (`withPWA(pwaConfig)`) | `next-pwa@^5.6.0`, `dest: 'public'`, `register: true`, `skipWaiting: true`, `disable: false` |
| Generated worker | `public/sw.js`, `public/workbox-*.js` | Build artefacts, gitignored, never edit by hand |
| Manifest | `public/manifest.webmanifest` | Linked from `app/layout.tsx` metadata (`manifest`); `viewport.themeColor` too |
| Icons | `public/icons/learntg-{192x192,512x512,maskable-512x512}.png` | Generated from `public/logo-learntg.png` with ImageMagick |
| Offline page | `app/offline/page.tsx` | Route `/offline`, precached through `additionalManifestEntries` |
| Offline indicator | `components/OfflineBanner.tsx` + `lib/hooks/useOfflineStatus.ts` | Mounted in `components/Layout.tsx` |
| Install prompt | `components/InstallPrompt.tsx` | `beforeinstallprompt`; dismissal stored for 7 days |
| Offline guide copy | `lib/offline-guide-db.ts` + `lib/hooks/useCachedGuide.ts` | Markdown in IndexedDB, used by the guide page |
| Offline submissions | `lib/offline-queue-db.ts` + `lib/hooks/useOfflineQueue.ts` | Generic queue (url + body), replayed on `online` |

The diligent-records app served by the same Next app keeps its own manifest
(`public/manifest.json`) and cache entry; do not remove them.

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

Mind the trade-off: caching `/api/*` GET responses keeps wallet-scoped data in
the device cache for an hour. If a future endpoint must never be stored, give it
its own entry **before** the generic one with `handler: 'NetworkOnly'`.

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
- The full E2E suite runs against the deployed dev site, so PWA behaviour is not
  covered there yet: `e2e/specs/in-app-wallet.spec.mjs` is the first step in that
  direction and skips when `/en/test/wallet` is not deployed.

## Why `next-pwa` and not `serwist`

`next-pwa` was already a dependency and needed one flag plus the caching table
above. `serwist` remains the fallback if a Next.js upgrade breaks the generated
worker (see R-#242, acceptance criterion "next-pwa vs serwist decision").
