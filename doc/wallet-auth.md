# Wallet Auth — Custom Implementation

How wallet connection, SIWE authentication, and transaction signing work in
learn.tg after removing RainbowKit + wagmi (R-#186).

> **Scope:** this is the **learn.tg app** integration (its components, hooks and
> SIWE session). The wallet packages have their own docs:
> [`packages/pdj-wallet/README.md`](../packages/pdj-wallet/README.md) (library API)
> and [`packages/pdj-wallet/ARCHITECTURE.md`](../packages/pdj-wallet/ARCHITECTURE.md)
> (core design), plus
> [`packages/pdj-wallet-next/README.md`](../packages/pdj-wallet-next/README.md)
> (React hooks/components) and
> [`packages/pdj-wallet-next/ARCHITECTURE.md`](../packages/pdj-wallet-next/ARCHITECTURE.md).
> For the end user, see [pdJ-wallet.md](pdJ-wallet.md).

## Architecture

```
┌─────────────────────────────────────────────────┐
│                    App Layer                      │
│  ConnectWalletButton  WalletEventListener         │
│         │                    │                   │
│         ▼                    ▼                   │
│  window.ethereum (direct)   useSession()          │
│         │                    │                   │
│         ▼                    ▼                   │
│  ┌──────────┐    ┌──────────────────────┐        │
│  │  SIWE    │───▶│  NextAuth Session     │        │
│  │  sign    │    │  (JWT in cookie)      │        │
│  └──────────┘    └──────────┬───────────┘        │
│                             │                    │
│              ┌──────────────▼──────────────┐     │
│              │      useAuthAddress()        │     │
│              │  session ∥ localStorage      │     │
│              └──────────────┬──────────────┘     │
│                             │                    │
│         ┌───────────────────▼──────────────┐     │
│         │   usePublicClient / useWalletClient│     │
│         │   useWriteContract                │     │
│         │   (viem + custom(window.ethereum)) │     │
│         └──────────────────────────────────┘     │
└─────────────────────────────────────────────────┘
```

**Key principle:** NextAuth session JWT is the single source of truth for
user identity. Wallet connection state (wagmi) is no longer tracked
separately.

**Two wallets (R-#244 MVP):** `WalletSelector` lets the user pick between the
**in-app wallet** (`packages/pdj-wallet` core + `packages/pdj-wallet-next`
React layer) and the **external** wallet (`ConnectWalletButton`,
`window.ethereum`). `useWalletProvider()` resolves the effective EIP-1193
provider — the in-app one while it is unlocked, otherwise the injected one —
and every wallet hook goes through it.

### Detecting the in-app provider (R-#254)

UI that must behave differently can tell which wallet is in use without a request:

| Where | How |
|-------|-----|
| React | `useWalletProvider().isInApp` — the effective provider is the in-app wallet (true while it is unlocked) |
| React | `useAuthAddress().isInAppUnlocked` / `inAppAddress` — the in-app wallet is unlocked, regardless of the session |
| Provider | `provider.isPdJWallet === true` (`packages/pdj-wallet/src/provider.ts`) — the flag a library can read on `window.ethereum` when the in-app wallet is the injected one |
| Hook | `useInAppWallet().status` — `no-wallet` / `locked` / `unlocked` |

`wallet_watchAsset` is **not** implemented by the in-app provider: its panel always
lists CELO, USDT and SLEARN, so "add token to wallet" buttons are pointless there.
The home page hides its `AddSlearnButton` when `isInApp` is true (the operator
reported on 2026-09-21 that pressing it did nothing with the in-app wallet).

### Provider robustness (R-#236, R-#246 §14)

| Behaviour | Where | Notes |
|-----------|-------|-------|
| Gesture first | `WalletDialog` auto-attempt effect | With a passkey enrolled the dialog asks for the gesture as it opens (no field, no extra tap); a cancelled gesture or a device without one falls back to the password field. Decision of 2026-09-25: the "preferred method" memory (`pdj-wallet:unlockPreference`) was removed, so one cancellation no longer silences the gesture on later opens |
| Lock generation | `currentLockEpoch()` + `assertStillUnlocked()` (provider) | A lock (idle, ✕, delete) bumps the generation: a signature approved before it is not signed nor broadcast after it |
| Passkey cleanup | `signalUnknownCredential()` via `forgetBiometricCredential()` | Disabling the gesture or deleting the wallet tells the authenticator the passkey is gone (Chrome 132+) |
| Cancellation | `isUserCancelledError()` | `NotAllowedError`, `AbortError` and `cancel*` all read as "the user cancelled" in the dialog |
| Provider events | `provider.on('accountsChanged'|'disconnect', …)` | Emitted when the wallet locks or is deleted (module-level registry, so a subscriber survives the provider being recreated); `chainChanged` never fires: the wallet is bound to one chain at creation |
| Chain switch | `wallet_switchEthereumChain` | Returns `null` only for its own chain; another chain answers **4902** (before: a silent success that misled the caller) |
| KDF calibration | `calibrateIterations()` in `crypto.ts` | Measures one derivation and scales it to ~400 ms, clamped to [600 000, 5 000 000]; the count lives in the record and an older record is re-encrypted on unlock |

## Components

### ConnectWalletButton (`components/ConnectWalletButton.tsx`)

Custom connect/disconnect button. Replaces RainbowKit's `ConnectButton`.

**Connect flow:**
1. `window.ethereum.request({ method: 'eth_requestAccounts' })`
2. Ensure correct chain (Celo mainnet or Sepolia)
3. Get CSRF token from `/api/auth/csrf`
4. Build SIWE message with EIP-55 checksummed address (`getAddress()`)
5. Sign via `window.ethereum.request({ method: 'personal_sign', ... })`
6. POST to `/api/auth/callback/credentials`
7. Store `sessionAddress` in localStorage (cold-session fallback for
   `useSession()`, #5719). There is no API token: the NextAuth session cookie
   (HttpOnly) is the credential (R-#233 Fase 2)
8. Reload page (NextAuth reads session cookie on mount)

**Disconnect flow:**
1. Remove `sessionAddress` from localStorage
2. Call NextAuth `signOut({ redirect: false })`
3. Redirect to `/`

**Features:**
- i18n support (en/es)
- MiniPay auto-connect (detects `window.ethereum.isMiniPay`)
- EIP-55 address normalization (OneKey returns lowercase)
- Hydration-safe localStorage (useState + useEffect, no SSR mismatch)
- Chain detection + auto-switch with fallback to `wallet_addEthereumChain`

### WalletSelector (`components/WalletSelector.tsx`)

Mounted in `Header` (R-#238). The header only shows the state; the whole flow
lives in the modal below.

| State | UI |
|-------|----|
| `no-wallet` | "Use in-app wallet" (opens `WalletDialog`) plus "Use external wallet" when `window.ethereum` exists |
| `locked` | "Unlock your in-app wallet" (opens `WalletDialog`) |
| `unlocked` without a session | "Sign in with in-app wallet" (opens `WalletDialog`, which runs the SIWE) |
| unlocked **and** session matches | Short address + "Disconnect" (clears `sessionAddress`, locks the wallet, signs out) |
| external chosen | Defers to `ConnectWalletButton` (existing flow, preserved) |

### WalletDialog (`components/WalletDialog.tsx`)

Modal with the whole in-app flow (it does not belong in the header): create or
import with a PIN, show the **12 words for manual backup** with a confirmation
step, unlock an existing wallet, delete the wallet, and finish with the SIWE
sign-in (`lib/in-app-siwe.ts`, same POST to `/api/auth/callback/credentials` as
the external wallet, then a reload so NextAuth reads the session cookie).

Two behaviours came out of the operator's manual testing on 2026-09-15:

- The creation used to happen inside the header through `InAppWalletSetup`,
  which had **its own copy of the hook state**: the selector kept seeing `locked`
  and the button looked dead. `useInAppWallet` now keeps a single module-level
  store (via `useSyncExternalStore`) shared by every instance.
- Creating or unlocking the wallet **did not sign in**, so `useAuthAddress()`
  reported an address while there was no session: pages showed "Partial login.
  Please disconnect your wallet and connect and sign again" and authenticated
  calls answered 401. The SIWE is now part of the flow.

The wallet is created with a PIN and stored encrypted (AES-256-GCM + PBKDF2
600k) in IndexedDB (`learn-tg-pdj-wallet` → `wallet`).

Three behaviours came out of the operator's manual testing on 2026-09-16
(https://github.com/pasosdeJesus/learn.tg/issues/244): the modal is also mounted
when the header already shows a session — it is the only listener of
`learn-tg:open-in-app-wallet-dialog`, so without it the "unlock" button of the
donation and purchase modals did nothing — and unlocking skips the SIWE (and the
reload that would lock the wallet again) when the session cookie already belongs
to that wallet.

**Biometric unlock (layer L2 of
https://github.com/pasosdeJesus/learn.tg/issues/246).** The decrypted key lives in
module memory, so a reload locks the wallet again. With the dialog the user can
register a **passkey** and let the wallet key be stored **sealed with the PRF
secret** of that credential (`packages/pdj-wallet/src/biometric.ts`): from then on
one Face ID / fingerprint gesture decrypts it, and the PIN remains the fallback
and the 12 words the recovery. Nothing is stored in plaintext —
`PublicKeyCredential`/`prf` do not exist in the in-app browsers of Rabby,
MetaMask, OneKey and OKX (measured 2026-09-18), so there the dialog simply offers
the PIN. The tab-scoped `sessionStorage` entry used in 2026-09-16 was removed: it
kept the key readable and the measurement showed it never survived closing the app.

**The gesture is the default path (R-#246 §10).** The operator's mobile test found
the flow right but "not intuitive": the fingerprint was an outline button next to a
primary "Unlock", so most users would never enrol, and the PIN field appeared first
even with a passkey registered. Now:

- Locked, no passkey, device can verify: the primary action is "desbloquear con
  huella" (it types the PIN once and seals the key) and the secondary is "seguir
  usando solo el PIN"; the same primary treatment applies right after creating the
  wallet.
- Locked with a passkey: the dialog **asks for the gesture as it opens** and shows
  only "usar el PIN" as the escape; the PIN field appears only if the gesture is
  cancelled or fails, together with "reintentar huella".
- The donation and purchase modals name the gesture in their lock notice
  ("confirma con tu huella") when the device can verify the user, instead of
  sending everybody to type a PIN.

**Moving funds asks for a gesture (layer L1), at most once an hour.** Even inside
an unlocked session, `eth_sendTransaction` on the in-app provider calls
`requireFundsConfirmation()` (`packages/pdj-wallet/src/provider.ts`), which asks
the device to verify the user before signing; a cancelled prompt rejects with code
`4001` and nothing is broadcast. The gate also covers `eth_signTypedData_v4` and
`eth_signTransaction`, because an EIP-2612 permit or an EIP-3009
`TransferWithAuthorization` (what USDC on Celo uses) moves money without going
through a transaction. Reads and `personal_sign` (the SIWE) are **not** gated, so
signing in never prompts twice. Without a passkey — or without WebAuthn at all — the
request goes through, because the layer needs hardware.

**Grace window + new destinations (R-#253).** Once the user verified with the device
— an L1 assertion or an L2 biometric unlock — a transfer **to an address already
used** does not ask again within `USER_VERIFICATION_GRACE_MS` (**15 minutes**,
`packages/pdj-wallet/src/web-authn.ts`); a **new destination always asks**, even
inside the window (`packages/pdj-wallet/src/destinations.ts`, per-wallet in
`localStorage`, remembered only after a successful broadcast).
`lockWallet()`/`deleteWallet()` clear the window, so the idle auto-lock makes the
next move prompt again. Trade-off accepted by the operator: on a stolen *unlocked*
device money can be moved to a known address within the 15 minutes without a
gesture.

**Locking.** `INACTIVITY_LOCK_MS` (**one hour** without pointer, key, touch,
scroll or visibility activity) drops the key in memory and marks
`lockReason: 'idle'`. Ten minutes turned out to be too aggressive on a phone
(the operator had to unlock again while donating, R-#246 §10) and OneKey waits
about an hour; the funds gate below is what keeps a long pause from making a
transfer silent. Activity listens on `document` for `visibilitychange` (the
event does not reach `window`, which was the other half of the defect) and
restarts the timer at most once every five seconds.
`WalletEventListener` signs the user out only for the header ✕ (`'user'`) or when
the wallet is deleted (`'deleted'`), never for the idle lock.

**Injected wallet detection.** `lib/external-provider.ts` resolves the external
wallet from `eip6963:announceProvider` announcements, with `window.ethereum` as
fallback and brief retries, because several wallet browsers do not define
`window.ethereum` at page load (R-#246 §8).

### WalletPanel (`components/WalletPanel.tsx`)

The **unlocked** state of the pill (R-#249): `WalletSelector` opens it when the
in-app wallet is unlocked, and `WalletDialog` when it is locked. It shows the
checksummed address with a Copy button, the CELO/USDT/SLEARN balances, receive
with a `QRCodeSVG`, send (CELO/USDT/SLEARN) and the Celo collectibles read lazily
from Blockscout.

- The three balances are read in parallel with `Promise.allSettled`, so one
  failing read does not blank the others (a `null` shows `—`, never `NaN`).
- The send rules are pure functions in `lib/wallet-amounts.ts`
  (`formatTokenAmount`, `parseTokenAmount`, `validateSend`); the `Max` button
  reserves 0.01 CELO for the fee on native transfers.
- Signing goes through the wallet provider, so it inherits the L1 gesture gate
  (`requireFundsConfirmation`) described above.
- Collectibles use `explorerApiNftsUrl` (Blockscout, no key) and degrade silently:
  a failing section never touches the balances.

### Backup confirmation (`lib/wallet-backup.ts`)

The recovery phrase is shown **once**, when the wallet is created. Before the
wallet counts as backed up, `WalletDialog` asks for **three random positions** of
the phrase: `pickVerifyPositions(wordCount)` and `verifyWords(words, inputs)`
(case-insensitive, trimmed) decide, and `markBackupConfirmed()` stores a
`localStorage` flag (not a secret, `learn.tg.wallet.backupConfirmed`). A wrong
word never signs in, and the user can re-read the phrase while confirming.

The user-facing version of this flow is [pdJ-wallet.md](pdJ-wallet.md).

### WalletEventListener (`components/WalletEventListener.tsx`)

Mounts at layout level (`AppProvider`). Listens for wallet events and syncs
app state.

**Events handled:**

| Event | Action |
|-------|--------|
| `accountsChanged` with empty array | Clear localStorage + signOut |
| `disconnect` | Clear localStorage + signOut |
| `session?.address` becomes `null` | Clear localStorage (covers session expiry, signOut from another tab, etc.) |
| in-app wallet leaves the `unlocked` state (locked or deleted) | Clear localStorage + signOut |

When any of these fire, `learn.tg.sessionAddress` is removed from localStorage,
and NextAuth signOut is called. The in-app case only reacts to a **transition**
(a wallet that is already locked when the page loads keeps the session).

## Hooks

### useAuthAddress (`lib/hooks/useAuthAddress.ts`)

Returns the authenticated user's address. Precedence: NextAuth session, then
the in-app wallet (while unlocked), then the localStorage fallback used for
navigation persistence (NextAuth bug #5719).

```ts
const { address, sessionAddress, inAppAddress, isInAppUnlocked } = useAuthAddress()
```

- `address` — `sessionAddress || inAppAddress || storedAddress`
- `sessionAddress` — session address only (undefined if not authenticated)
- `storedAddress` — the `learn.tg.sessionAddress` localStorage fallback
- `inAppAddress` — in-app wallet address (lowercase) while unlocked
- `isInAppUnlocked` — the in-app wallet is unlocked (counts as "wallet available")
- `isAuthenticated` — true if an address exists from any of the sources

Replaces `useAccount().address` from wagmi.

### usePublicClient (`lib/hooks/useWallet.ts`)

Creates a viem `PublicClient` using the provider from `useWalletProvider()`
(the in-app wallet while it is unlocked, otherwise `window.ethereum`).
Memoized — no state, no re-renders.

```ts
const publicClient = usePublicClient()
// → PublicClient with custom(useWalletProvider().provider) transport
```

### useWalletClient (`lib/hooks/useWallet.ts`)

Creates a viem `WalletClient` with the authenticated account from
`useAuthAddress()`.

```ts
const { data: walletClient } = useWalletClient()
// → WalletClient with account from NextAuth session
```

Returns `null` if not authenticated (no address available to sign).

### useWriteContract (`lib/hooks/useWriteContract.ts`)

Encodes contract calls with viem's `encodeFunctionData` and sends via
`eth_sendTransaction` on the provider from `useWalletProvider()` (the in-app
wallet while it is unlocked, otherwise `window.ethereum`).

```ts
const { data: hash, writeContract } = useWriteContract()

await writeContract({
  address: contractAddress,
  abi: contractAbi,
  functionName: 'transfer',
  args: [to, amount],
})
```

## localStorage Convention

One key is managed by the auth system:

| Key | Purpose | Set by | Cleared by |
|-----|---------|--------|------------|
| `learn.tg.sessionAddress` | Wallet address for UI persistence | `ConnectWalletButton` / `WalletSelector` on connect | `WalletEventListener` on disconnect/session loss |
| IndexedDB `learn-tg-pdj-wallet` → `wallet` | Encrypted in-app wallet (AES-256-GCM + PBKDF2 600k) | `pdj-wallet` `createWallet` / `importWallet` | `deleteWallet` (WalletSelector → Disconnect) |

It survives NextAuth's `useSession()` losing state on client-side
navigation (bug #5719), ensuring the UI doesn't flash "Connect Wallet"
between page transitions.

**Auth model (R-#227 + R-#233 Fase 2):** the only API credential is the
NextAuth session cookie (HttpOnly JWT, `sub` = wallet). The former
`learn.tg.authToken` localStorage entry, `GET /api/auth/token` and
`lib/auth-token.ts` were removed on 2026-09-15, together with the
`billetera_usuario.token` column. See [SIWE Auth Flow](siwe-auth-flow.md) and
[R-#233](https://github.com/pasosdeJesus/learn.tg/issues/233).

## Comparison with Previous Approach

| Aspect | Before (RainbowKit + wagmi) | After (custom) |
|--------|----------------------------|----------------|
| Connect button | `ConnectButton` from RainbowKit | `ConnectWalletButton` (own) |
| Wallet state | wagmi `useAccount()` | NextAuth `useSession()` |
| Public client | wagmi `usePublicClient()` | `usePublicClient()` (viem + custom transport) |
| Wallet client | wagmi `useWalletClient()` | `useWalletClient()` (viem + custom transport) |
| Contract writes | wagmi `useWriteContract()` | `useWriteContract()` (eth_sendTransaction direct) |
| Disconnect detection | wagmi events | `window.ethereum` events + session watch |
| Bundle impact | ~200KB (RainbowKit + wagmi) | ~5KB (custom hooks + viem utilities) |
| Navigation resilience | Fragile (wagmi state loss → reconnect popups) | Solid (NextAuth session + localStorage fallback) |

## Key Files

| File | Purpose |
|------|---------|
| `components/WalletSelector.tsx` | Chooses in-app vs external wallet (R-#244 MVP) |
| `components/WalletPanel.tsx` | Unlocked wallet UI: balances, receive, send, collectibles (R-#249) |
| `lib/wallet-amounts.ts` | Panel format/parse/send-validation helpers |
| `lib/wallet-backup.ts` | Three-word backup confirmation |
| `components/ConnectWalletButton.tsx` | Connect/Disconnect button with SIWE via window.ethereum |
| `components/WalletEventListener.tsx` | Wallet event listener + session-based auth cleanup |
| `lib/hooks/useAuthAddress.ts` | Unified hook: session ∥ in-app wallet ∥ localStorage |
| `lib/hooks/useWalletProvider.ts` | Effective EIP-1193 provider (in-app while unlocked, else window.ethereum) |
| `packages/pdj-wallet` | Core: create/import/unlock/sign, AES-256-GCM storage, EIP-1193 provider |
| `packages/pdj-wallet-next` | `useInAppWallet`, `InAppWalletSetup`, `InAppWalletUnlock` |
| `lib/hooks/useWallet.ts` | usePublicClient + useWalletClient (viem, no wagmi) |
| `lib/hooks/useWriteContract.ts` | useWriteContract via eth_sendTransaction |
| `doc/siwe-auth-flow.md` | SIWE handshake protocol (NextAuth backend) |
| https://github.com/pasosdeJesus/learn.tg/issues/186 | Full migration specification and history |
