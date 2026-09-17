# @learn-tg/pdj-wallet-next

Next.js hooks and client components for the in-app wallet. It wraps
`@learn-tg/pdj-wallet` with React state and UI.

Part of https://github.com/pasosdeJesus/learn.tg/issues/237; used by the MVP of
https://github.com/pasosdeJesus/learn.tg/issues/244.

## Install and build

The package has no `node_modules` of its own: it resolves React, the testing
library and the test runner from `apps/nextjs` (see `tsconfig.json` and
`vitest.config.ts`). Build the core package first.

```sh
cd packages/pdj-wallet && npm run build
cd ../pdj-wallet-next
npm run build          # tsc -b -> dist/
npm test               # vitest run --config vitest.config.ts
```

## API

```tsx
import { useInAppWallet, InAppWalletSetup, InAppWalletUnlock } from '@learn-tg/pdj-wallet-next'

const { status, walletInfo, create, importExisting, unlock, lock, remove, getProvider } = useInAppWallet()
```

`status` is `'loading' | 'no-wallet' | 'locked' | 'unlocked'`: it starts as
`loading`, becomes `no-wallet` when nothing is stored, `locked` when a wallet
exists, and `unlocked` after `create`, `importExisting` or `unlock`. `error`
keeps the last failure message.

When a wallet exists the hook first tries `restoreUnlockedSession()` from the core
package: the unlock is remembered in `sessionStorage` for the lifetime of the tab
(sliding 30 min TTL, cleared by `lock()` / the header ✕), so a reload no longer
forces the user to type the PIN again while the header shows a valid session
(https://github.com/pasosdeJesus/learn.tg/issues/244).

The state is **shared by every instance** of the hook (a module-level store read
with `useSyncExternalStore`): a component that renders `InAppWalletSetup` and the
component that consumes `useInAppWallet()` see the same `status`. Without that,
creating a wallet left the consumer on `locked` and the UI looked broken.

| Component | Props |
|---|---|
| `InAppWalletSetup` | `lang?: 'en' \| 'es'` (default `en`), `onDone?(address)` |
| `InAppWalletUnlock` | `lang?: 'en' \| 'es'` (default `en`), `onUnlocked?(address)` |

`InAppWalletSetup` offers "create" and "import" (mnemonic or private key),
requires a 6+ digit PIN twice, shows the recovery phrase after creation and
warns the user to write it down. `InAppWalletUnlock` takes the PIN and reports a
wrong PIN. Both are `'use client'` components and include English and Spanish
copy (`src/i18n.ts`).

## Tests

`npm test` runs 15 tests in `jsdom` with Testing Library: the hook state
transitions (`no-wallet` → `unlocked` → `locked` → `no-wallet`), error
propagation, `getProvider`, the state shared between instances (the components
and the consumer that renders them must agree), the setup form (create, import,
PIN mismatch, Spanish labels) and the unlock form. The core package is mocked,
so no real crypto or IndexedDB is required.
