# Learn.tg as an app (user guide)

learn.tg works like an app: you can add it to your phone's home screen, open it
without a browser bar, and keep reading a guide you already opened even when the
connection drops.

## Install it

**Android (Chrome)**

1. Open `https://learn.tg` in Chrome.
2. Chrome shows a banner "Install Learn.tg on your home screen" (in Spanish:
   "Instala Learn.tg en tu pantalla de inicio"). Tap **Install**.
   If the banner does not appear, open the menu (three dots) and choose
   "Install app" / "Add to Home screen".
3. Confirm. The Learn.tg icon appears with your other apps.

**iPhone / iPad (Safari)**

1. Open `https://learn.tg` in Safari.
2. Tap the **Share** button.
3. Choose **Add to Home Screen** and confirm.

If you dismissed the banner, it stays hidden for a week; you can always install
from the browser menu.

## Use it without a connection

- Open the pages you plan to read while you have signal: the course list, the
  guide, and the crossword.
- The **course list** also works offline: the app shows the last list it downloaded
  while you had signal and warns "You are offline: showing the saved course list."
  (it is the saved copy, not a fresh one). To see courses you never loaded before,
  you need a connection.
- With no signal, open the app: pages you already visited are shown from a saved
  copy, and a yellow banner reminds you that you are offline
  ("You are offline. Your progress will be saved locally.").
- If a page was never opened while online, the app shows the offline page
  ("You are offline") with a **Retry** button.
- Solving a crossword offline is safe: your answer is saved and sent by itself
  when the connection comes back. The page shows how many answers are waiting
  ("1 answer saved offline, waiting to be sent."). Do not delete the app before
  the answers are sent.
- **The review happens online:** offline the app only shows the puzzle and takes
  your answer; the app does not tell you whether it is right while you have no
  connection. When you are back online the answer is checked and you get a
  **notification**: "correct" with the scholarship (USDT/SLEARN) if you qualify, or
  the crossword words that have a problem so you can try again.
- If sending the saved answer is **rejected** for a reason that retrying will not
  fix (for example, you do not have the 50 profile points yet), the page shows the
  reason instead of keeping the answer in the queue: fix it (complete your profile)
  and submit the crossword again.

**Your courses are saved for you.** While you are online the app downloads **all the
courses you can read** — the free ones and the ones you have paid for, with their
crosswords — without having to open each page first, and without pressing anything: when
there is something to save or update, a notice tells you how many guides it is checking
(“Checking what is missing or out of date 3/12”), and the course list shows how many
courses are already saved on this device. If you want to check again, tap **Check now**;
on the course page the same notice appears for that course, with the space it takes and a
way to delete the copy.
A saved course **never expires while you are offline**: you can read it any day you are
without a connection. When you are online the app checks once a day whether the content
changed and updates it. A downloaded course appears on the offline page with
all its guides, and you can read any of them and solve their crosswords without a
connection: your answers are saved and reviewed when the connection returns, and the
app tells you the result. Courses about following Jesus (R-#259) are only downloaded if
you turned on *Publish courses with Christian content* in **Privacy**; if you turn it
off, or you disconnect the wallet, the app deletes those copies from the phone. That
switch starts **off if you are in a country where the government persecutes Christians**
and **on in the rest**, so a course about Jesus is visible by default where that is not
dangerous; the Privacy page tells you which case applies and you can always change it.

## The wallet inside the app

You do not need to install a wallet app to use learn.tg.

1. Open the app and choose **Use in-app wallet** (while the app checks whether a
   wallet already exists the button just says **In-app wallet**).
2. Create a wallet with a **password (8 or more characters)**. Write the recovery
   phrase **on paper, in order**, and keep that paper somewhere safe: whoever has
   those 12 words owns the funds of the wallet. It is the only way to recover the
   wallet if you lose the phone (do not keep it as a screenshot or a digital note).
3. Write down the 12 words it shows, then type the **3 words** it asks for
   (random positions) and press **Confirm and sign in**: the app signs the message
   for you with the wallet it just created. If you close the window before
   pressing it, open the wallet again with **Sign in with in-app wallet**.
4. To stop using it, choose **Disconnect**. To use another wallet (for example
   MetaMask/OneKey instead), choose **Use external wallet**.

The full walkthrough (receive, send, collectibles) is in
[pdJ-wallet.md](pdJ-wallet.md).

If your phone can unlock with a fingerprint or Face ID, learn.tg offers
**unlock with fingerprint**: one touch opens the wallet and you do not type the
password again. The password keeps working as a backup, and if you cancel the
fingerprint prompt the app lets you type the password instead. The wallet stays
unlocked while you use it and locks itself after an hour without activity; the first
time you send money to an address it asks for the fingerprint to confirm, and then
not again for 15 minutes **to that same address** (a new address always asks, and
after the wallet locks itself it asks again). Both options are in the same window,
and you can turn the fingerprint on or off at any time.

Your password is never sent anywhere: it only unlocks the wallet stored
(encrypted) on your phone. If you forget the password, restore the wallet with the
recovery phrase.

## Problems?

- The app shows an old version of a page: close it, or clear the site data in the
  browser settings, and open it again.
- The install banner never appears: the app may already be installed, or your
  browser does not support it (Firefox does not). Use Chrome or Safari.
- Answers queued offline never leave: open the app once with a good connection
  and wait for the counter to disappear.
