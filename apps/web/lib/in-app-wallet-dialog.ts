'use client'

/**
 * Opens the in-app wallet dialog from anywhere in the app.
 *
 * `WalletSelector` (mounted in the header of every page) owns the only
 * `WalletDialog` instance, so a modal that needs an unlocked wallet — the
 * donation and course-purchase modals — asks for it by dispatching this event
 * instead of rendering a second dialog.
 *
 * Why: after a page load the in-app wallet is locked (the key lives in memory
 * only), so those modals have no wallet client even though the user is signed in;
 * they used to say "Connect and sign with your wallet", which is misleading.
 */
export const OPEN_IN_APP_WALLET_DIALOG = 'learn-tg:open-in-app-wallet-dialog'

export function openInAppWalletDialog(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(OPEN_IN_APP_WALLET_DIALOG))
}
