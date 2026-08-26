// Adapter del core → motor `gdcluster` (REQ/35 §12 D2).
// El host inyecta DB, auth y las funciones de backend-config;
// las rutas de la app re-exportan handlers del motor sin lógica propia.
import { createGdclusterApp } from '@learn-tg/gdcluster/src/index'
// Registra el hook `reward:route-destination` en el proceso server (REQ/35
// §5.4): este adapter se importa desde todas las rutas del motor, así el
// registro ocurre en el bundle del servidor, donde `routeReward` lo ejecuta.
import '@learn-tg/gdcluster/src/register'
import { newKyselyPostgresql } from '@/.config/kysely-db'
import { authenticateUser } from '@/lib/authenticateUser'
import {
  getPublicClient,
  getWalletClient,
  getBackendWalletLower,
  sendTxAndWait,
  fetchTxWithReceipt,
  SLEARN_RATE,
} from '@/lib/backend-config'

export const gdclusterApp = createGdclusterApp({
  db: () => newKyselyPostgresql(),
  authenticateUser,
  backend: {
    getPublicClient,
    getWalletClient,
    getBackendWalletLower,
    sendTxAndWait,
    fetchTxWithReceipt,
    SLEARN_RATE,
  },
})
