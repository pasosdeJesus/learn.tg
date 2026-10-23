# Your in-app wallet (user guide)

learn.tg can create a wallet **inside the app**: you do not need to install
MetaMask, OneKey or any other wallet app. This guide is for using it. To install
the app and read guides offline, see [pwa-user-guide.md](pwa-user-guide.md).

> Are you a developer? The components, hooks and backup internals are in
> [wallet-auth.md](wallet-auth.md); the core is the shared wallet
> `@pasosdejesus/m/wallet` (`m/REQ/14`).

> **Already have an external wallet** (MetaMask, Rabby, OKX, OneKey, Brave)? You can
> bring it inside learn.tg and keep the same address, history and scholarships:
> [Move your wallet into learn.tg](migration-in-app-wallet/en.md) (served as
> `/en/migration-in-app-wallet` and `/es/migracion-billetera-app`).

## Create your wallet

1. Open the app and choose **Use in-app wallet** (while it checks whether a wallet
   already exists, the button just says **In-app wallet**).
2. Choose a **password of at least 8 characters** and repeat it. There is no
   6-digit PIN: a short password is too easy to guess. That is the decided policy
   (operator, 2026-09-21): **8 characters minimum, no PIN**, no extra blocklist of
   "weak" passwords, and **no "unlock with the 12 words" shortcut** — the 3-word
   quiz of step 5 is the help for the user, and the recovery is importing the wallet.
   Use the **eye** at the right of each field to check what you typed before
   continuing.
3. The app asks **how you want to unlock this wallet**:
   - **With my fingerprint or Face ID (recommended)**, already selected when your
     phone can check it, or
   - **Only with the password**.
   In both cases the password keeps working as a backup, and you type it only once:
   with the gesture, the app seals the wallet with the password you just wrote.
4. The app shows **12 words**. Write them **on paper, in order**, and keep that
   paper somewhere safe: whoever has those 12 words owns the funds of the wallet.
   Never share them and do not keep them as a screenshot or a digital note. They are
   the **only** way to recover your wallet if you lose the phone.
5. It then asks you to type **3 of those words** (it picks random positions). This
   proves you really wrote them down; type them and press **Confirm and sign in**.
   If you did not copy them, press **Show the words again**.
6. The app signs you in with the wallet it just created.

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

## Use more than one wallet in the same account

Your progress, scores, privacy settings and the list of badges belong to **your account**,
not to a single address. You can add another wallet (an old MetaMask wallet, the wallet of
another phone…) and both reach the same account.

You manage those wallets from the **Accounts** tab of the wallet panel (last tab) and from
the profile, section **Wallets in this account**.

- **On this device**, with both wallets available: choose **Link another wallet**
  (*Vincular otra billetera*). It only appears when the app detects another wallet besides
  the connected one (the in-app wallet, another account of the browser wallet, or a second
  browser wallet). The wallet that signs is the **active** one: your in-app
  wallet when it is unlocked, otherwise the browser wallet you connected.
- **From another device**: choose **Invite a wallet** (*Invitar billetera*), type the other
  wallet's address and send the invitation. On the other phone, open learn.tg and sign in
  with that wallet: the app says which account invited it and asks whether to join. If you
  accept, the wallet is added. Pending invitations are listed there and can be cancelled.
  To invite, your profile needs **at least 50 points** (the same verified profile the
  rewards require).
- **What follows the account:** progress, scores, privacy switches, your referral code and
  the list of badges (the profile shows the badges held by **every** wallet of the
  account).
- **What stays in each wallet:** the money. Scholarships and claims are paid to the wallet
  you are using at that moment, and a badge is minted to the wallet that completed the
  course. Losing one wallet does not lose the account, and a stolen wallet cannot move a
  badge (they are soulbound).
- **One reward per account:** a guide's scholarship is paid **once per account** (another
  wallet of yours cannot collect it again) and the CELO UBI is claimed **once per account
  per day**.
- **Remove a wallet** from the wallet panel; the account always keeps at least one. Removing
  it **revokes the badges (SBT) minted to that wallet** on the blockchain: your account keeps
  the progress and the proof, and a verifier can re-mint the badge to another wallet of the
  account. Copies of paid courses downloaded with the removed wallet stay readable while the
  account has another wallet.

## I already have a verified account (and I started with the in-app wallet)

If you created your wallet inside learn.tg but you already had a **verified** account with an
older wallet (MetaMask, OKX, OneKey…), you do not have to start over:

1. In the account you are using now (the new in-app one), open **Wallets in this account**
   (profile) or the **Accounts** tab of the wallet panel and choose **I already have a
   verified account** (*Ya tengo una cuenta verificada*).
2. Type the **address of your old, verified wallet** and send the request.
3. Open learn.tg with that verified wallet (on the same phone or another one) and sign in.
   Go to **Profile → Wallets in this account** (*Perfil → Billeteras en esta cuenta*; also
   the **Accounts** tab of the wallet panel). Under **Requests to join this account**
   (*Solicitudes para unirse a esta cuenta*) press **Accept and add the wallet**
   (*Aceptar y agregar la billetera*) and sign with that wallet.
4. Your in-app wallet is added to the verified account and the new account is **deleted**
   with its data. Your progress, scores, badges and referral code stay untouched. Then sign
   in on the new device with the in-app wallet and you will see them.

Only an **unverified** account with no transactions, purchases or badges can send this
request. If your current account already holds any of those, ask a verifier to resolve it.

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
