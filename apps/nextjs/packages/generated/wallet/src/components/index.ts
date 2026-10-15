/**
 * Faceta **V** del motor `wallet` ([REQ/50](https://gitlab.com/pasosdeJesus/m/-/work_items/50) D9) — la vista **genérica** de
 * billetera. Punto de entrada con el **modal de elección** (in-app o externa) de sivel3,
 * sobre la base de learn.tg.
 *
 * **Sobrecargable** (D10): importa `WalletConnect`, o compón con los primitivos de
 * `@pasosdejesus/m/wallet/next` (`InAppWalletSetup`/`InAppWalletUnlock`/`useInAppWallet`),
 * o reemplaza el cuerpo con `renderBody`. `eng:sync` deriva `views.components` de aquí.
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

export {
  WalletConnect,
  type WalletConnectProps,
  type WalletConnectMessages,
  type WalletConnectBodyContext,
  type WalletLang,
} from './WalletConnect.js'
export {
  WalletPanel,
  type WalletPanelProps,
  type WalletPanelWallet,
  type WalletPanelMessages,
  type WalletToken,
  type WalletNft,
  type WalletPanelFeatures,
} from './WalletPanel.js'

// Re-export de los primitivos de `@pasosdejesus/m/wallet/next` (transición, D9): el
// motor es el **punto único** para la UI de billetera; el consumidor puede tomar de
// aquí las vistas completas (`WalletConnect`/`WalletPanel`) o los primitivos.
export {
  useInAppWallet,
  InAppWalletSetup,
  InAppWalletUnlock,
  isValidPassword,
  configureInAppWallet,
  resetInAppWalletStoreForTests,
  INACTIVITY_LOCK_MS,
  type InAppWalletStatus,
  type InAppWalletLockReason,
  type UseInAppWalletResult,
  type InAppWalletNamespaces,
} from '@pasosdejesus/m/wallet/next'
