# @learn-tg/pdj-wallet

Framework-agnostic, self-custodied in-app wallet for the pdJ ecosystem
(learn.tg today; sivel3 and stable-sl later). It has no dependency on `next`,
`react` or `kysely`; `viem` is its only peer dependency.

Part of https://github.com/pasosdeJesus/learn.tg/issues/236 and used by the MVP
described in https://github.com/pasosdeJesus/learn.tg/issues/244.

## Install and build

The package declares its own dependencies (`viem`, `vitest`, `fake-indexeddb`,
`typescript`), so Node can import `dist/` directly (ESM needs the real package
resolvable from this folder). Install them once:

```sh
cd packages/pdj-wallet
pnpm install
pnpm run build          # tsc -b  -> dist/ (nodenext: explicit .js extensions)
pnpm test               # vitest run --config vitest.config.ts
```

`apps/nextjs` consumes the built `dist/` through its `exports` map, and its
`vitest.config.ts` aliases `viem` to the app's copy, so the two can coexist.

## API

```ts
import {
  createWallet, importWallet, unlockWallet, lockWallet, deleteWallet,
  enableBiometricUnlock, hasBiometricUnlock, unlockWithBiometric, disableBiometricUnlock,
  detectPlatformSupport, createPrfCredential, evaluatePrf,
  hasWallet, getWalletInfo, isUnlocked,
  exportMnemonic, exportPrivateKey,
  signMessage, signTypedData, signTransaction, signSIWE,
  getInAppWalletProvider,
  requireFundsConfirmation,
  MemoryStorage, IndexedDBStorage,
} from '@learn-tg/pdj-wallet'
```

| Function | Purpose |
|---|---|
| `createWallet({ pin, chain?, storage? })` | Generates a 12-word mnemonic, stores the encrypted key and returns `{ walletInfo, mnemonic }` |
| `importWallet({ mnemonic?, privateKey?, pin, chain?, storage? })` | Imports an existing wallet |
| `unlockWallet(pin, storage?)` | Decrypts the key into memory and returns `WalletInfo` |
| `enableBiometricUnlock(pin, storage?)` | Registers a passkey and stores the key sealed with its **PRF** secret (layer L2, see below); leaves the wallet unlocked |
| `unlockWithBiometric(storage?)` | One user-verified gesture decrypts the sealed key (`auth-failed` if it does not match) |
| `hasBiometricUnlock(storage?)` / `disableBiometricUnlock()` | Inspect or forget the sealed key |
| `detectPlatformSupport()` | `{ webauthn, userVerifying, prf }` without throwing; `prf: null` means "the engine did not say" |
| `lockWallet()` | Clears the in-memory key (the sealed key and the PIN record stay) |
| `deleteWallet(storage?)` | Removes the stored record, the sealed key and locks |
| `hasWallet(storage?)` / `getWalletInfo(storage?)` | Inspect the stored record without unlocking |
| `exportMnemonic(pin, storage?)` / `exportPrivateKey(pin, storage?)` | PIN-protected export, no side effects on the session (a wallet imported from a private key has no phrase) |
| `signMessage(message)` / `signSIWE(message)` | EIP-191 signature with the unlocked key |
| `signTypedData(typedData)` / `signTransaction(tx)` | EIP-712 / transaction signature |
| `getInAppWalletProvider({ rpcUrl?, requireUserVerification? })` | EIP-1193 provider when unlocked, `null` otherwise. `eth_sendTransaction` asks for a fresh user-verified assertion first (layer L1); `requireUserVerification: false` disables that for tests |
| `requireFundsConfirmation()` | Performs the L1 check on its own; allows the operation on devices without a passkey |

`chain` is `'celo'` (42220) or `'celoSepolia'` (11142220, default).

### Biometric unlock (WebAuthn PRF)

A page reload wipes the module memory, so a reload used to mean typing the PIN
again even with a valid session. `enableBiometricUnlock(pin)` registers a passkey
and stores the private key **encrypted with a key derived (HKDF) from the
WebAuthn PRF secret** of that credential — the record holds only ciphertext, the
credential id and two non-secret salts. `unlockWithBiometric()` evaluates the PRF
(one Face ID / fingerprint / device-PIN gesture) and decrypts.

- The authenticator produces the PRF secret; it never leaves the device and is
  never written down. Two evaluations with the same salt are identical, which is
  what makes this work across reloads.
- The **PIN record is untouched**: the PIN keeps working as fallback and recovery,
  and the 12 words remain the only way to recover on another device.
- Nothing readable is stored: no plaintext key in `sessionStorage` or IndexedDB.
  The earlier tab-scoped `sessionStorage` entry (2026-09-16) was removed; it was
  measured not to survive closing the app on any tested environment, so it bought
  little and kept the key readable.
- On devices without WebAuthn (the in-app browsers of Rabby, MetaMask, OneKey and
  OKX report `PublicKeyCredential: false`), these functions throw
  `no-webauthn` / `no-prf` and callers fall back to the PIN.

### Funds confirmation (WebAuthn gesture, layer L1)

Moving money out of the wallet asks the device to verify the user first, even
inside the same unlocked session: `eth_sendTransaction` calls
`requireFundsConfirmation()`, which performs a plain assertion with
`userVerification: 'required'` against the enrolled passkey. It needs no `prf`, so
it also works on devices where the biometric *unlock* is not available; and if no
passkey is enrolled (or the engine has no WebAuthn, as in the in-app browsers of
Rabby, MetaMask, OneKey and OKX) the request goes through, because L1 alone
cannot protect a device without hardware.

- A cancelled prompt rejects the request with `code: 4001` and nothing is
  broadcast — the same contract as every other wallet.
- Reads (`eth_accounts`, `eth_chainId`) and signatures that do not move funds
  (`personal_sign`, `eth_signTypedData_v4`) are not gated, so signing in and
  reading balances never prompt twice.
- `requireUserVerification: false` exists for tests and for callers that do their
  own confirmation.

## Security model

- The private key is encrypted with **AES-256-GCM**; the key is derived from the
  PIN with **PBKDF2 (SHA-256, 600,000 iterations, 16-byte salt)**. A fresh salt
  and IV are used on every encryption.
- `crypto.subtle` (Web Crypto) is used, so Node 18+ and secure browser contexts
  both work.
- The decrypted key lives only in module memory while the wallet is unlocked;
  `lockWallet()` and `deleteWallet()` clear it. The biometric record is ciphertext
  whose key can only be produced by the authenticator after the user verifies.
- A wrong PIN fails closed (`Wrong PIN or corrupted wallet data`); a decrypted
  key that does not match the stored address is rejected.
- Argon2id is the documented future evolution (not implemented in the MVP).

## Storage adapters

| Adapter | Environment | Notes |
|---|---|---|
| `IndexedDBStorage` | Browser | Default when `indexedDB` exists |
| `MemoryStorage` | Tests, Node.js | Pass it explicitly |
| `FileStorage` | Node.js (E2E) | JSON file (`0600`); import it from `@learn-tg/pdj-wallet/storage` |

`FileStorage` lives in the `./storage` subpath on purpose: it imports
`node:fs/promises` dynamically, and keeping it out of the package root keeps that
out of browser bundles.

An adapter implements:

```ts
interface StorageAdapter {
  get(): Promise<StoredWallet | null>
  set(record: StoredWallet): Promise<void>
  delete(): Promise<void>
  has(): Promise<boolean>
}
```

`FileStorage` (Node.js, for E2E) is implemented: see the table above.

## Using it from E2E (Node.js)

The package is ESM with explicit extensions, so Node can import it directly:

```js
import { createWallet, importWallet, signSIWE } from '@learn-tg/pdj-wallet'
import { FileStorage } from '@learn-tg/pdj-wallet/storage'

const storage = new FileStorage('/tmp/e2e-wallet.json')
const { walletInfo } = await createWallet({ pin: '123456', storage })
const signature = await signSIWE(siweMessageFor(walletInfo.address))
```

`apps/nextjs/e2e/helpers/in-app-wallet.mjs` wraps this (create/import a wallet,
shim `window.ethereum` in the page so its `personal_sign` is signed by the core,
and sign in with SIWE from Node).

## Tests

`npm test` runs the unit suite in the `node` environment (18 tests): encryption
round-trip and wrong PIN, wallet lifecycle, signature verification against
`viem`'s `verifyMessage`, and the EIP-1193 provider methods. The `IndexedDBStorage`
test is skipped unless `fake-indexeddb` is installed (it is not installed yet;
add it as a devDependency to enable that test).
