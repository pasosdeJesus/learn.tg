# @learn-tg/pdj-wallet-next — Architecture

Design decisions of the React layer. For the API and the components see
[README.md](README.md); the core is in
[`packages/pdj-wallet/ARCHITECTURE.md`](../pdj-wallet/ARCHITECTURE.md).

## 1. Framework boundary

This package is the thin React wrapper over `@learn-tg/pdj-wallet`: React state,
the two minimal forms and the device-authentication flags. It keeps **no**
`node_modules` of its own — React, Testing Library and vitest resolve from
`apps/nextjs` — so it must not import anything app-specific (SIWE, `next-auth`,
the header, `WalletSelector`). The learn.tg integration (its own `WalletDialog`,
`WalletPanel`, `WalletSelector`, `WalletEventListener`) lives in the app and is
documented in [`doc/wallet-auth.md`](../../doc/wallet-auth.md).

## 2. One shared store (`useSyncExternalStore`)

`useInAppWallet` keeps a **single module-level store** read with
`useSyncExternalStore`, so every instance sees the same `status`.

Why: originally the creation UI kept its own copy of the hook state, so a component
that rendered `InAppWalletSetup` and the header that consumed `useInAppWallet()`
disagreed — the header stayed on `locked` and the button looked dead after creating
the wallet. Sharing the store fixed that class of bug.

`status` is `'loading' | 'no-wallet' | 'locked' | 'unlocked'`; `error` keeps the
last failure. The store also carries the device-auth flags (`biometricAvailable`,
`biometricEnabled`, `lockReason`).

## 3. Layer mapping (R-#246)

| Layer | Concern | Owner |
|---|---|---|
| **L0** | The password that protects the record | core (`wallet.ts`) |
| **L2** | Biometric **unlock** with the passkey's PRF | core (`biometric.ts`), surfaced here (`enableBiometric`, `unlockWithBiometric`, `biometricAvailable`, `biometricEnabled`) |
| **L1** | Fresh gesture before **moving funds** | core (`provider.ts`); this layer never re-implements it |

The **inactivity auto-lock** (one hour without activity) drops the key in memory and
sets `lockReason: 'idle'`; the app must keep the session in that case and only sign
out on `'user'` (header ✕) or `'deleted'`. On devices without WebAuthn the flags say
so and the password path is used; nothing here can gate a device without hardware,
which is why L1 tolerates it.

## 4. Components are intentionally minimal

`InAppWalletSetup` (create/import) and `InAppWalletUnlock` are plain forms with
English/Spanish copy; they do not own navigation or styling. The MVP needs a richer
modal (fingerprint enrolment, backup verification, the panel), so learn.tg composes
its own UI from `useInAppWallet` instead of forking these. Keeping them minimal
avoids dragging app concerns into a reusable package.

## 5. Testing

The core package is **mocked**, so the suite exercises React state and the forms
without crypto or IndexedDB; the shared-store behaviour is asserted explicitly (both
the components and the consumer must agree).
