# @learn-tg/pdj-wallet — Architecture

Design decisions behind the framework-agnostic in-app wallet. For install/build,
the API table, the storage adapters and the E2E usage see [README.md](README.md).

## 1. Framework-agnostic boundary

The package depends only on `viem` (peer). It has **no** dependency on `next`,
`react` or `kysely`, so the same core can serve learn.tg, sivel3 and stable-sl, and
each app builds its own UI on top of it (learn.tg does that in
`packages/pdj-wallet-next` and `apps/nextjs/components/Wallet*`).

## 2. What is stored

One record per wallet: `address`, `chain`, `createdAt`, the KDF parameters and the
ciphertext of `{ privateKey, mnemonic }`.

- The **mnemonic is stored** because it cannot be derived from the private key; it
  is the recovery path.
- Storage goes through the `StorageAdapter` interface (`get`/`set`/`delete`/`has`):
  `IndexedDBStorage` (browser default), `MemoryStorage` (tests) and `FileStorage`
  (Node/E2E).
- `FileStorage` lives in the `./storage` subpath on purpose: it imports
  `node:fs/promises` dynamically, and keeping it out of the package root keeps that
  out of browser bundles.

## 3. Secret derivation

- The record is encrypted with **AES-256-GCM**; the key is derived from the user
  secret with **PBKDF2-SHA256 (600,000 iterations, 16-byte salt)**. A fresh salt and
  IV are used on every encryption. `crypto.subtle` (Web Crypto) is used, so Node 18+
  and secure browser contexts both work.
- **Accepted secret** (R-#251, `isValidSecret`): a password/passphrase of at least
  8 printable characters. Nothing is in production, so the old 6-digit PIN is not
  supported. `unlockWallet` does not re-validate.
- The decrypted key lives only in **module memory** while the wallet is unlocked;
  `lockWallet()` and `deleteWallet()` clear it. A wrong password fails closed
  (`Wrong password or corrupted wallet data`), and a decrypted key that does not
  match the stored address is rejected.
- Argon2id is the documented future evolution (not implemented in the MVP).

## 4. Unlock layers (R-#246)

Three layers, each answering a different threat:

| Layer | What it is | Where it lives |
|---|---|---|
| **L0** | The password the user owns | `wallet.ts` (PBKDF2 record) |
| **L2** | Biometric **unlock** | `biometric.ts` + `web-authn.ts` |
| **L1** | Fresh gesture before **moving funds** | `provider.ts` (`requireFundsConfirmation`) |

### L2 — biometric unlock (WebAuthn PRF)

A page reload wipes module memory, so a reload used to mean typing the password
again even with a valid session. `enableBiometricUnlock(pin)` registers a passkey
and stores the private key **encrypted with a key derived (HKDF) from the WebAuthn
PRF secret** of that credential — the record holds only ciphertext, the credential
id and two non-secret salts. `unlockWithBiometric()` evaluates the PRF (one Face ID
/ fingerprint / device-PIN gesture) and decrypts.

- The authenticator produces the PRF secret; it never leaves the device and is never
  written down. Two evaluations with the same salt are identical, which is what makes
  this work across reloads.
- The **password record is untouched**: the password keeps working as fallback and
  recovery, and the 12 words remain the only way to recover on another device.
- Nothing readable is stored: no plaintext key in `sessionStorage` or IndexedDB. The
  earlier tab-scoped `sessionStorage` entry (2026-09-16) was removed; it was measured
  not to survive closing the app on any tested environment, so it bought little and
  kept the key readable.
- On devices without WebAuthn (the in-app browsers of Rabby, MetaMask, OneKey and OKX
  report `PublicKeyCredential: false`), these functions throw `no-webauthn` /
  `no-prf` and callers fall back to the password.

### L1 — funds confirmation (WebAuthn assertion)

Moving money out of the wallet asks the device to verify the user first, even inside
the same unlocked session: `eth_sendTransaction` calls
`requireFundsConfirmation()`, which performs a plain assertion with
`userVerification: 'required'` against the enrolled passkey. It needs no `prf`, so it
also works on devices where the biometric *unlock* is not available; and if no
passkey is enrolled (or the engine has no WebAuthn) the request goes through, because
L1 alone cannot protect a device without hardware.

- **Grace window + new destinations (R-#253):** once the user has verified with the
  device — an L1 assertion **or** an L2 biometric unlock — a transfer **to an address
  already used** does not ask again within `USER_VERIFICATION_GRACE_MS` (**15
  minutes**, `web-authn.ts`). A **new destination always asks**, even inside the
  window: that stops an automated or hostile flow from draining the wallet to an
  address the user never used. Destinations are remembered only after a successful
  broadcast (`destinations.ts`, per-wallet in `localStorage`).
  `lockWallet()`/`deleteWallet()` clear the window, so the idle auto-lock makes the
  next move prompt again. Trade-off accepted by the operator: on a stolen
  *unlocked* device, money can be moved to a known address within the 15 minutes
  without a gesture; the password is never stored and the 12 words remain the
  recovery.
- A cancelled prompt rejects the request with `code: 4001` and nothing is broadcast —
  the same contract as every other wallet.
- Reads (`eth_accounts`, `eth_chainId`) and signatures that do not move funds
  (`personal_sign`, `eth_signTypedData_v4`) are not gated, so signing in and reading
  balances never prompt twice.
- `requireUserVerification: false` exists for tests and for callers that do their own
  confirmation.

## 5. EIP-1193 provider

`getInAppWalletProvider({ rpcUrl, requireUserVerification })` returns a provider when
the wallet is unlocked, or `null`. Reads are forwarded to the RPC; writes go through
the L1 gate. `requireFundsConfirmation()` is exported so a caller can perform the
check on its own.

## 6. Open decisions

- KDF calibration on the device and transparent re-encryption on unlock (R-#251
  items 2-3).
- Argon2id if a WebCrypto implementation appears.
- Session lifetime (R-#250) and the address book are app concerns, not here.
