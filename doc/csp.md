# Content Security Policy (CSP) for learn.tg

**Status: not implemented.** As of 2026-09-21 the app serves **no**
`Content-Security-Policy` header; what follows is the design agreed in
https://github.com/pasosdeJesus/learn.tg/issues/247 (2026-09-18) plus the
instructions for changing the policy once it is live. Read this together with
[api-security.md](api-security.md) (route auth and origin checks).

## 1. Why

The in-app wallet (`packages/pdj-wallet`) keeps a private key **in the page**: unlock,
SIWE signature and fund movement are all JavaScript running in the `learn.tg`
origin. A CSP is the only control that stops foreign script from running there in
the first place; the three layers of
https://github.com/pasosdeJesus/learn.tg/issues/246 (PIN, WebAuthn gesture, PRF)
limit what such script could do *if* it reaches the key, but not whether it loads.

What an attacker needs, per https://github.com/pasosdeJesus/learn.tg/issues/246 §7,
is nothing on the device: just code executing in our origin, via (1) an XSS of our
own, (2) a compromised dependency in the bundle, or (3) a poisoned build/asset.

## 2. What the app sends today

`apps/nextjs/next.config.ts` → `headers()` (static, for every path):

| Header | Value |
|---|---|
| `X-DNS-Prefetch-Control` | `on` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-XSS-Protection` | `1; mode=block` (deprecated, no effect in modern browsers) |
| `Referrer-Policy` | `origin-when-cross-origin` |

No CSP, no `frame-ancestors`, no nonce.

## 3. Rollout phases

**Phase 1 — report only, on the development site** (nothing breaks):

```
Content-Security-Policy-Report-Only: <policy>; report-uri /api/csp-report
```

**Phase 2 — enforce** once the report shows only known-good sources, keeping the
collector to catch regressions.

**Phase 3 — Trusted Types** (`require-trusted-types-for 'script'`) as a separate
step: the guide body and the course outline use `dangerouslySetInnerHTML`.

The policy is served by **`middleware.ts`** (it already exists for the CSRF/origin
checks) because a per-request nonce is needed for Next's inline hydration scripts;
`next.config.ts`'s static `headers()` cannot generate one.

## 4. Starting policy

| Directive | Value | Why |
|---|---|---|
| `default-src` | `'self'` | Baseline deny |
| `script-src` | `'self' 'nonce-<per request>' 'strict-dynamic'` | Next injects inline hydration scripts; `strict-dynamic` keeps dynamic imports working without listing every chunk |
| `style-src` | `'self' 'unsafe-inline'` | Tailwind + React inline styles; removing it is a later, separate step (far less dangerous than in `script-src`) |
| `img-src` | `'self' data: blob:` | Icons, QR codes, credential SVGs |
| `font-src` | `'self'` | System fonts |
| `connect-src` | `'self'` + the RPC hosts (`https://forno.celo.org`, `https://forno.celo-sepolia.celo-testnet.org`) + the Alchemy endpoints used for campaign balances | `fetch`/XHR and WebSocket |
| `worker-src` | `'self' blob:` | `public/sw.js` and Next's workers |
| `manifest-src` | `'self'` | `public/manifest.webmanifest` |
| `frame-ancestors` | `'none'` | Replaces `X-Frame-Options` (no legitimate embedding is known; the Rails admin is out of scope) |
| `base-uri` | `'self'` | Prevents `<base>` hijacking |
| `form-action` | `'self'` | No form should post elsewhere |
| `object-src` | `'none'` | No plugins |
| `upgrade-insecure-requests` | — | The site is HTTPS-only |

Target platforms: the priority mobile stack of issue #246 (Chrome Android, Safari
iOS and the Rabby/MetaMask/OneKey/OKX in-app browsers). They are Chromium-based but
can be old, so any new directive must be verified against the oldest engine in that
matrix (Chromium 96–99 was still present for Opera).

## 5. Violation collector

`app/api/csp-report` (Phase 1) logs `document-uri`, `violated-directive` and
`blocked-uri`. It must **never** log the full URL query string: it can carry a
wallet address (`?walletAddress=0x…`). It is a **public** endpoint (the browser
posts it without credentials, `application/csp-report`), it stores no PII and it is
declared as public in `bin/audit-api-auth.mjs` with that reason — see
[api-security.md](api-security.md) §1.

Open decision: log only, or persist a `csp_violation` event in `userevent` (which
already exists).

## 6. How to know it is safe to enforce

1. Ship report-only and read the reports.
2. Drive the app on the dev site with the existing E2E specs (landing, course,
   guide, profile, donation modal, in-app wallet, biometric unlock, offline) and by
   hand on a phone; every blocked resource shows up in the report.
3. Watch the classic breakages: Next inline scripts without a nonce, the service
   worker registration (`components/ServiceWorkerRegistrar.tsx`), fonts, the QR
   library, and the WASM fallback (if SWC's WASM path is used on OpenBSD,
   `wasm-unsafe-eval` may be needed **for the build**, never in the browser).
4. Enforce on the dev site first; the operator deploys production only after a full
   manual pass on a phone (this VM cannot deploy: AGENTS.md §7 and
   [environments.md](environments.md)).

## 7. How to change the policy

1. Never add a source "to make it work": reproduce the violation, note which
   directive blocked it and why the resource is legitimate.
2. Add the narrowest value (host, not scheme-wide; a nonce over `'unsafe-inline'` in
   `script-src`).
3. Update the table of §4 **in the same change** and say when it was verified.
4. Re-run the wallet E2E specs (`make test-e2e-wallet`, `make test-e2e-biometric`,
   `make test-e2e-offline`) on the dev site.
5. A regression test must fail if the header disappears (a future `next.config.ts`
   or `middleware.ts` edit can drop it silently): assert the header on production in
   a smoke spec, or add a unit test on the middleware response.

## 8. Open questions

1. Policy in `middleware.ts` (dynamic, nonce) vs `next.config.ts` (static): the
   nonce requires the middleware path — confirmed, the middleware already exists.
2. Do we need `'unsafe-eval'` in production (viem/ethers, QR library)? Measure, do
   not assume.
3. Collector: log only, or `userevent`?
4. Does production enforce in the same rollout as the dev site, or one release
   later?

## Related

- https://github.com/pasosdeJesus/learn.tg/issues/247 — the requirement and its
  acceptance criteria
- [api-security.md](api-security.md) — route classes, origin/CSRF checks, the audit
  (`bin/audit-api-auth.mjs`)
- [wallet-auth.md](wallet-auth.md) — where the key lives and what unlocks it
- [pwa-developer-guide.md](pwa-developer-guide.md) — the service worker the policy
  must keep working
