/**
 * Motor `wallet` ([REQ/50](https://gitlab.com/pasosdeJesus/m/-/work_items/50)) — la billetera **del usuario**: enlace
 * billetera ↔ usuario (**N billeteras**), invitaciones y el arranque de sesión con
 * billetera.
 *
 * Tablas **propias** del motor: `billetera_usuario`/`billetera_invitada` (sus migraciones,
 * `db/migrations/`); compone `msip` sólo por `usuario`. `provides: ["auth","wallet"]`.
 *
 * La **UI** (`@pasosdejesus/m/wallet/next`) y el **glue de autenticación** (NextAuth,
 * `auth-options.ts`) viven fuera del motor (fase V y el consumidor, respectivamente).
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)
 */

export * from './wallet-link.js'
export * from './controllers.js'
export { model } from './model.js'
