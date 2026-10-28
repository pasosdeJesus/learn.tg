# Authentication and wallets — agent invariants

Checklist for an agent touching auth, wallets or anything that pays. The reference
documents are [siwe-auth-flow.md](siwe-auth-flow.md) (the flow and the session),
[wallet-auth.md](wallet-auth.md) (components, hooks and provider) and
[pdJ-wallet.md](pdJ-wallet.md) (the user guide); this page is the short version you must
not break.

## 1. The credential

- The **NextAuth session cookie is the only credential** (HttpOnly JWT; R-#233 Phase 2).
  Claims: `sub` = the wallet that signed in, `usuarioId` = the account,
  `sessionEpoch` = the account's `usuario.session_epoch` at sign-in.
- **`walletAddress` in a body or query is an untrusted hint**, never a credential: it
  must be a wallet of the token's account and the epoch must still match
  (`lib/authenticateUser.ts`). A legacy token without those claims keeps the old rule
  (`sub` == hint).
- **There is no API token.** No `billetera_usuario.token`, no `/api/auth/token`, no token
  in `localStorage`. Do not reintroduce one.
- **CSRF is only the SIWE nonce** (the NextAuth CSRF token of the handshake). Mutations
  are protected by `proxy.ts` (`Sec-Fetch-Site` / `Origin`) and CSP.
- To sign out every device: `UPDATE usuario SET session_epoch = session_epoch + 1`.

## 2. Identity and money

- **The account is the identity** (R-#265): a learner may hold **N wallets**; progress,
  scores, privacy switches, referral code and badges follow the account.
- **Payouts go to the connected wallet**; a course **SBT** is minted to the wallet that
  completed the course; the pastor bonus goes to the last used wallet.
- **One award per account**: a guide's scholarship is paid once per account and the CELO
  UBI once per account per day. Never key these rules on the wallet address.

## 3. Linking, invitations and handover

- **Link** (`POST /api/wallet/link`): both wallets in the same browser, the **active** one
  signs the SIWE; the address is sent EIP-55 checksummed.
- **Invite** (`POST /api/wallet/invite`): the inviter needs profile score ≥ 50, *except*
  when the invited address already belongs to a verified account (profile score, Self
  passport or church verification). Invitations live in `billetera_invitada` for **30
  days**; `POST /api/wallet/cancel` is idempotent.
- **Accept** (`POST /api/wallet/accept`): the **invited wallet signs on its own device**;
  the client tries the plain sign-in first, and on failure probes accept and then
  confirms (`confirm: true`). One signature accepts and signs in.
- **Handover** (R-#288): if the invited address belongs to a **verified account** and the
  inviter is the **unverified duplicate**, the verified account absorbs the duplicate's
  wallets and the duplicate row is deleted. `lib/wallet-handover.ts` refuses when the
  duplicate holds value (transactions, purchases, badges).
- **Unlink** (`POST /api/wallet/unlink`): removes the wallet and **revokes its SBTs** on
  chain; the account always keeps at least one wallet.

## 4. Client rules

- Use `useAuthAddress()` for the address (session **or** the `learn.tg.sessionAddress`
  fallback). **Never gate wallet-scoped fetches on `session.address` alone**: after a
  client navigation NextAuth can be cold (#5719) and the fetch goes anonymous.
- Use `useAuthedApi()` and wait for `ready` before fetching; an unknown `canSubmit`
  (`null`) is *unknown*, never "in cooldown" or "not paid".
- Only non-secrets in `localStorage` (`learn.tg.sessionAddress`, the backup confirmation
  flag). Never the JWT, never the password, never the 12 words.
- The chain comes from `getAppChain()` (`lib/app-chain.ts`); payment modals run the
  pre-flight of `lib/ensure-chain.ts`.
- SIWE signs the **host you actually visit**: the allowlist is `learn.tg`,
  `learntg.pdj.app` (and their `:9001`) plus `localhost`, `localhost:4000`,
  `localhost:4300` outside production; the chain must be 42220 or 11142220.

## 5. The in-app wallet

- The core is `@pasosdejesus/m/wallet` and the React layer
  `@pasosdejesus/m/wallet/next` (m work items 14/37), consumed **vendored** at
  `packages/generated/wallet` (**0.1.2**). **Never edit that folder**: re-vendor it (see
  below) and rebuild.
- The private key lives **sealed in IndexedDB** on the device, never on the server. It is
  opened with a password (≥ 8 characters, no PIN) or an optional biometric gesture
  (WebAuthn passkey + PRF); the wallet locks on reload and after one idle hour, and a
  lock bumps a generation that invalidates in-flight signatures.
- Detecting it: `useWalletProvider().isInApp`, `useAuthAddress().isInAppUnlocked` /
  `inAppAddress`, `useInAppWallet().status`, and `provider.isPdJWallet` for libraries.
  `wallet_watchAsset` is **not** implemented (the panel lists CELO, USDT and SLEARN).
- The CSP is what keeps foreign script out of the origin where the key lives; see
  [csp.md](csp.md) before adding a source.

## 6. Server rules

- Private keys only in the server environment: `PRIVATE_KEY` (scholarship payer),
  `CHURCHES_WALLET_PRIVATE_KEY`, `PRIVATE_KEY_REFERRAL_WALLET`. Never in the client, never
  in logs.
- No PII in logs: log booleans/reasons, never `nombre`, `passport_name`, emails or
  documents ([api-security.md](api-security.md) §1.4).
- Normalize addresses the same way on both sides: SIWE signs EIP-55 (`getAddress`), and
  the DB compares `LOWER(billetera) = LOWER(address)`.
- **Roles are derived from the authenticated account, never from the request hint.** A
  cluster route takes `authenticateUser(db, walletAddress)` and then resolves the pastor
  church (`getPastorChurch(db, auth.usuario.id)`) and the membership; "is initiator" is
  `cluster.initiator_church_id === church.id`. The GD answer and contact email are shown
  only to the initiator, even to members of the same cluster
  ([gd-presentation.md](gd-presentation.md)).

## 7. Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET, POST | `/api/auth/[...nextauth]` | public | NextAuth: CSRF, session, sign-in/out |
| GET | `/api/wallet` | session | Wallets of the account |
| POST | `/api/wallet/link` | session | Link another wallet available in this browser |
| POST | `/api/wallet/invite` | session | Invite an address (verified inviter, or verified target) |
| POST | `/api/wallet/accept` | session (invited wallet) | Probe/confirm the invitation |
| POST | `/api/wallet/cancel` | session | Cancel a pending invitation (idempotent) |
| POST | `/api/wallet/unlink` | session | Remove a wallet and revoke its SBTs |
| GET, PATCH | `/api/profile` | session (owner) | Read/update the profile |
| POST, DELETE | `/api/user/id-photo` | owner or admin | Upload/delete ID documents |
| GET | `/api/user/id-photo/[userId]` | owner or admin | Serve a document |
| GET | `/api/user/[id]` | public | Public profile (privacy-filtered) |

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| 401 while the in-app wallet is unlocked | The address is known (wallet/localStorage) but the session cookie does not exist yet | Complete the SIWE sign-in; pages wait on `useAuthedApi().ready` |
| "Partial login" / wallet-scoped data empty | Cold NextAuth session (#5719) or no session | Sign in; use `useAuthAddress` + `useAuthedApi` |
| SIWE callback 401 | Host/port not allowlisted, or the message was signed for another chain | Visit an allowlisted host; chain 42220 or 11142220 |
| `POST /api/wallet/invite` 403 | Inviter profile < 50 and the target is not a verified account | Raise the profile or invite a verified address |
| Accept fails with 401 then works after probing | The accept is a double step (probe then `confirm: true`) | Keep the two requests in that order |
| No biometric prompt | No platform authenticator / no PRF, or the gesture was cancelled | Type the password; a cancellation falls back silently |
| Signature fails after leaving the phone | The wallet locked (reload or one idle hour) | Unlock; "locked" is a normal state, not an error |
| Address not found in links/DB | Case or checksum mismatch | Use `getAddress` / `LOWER()` consistently |
| Sessions live after a lost phone | No server-side expiry per device | Bump `usuario.session_epoch` |

## 9. Practical loop and sources

- Integration tests: [pdj-wallet-testing.md](pdj-wallet-testing.md); the browser specs are
  `in-app-wallet`, `biometric-unlock`, `wallet-invitation-two-devices`,
  `wallet-link-second-wallet`, `wallet-handover`, `wallet-event-disconnect`,
  `header-wallet-dialog` and `in-app-wallet-payments` (index in
  [e2e-testing.md](e2e-testing.md)).
- The wallet engine internals are in the `m` repo: `m/doc/identidad-multibilletera.md`
  (m work items 14 and 37). learn.tg only integrates it.
- Re-vendor the wallet after bumping `m` (AGENTS.md trap 10):

  ```sh
  cd apps/web
  bin/m eng:sync --vendor --from-git <m-repo>#wallet-vX.Y.Z \
    --path packages/wallet --out packages/generated/wallet --prepare
  bin/m eng:verify
  ```
