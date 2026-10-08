# `lib/` — Business Logic Modules

Brief map of each module. For complex features (crossword rewards, auth), see `doc/`.
On-chain business logic lives in the engines (`packages/rewards`, `packages/gdcluster`,
`packages/mr519`), not here; the `*-app.ts` / `reward-routing.ts` adapters are the bridge.

| Module | Purpose |
|--------|---------|
| `scores.ts` | Learning score (`refreshUserLearningScore`), donation SLEARN, `updateUserAndCoursePoints` |
| `score-rules.ts` | Profile score rules (`SCORE_RULES`, `VERIFIED_FIELDS_CONFIG`) |
| `guide-utils.ts` | Guide lookup by course/suffix, `actividadpf_id` resolution |
| `course-progress.ts` | Course progress and available-guide helpers |
| `course-access.ts` | Course access/purchase gates (`PILOT_COUNTRIES`, `isGDCourse`, `canPurchaseGDCourse`, bridged from the gdcluster engine) |
| `course-access-msg.ts` | EN/ES denial messages for the access gates |
| `metrics-server.ts` | Server-side event recording to `userevent` |
| `metrics/queries.ts` | Aggregated metrics queries for the dashboard |
| `fetchHelpers.ts` | URLSearchParams builder with session, generic fetch factory |
| `format.ts` | Number/currency formatting (USDT, CELO, learning points), i18n helper |
| `mobile-detection.ts` | UA-based mobile/iOS/Android detection + React hook |
| `app-chain.ts` | `getAppChain()`: the Celo network the app runs on |
| `backend-config.ts` | Chain/RPC config and viem clients (`getPublicClient`, `getWalletClient`, `fetchTxWithReceipt`) injected into engines |
| `rpc-url.ts` | RPC endpoint resolution (multi-RPC) |
| `ensure-chain.ts` | Chain pre-flight before signing/paying (`ensureWalletChain`) |
| `deeplink.ts` | Self app deeplink generation, open detection, store URLs |
| `ability.ts` | CASL-based permission rules (currently: `view_religion` for rol=1) |
| `leaderboard-queries.ts` | Leaderboard query builder with filtering, country totals (R-#278) |
| `user-transactions.ts` | User transaction history queries |
| `authenticateUser.ts` | Session-cookie auth helper for API routes |
| `admin-auth.ts` | Admin/verifier authentication for `/api/admin/*` |
| `admin-fetch.ts` | Same-origin admin fetch helper (session cookie + wallet hint) |
| `church-directory.ts` | Public church directory (R-#164) |
| `church-activity.ts` | Church `activity_score` (R-#164) |
| `church-updates.ts` | Admin-editable `church` NOT NULL columns |
| `safe-updates.ts` | Safe PATCH field building (keeps NOT NULL values on empty input) |
| `caldav.ts` | CalDAV (Radicale) client for the verifier calendar |
| `date-utils.ts` | UTC storage / timezone-aware display helpers |
| `privacy-visibility.ts` | Course-completion public visibility (R-#259) |
| `referral-admin.ts` | Read/correct a user's referrer from the admin UI (R-#163) |
| `referral-rewards.ts` | Pure referral reward logic (R-#163) |
| `referral-crossword.ts` | Referral attribution in the crossword flow (R-#163, Form 2) |
| `referral-payout.ts` | Off-chain referral payouts (R-#163) |
| `reward-routing.ts` | Reward routing dispatcher (`reward:route-destination` hook) |
| `rewards-app.ts` | Core to `@learn-tg/rewards` engine adapter |
| `gdcluster-app.ts` | Core to `@learn-tg/gdcluster` engine adapter |
| `gdcluster-ui.tsx` | Core to `@learn-tg/gdcluster` UI component adapters |
| `engines.ts` | Engine registry (`@pasosdejesus/m/engine`) |
| `gd-utils.ts` | Remaining GD domain helpers (most moved to the gdcluster engine); profile-score updates |
| `gooddollar-protocol.ts` | GoodDollar protocol in one place: Celo addresses/ABIs, FV message, GoodID link, action resolver, change detector (R-#275) |
| `gooddollar-reason.ts` | Why the GoodDollar button can or cannot run (R-#271) |
| `donations-explorer.ts` | Donation ledger summary for the public API/page (R-#223) |
| `verifier-alerts.ts` | In-app alerts to verifiers (R-#223) |
| `migration-guide.ts` | Serves `doc/migration-in-app-wallet/{en,es}.md` at `/en/migration-in-app-wallet` and `/es/migracion-billetera-app` (R-#270) |
| `wallet-amounts.ts` | Panel format/parse/send-validation helpers |
| `wallet-backup.ts` | Three-word backup confirmation |
| `wallet-browser.ts` | Wallet-browser (MiniPay/OKX/…) detection |
| `external-provider.ts` | EIP-6963 external wallet provider resolution |
| `in-app-siwe.ts` | SIWE for the in-app wallet |
| `in-app-wallet-dialog.ts` | Opens the in-app wallet dialog (shared event) |
| `server-errors.ts` | Server error logging helpers (`logServerError`, `devErrorDetail`) |
| `sw-recovery.ts` | Service-worker recovery (reload on chunk load errors) |
| `utils.ts` | `cn()` Tailwind class merge utility |
| `offline-db.ts`, `offline-catalog.ts`, `offline-course-db.ts`, `offline-guide-db.ts`, `offline-queue-db.ts`, `offline-course-download.ts`, `offline-profile.ts`, `offline-answer-notice.ts` | Offline/PWA stores and sync (R-#241/R-#242/R-#256) |
| `hooks/` | React hooks: `useApiData`, `useAuthedApi`, `useFetchData`, `useGuideData`, `useGuideNavigation`, `useSort`, `useTranslation`, `useScholarshipData`, `useCourse`, `useCachedGuide`, `useOfflineQueue`, `useOfflineStatus`, `useAuthAddress`, `useWalletProvider`, `useWallet`, `useWriteContract`, `useGasEstimation`, `useContractPayment` (donation/purchase transfers, serialized so USDT and SLEARN do not collide on the nonce) |
| `__tests__/` | Unit tests for all modules above |

Modules that used to be listed here and now belong to the `@learn-tg/rewards` engine:
`crypto.ts`, `donate-utils.ts`, `config.ts` (`IS_PRODUCTION`). The OKX network-switch
logic that this map used to call `okx-switch.ts` no longer exists as its own module (the
switch runs through the wallet provider).
