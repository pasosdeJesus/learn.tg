# Your in-app wallet (user guide)

learn.tg can create a wallet **inside the app**: you do not need to install
MetaMask, OneKey or any other wallet app. This guide is for using it. To install
the app and read guides offline, see [pwa-user-guide.md](pwa-user-guide.md).

> Are you a developer? The components, hooks and backup internals are in
> [wallet-auth.md](wallet-auth.md); the library itself is in
> [`packages/pdj-wallet/README.md`](../packages/pdj-wallet/README.md).

## Create your wallet

1. Open the app and choose **Use in-app wallet** (while it checks whether a wallet
   already exists, the button just says **In-app wallet**).
2. Choose a **password of at least 8 characters** and repeat it. There is no
   6-digit PIN: a short password is too easy to guess. That is the decided policy
   (operator, 2026-09-21): **8 characters minimum, no PIN**, no extra blocklist of
   "weak" passwords, and **no "unlock with the 12 words" shortcut** — the 3-word
   quiz of step 4 is the help for the user, and the recovery is importing the wallet.
3. The app shows **12 words**. Write them **on paper, in order**, and keep that
   paper somewhere safe: whoever has those 12 words owns the funds of the wallet.
   Never share them and do not keep them as a screenshot or a digital note. They are
   the **only** way to recover your wallet if you lose the phone.
4. It then asks you to type **3 of those words** (it picks random positions). This
   proves you really wrote them down; type them and press **Confirm and sign in**.
   If you did not copy them, press **Show the words again**.
5. The app signs you in with the wallet it just created.

Your password is never sent anywhere: it only unlocks the wallet stored
(encrypted) on your phone.

## Come back later

- If the app asks, type your **password**.
- If your phone can unlock with a fingerprint or Face ID, learn.tg offers
  **unlock with fingerprint**: one touch opens the wallet. The password keeps
  working as a backup, and you can cancel the fingerprint prompt and type the
  password instead.
- The wallet locks itself after an hour without activity. The **first time** you
  move money to an address it asks for the fingerprint to confirm, and then **not
  again for 15 minutes to that same address**; a new address always asks again, and
  so does the wallet once it locks itself.

## See what you have

Tapping the wallet button in the header opens the **wallet panel**:

- Your **address** (with a **Copy** button) — the account where your rewards and
  donations arrive.
- Your **balances** in CELO, USDT and SLEARN.
- **Collectibles (Celo)**: your badges and NFTs, loaded when you ask for them.

## Receive money

Choose **Receive**: the app shows your address and a QR code. Share either one
with whoever is going to send you funds (on the Celo network).

## Send money

1. Open the panel and choose the token: **CELO**, **USDT** or **SLEARN**.
2. Type the destination address and the amount. **Max** fills the amount leaving
   a little CELO for the network fee.
3. Press **Send** and confirm with your fingerprint (or password) when asked.
4. The panel shows the transaction hash and a link to view it on the explorer.

The app refuses an invalid address, an address that is yours, or an amount larger
than your balance, before asking you to confirm anything.

## Stop using it

- **Disconnect** signs you out on this device. To use another wallet instead,
  choose **Use external wallet** (MetaMask, OneKey, OKX…).
- **Delete wallet** (in the wallet window) removes the wallet from this device.
  Your funds remain on the blockchain and can only be restored with your 12 words.

## Problems?

- **I forgot my password:** restore the wallet with your **12 words**; the password
  cannot be recovered.
- **I lost the phone:** restore the wallet with your 12 words on another device.
  No one else can do it for you: keep them offline.
- **The panel shows a balance of `—`:** that token could not be read at that
  moment; close and reopen the panel to try again. The other balances still work.
- **A send was cancelled with no explanation:** that is the fingerprint or Face ID
  prompt being cancelled; nothing was sent, try again.
- **Offline:** your progress is saved on the phone and sent when the connection
  comes back. See [pwa-user-guide.md](pwa-user-guide.md).
