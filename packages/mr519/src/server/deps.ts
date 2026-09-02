import type { Kysely } from 'kysely'

/**
 * Dependencias del core inyectadas por el host (D2, https://gitlab.com/pasosdeJesus/m/-/work_items/35 §10.3): mr519 no
 * importa `@/.config/kysely-db` ni `@/lib/*` (alias de la app). El host las
 * provee desde `lib/engines.ts`.
 */
export interface Mr519Deps {
  db: () => Kysely<any>
  authenticateUser: (
    db: Kysely<any>,
    wallet?: string,
    token?: string,
  ) => Promise<{ usuario: { id: number } } | null>
  authenticateAdmin: (
    db: Kysely<any>,
    wallet: string,
    token: string,
  ) => Promise<any>
}
