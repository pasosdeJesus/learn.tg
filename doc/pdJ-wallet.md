# In-app wallet panel

> "Whatever you do, work at it with all your heart, as working for the Lord,
> not for human masters." (Colossians 3:23)

How the in-app wallet (created on the device, `packages/pdj-wallet`) is shown and
used in learn.tg: the header pill, the **wallet panel** with balances, receive and
send, the collectibles section, and the three-word backup confirmation.

Spec: https://github.com/pasosdeJesus/learn.tg/issues/249 (panel),
https://github.com/pasosdeJesus/learn.tg/issues/244 (in-app wallet) and
https://github.com/pasosdeJesus/learn.tg/issues/246 (unlock layers).

> **See also:** [wallet-auth.md](wallet-auth.md) for the connection/SIWE flow and
> the `WalletDialog` (create, import, unlock, fingerprint),
> [pdj-wallet-testing.md](pdj-wallet-testing.md) for the test loop, and
> [siwe-auth-flow.md](siwe-auth-flow.md) for the session model.

## 1. Two surfaces, one pill

Tapping the wallet pill in the header opens one of two dialogs, decided by the
wallet state (`components/WalletSelector.tsx`):

| Wallet state | What the pill opens |
|---|---|
| No wallet, or wallet locked | `WalletDialog` — create / import / unlock / fingerprint |
| Wallet **unlocked** | `WalletPanel` — balances, receive, send, collectibles |

The unlock flow is a security surface and the panel is a wallet UI; keeping them
apart makes each one easier to reason about (and to test). The panel is only
opened when the key is in memory, so it never has to ask for the PIN itself.

## 2. What the panel shows

`components/WalletPanel.tsx` (client component):

- **Address**: checksummed (`getAddress`), with a **Copy** button that confirms
  (`Copied`).
- **Balances**: CELO (18 decimals), USDT (6) and SLEARN (2). The three reads run
  in parallel with `Promise.allSettled`: one failing call leaves the other two
  visible instead of blanking the row, and a `null` balance shows `—` (never
  `NaN`). Balances refresh when the panel opens and after a transfer.
- **Receive**: a `QRCodeSVG` (`qrcode.react`, the dependency the app already had)
  plus the address as text.
- **Send**: token selector (CELO / USDT / SLEARN), destination, amount and a
  `Max` that leaves **0.01 CELO** for the network fee on native transfers.
- **Collectibles (Celo)**: loaded lazily from Blockscout when the user asks, with
  an explicit empty state and a section that fails without touching the balances.
- **Disconnect and lock**: same effect as the header ✕.

## 3. Send validation

The rules live in `lib/wallet-amounts.ts` (pure functions, unit-tested), not in
the component:

| Helper | Purpose |
|---|---|
| `formatTokenAmount(value, decimals)` | Display, trims trailing zeros, `—` for `null` |
| `parseTokenAmount(input, decimals)` | Base units; rejects non-positive and too many decimals |
| `validateSend({ to, amount, balance, isNative, selfAddress, gasCost })` | Returns `invalid-address`, `invalid-amount`, `insufficient`, `self`, `no-gas` or `null` |
| `explorerAddressBase` / `explorerApiNftsUrl` / `explorerTxUrl` | Blockscout links per network |

`validateSend` rejects a malformed address, an address with a bad EIP-55
checksum, the wallet's own address, a non-positive amount, and an amount above
the balance. For native CELO the amount **plus the fee** must fit, hence the
`no-gas` case.

Signing goes through the wallet provider, so it **inherits layer L1** of
https://github.com/pasosdeJesus/learn.tg/issues/246: moving funds asks for a
fresh fingerprint (or the PIN) before signing. The result screen shows the hash
and an explorer link.

## 4. Balances and addresses

Reads go through `usePublicClient()` (`lib/hooks/useWallet.ts`), which uses the
effective provider when there is one and falls back to the configured RPC when
there is none (an unlocked in-app wallet is itself an EIP-1193 provider). USDT
and SLEARN addresses come from the environment (`NEXT_PUBLIC_USDT_ADDRESS`,
`NEXT_PUBLIC_SLEARN_ADDRESS`), the same resolution the donation and checkout
modals use.

## 5. Backup confirmation (three words)

The recovery phrase is shown **once**, when the wallet is created. Before the
wallet counts as backed up the user must type **three words in random positions**
(`lib/wallet-backup.ts`):

- `pickVerifyPositions(wordCount)` returns distinct 1-based positions, sorted.
- `verifyWords(words, inputs)` compares case-insensitively and trimmed, and
  reports which positions are wrong.
- `markBackupConfirmed()` / `isBackupConfirmed()` keep a `localStorage` flag
  (`learn.tg.wallet.backupConfirmed`) that is **not** a secret; it only records
  that the check was passed on this device.
- The user can press "Show the words again" to re-read the phrase while
  confirming, and a wrong word never signs in.

This replaced the previous "I saved them" button, which proved nothing
(`WalletDialog.tsx`), and moved the check from
https://github.com/pasosdeJesus/learn.tg/issues/184 to
https://github.com/pasosdeJesus/learn.tg/issues/249.

## 6. Language

Every string is in the component's `createComponentT` dictionary with English and
Spanish entries (`components/WalletPanel.tsx`, `components/WalletDialog.tsx`).
English is the source language.

## 7. Tests

Unit (`cd apps/nextjs`):

```sh
./node_modules/.bin/vitest run components/__tests__/WalletPanel.test.tsx \
  lib/__tests__/wallet-amounts.test.ts lib/hooks/__tests__/usePublicClient.test.tsx \
  lib/__tests__/wallet-backup.test.ts components/__tests__/WalletDialog.test.tsx
```

E2E (`e2e/specs/in-app-wallet-payments.spec.mjs`) covers pill → panel → real
balance → QR → copy → invalid destination rejected. See
[pdj-wallet-testing.md](pdj-wallet-testing.md) for the full fast loop.

## 8. Open items

- Fiat estimate: there is no price feed for SLEARN (its value comes from the
  reserve rules of the whitepaper), so the panel shows token amounts only.
- NFT API choice (Blockscout vs Celoscan) and caching are not settled.
- Contact/address book: a plain address is enough for now.
- "Lock now" and "delete wallet" still live in `WalletDialog`; "disconnect and
  lock" is offered in the panel.
