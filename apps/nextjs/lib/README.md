# `lib/` — Business Logic Modules

Brief map of each module. For complex features (crossword rewards, auth), see `doc/`.

| Module | Purpose |
|--------|---------|
| `scores.ts` | Learning score calculation, donation scoring, `updateUserAndCoursePoints` |
| `crypto.ts` | Blockchain write function with nonce retry and receipt polling |
| `guide-utils.ts` | Guide lookup by course/suffix, actividadpf_id resolution |
| `metrics-server.ts` | Server-side event recording to `userevent` table |
| `fetchHelpers.ts` | URLSearchParams builder with session, generic fetch factory |
| `format.ts` | Number/currency formatting (USDT, CELO, learning points), i18n helper |
| `mobile-detection.ts` | UA-based mobile/iOS/Android detection + React hook |
| `deeplink.ts` | Self app deeplink generation, open detection, store URLs |
| `ability.ts` | CASL-based permission rules (currently: view_religion for rol=1) |
| `leaderboard-queries.ts` | Leaderboard query builder with filtering, country totals |
| `okx-switch.ts` | OKX Wallet network switch to Celo |
| `config.ts` | `IS_PRODUCTION` constant |
| `utils.ts` | `cn()` Tailwind class merge utility |
| `user-transactions.ts` | User transaction history queries |
| `authenticateUser.ts` | Wallet+token auth helper for API routes |
| `donate-utils.ts` | `parseUserAmount`, `formatDisplay`, `erc20Abi` for donations |
| `hooks/` | React hooks: `useApiData`, `useFetchData`, `useGuideData`, `useSort`, `useTranslation`, `useScholarshipData`, `useGuideNavigation`, `useGasEstimation` |
| `metrics/queries.ts` | Aggregated metrics queries for the dashboard |
| `__tests__/` | Unit tests for all modules above |
