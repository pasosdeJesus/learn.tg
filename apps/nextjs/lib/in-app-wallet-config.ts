'use client'

import { configureInAppWallet } from '@pasosdejesus/m/wallet/next'

// learn.tg's storage namespaces for the shared in-app wallet (`m/REQ/37`).
//
// The values are the ones used before the graduation: the IndexedDB name, the
// destination prefix and the passkey RP name are the identity of the stored funds,
// so changing them would hide the existing wallets. This must run on the client
// before the wallet is used (the root `AppProvider` imports it for that).
configureInAppWallet({
  dbName: 'learn-tg-pdj-wallet',
  destinationsPrefix: 'learn.tg.pdj-wallet.',
  rpName: 'learn.tg',
})
