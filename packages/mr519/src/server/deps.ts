import type { Kysely } from 'kysely'

/** Handler shape the host registry expects (see the app's `lib/engines.ts`). */
export type EngineHandler = (
  req: any,
  ctx: { params: Record<string, string> },
) => Promise<Response>

/**
 * Dependencias del core inyectadas por el host (D2, https://gitlab.com/pasosdeJesus/m/-/work_items/35 §10.3): mr519 no
 * importa `@/.config/kysely-db` ni `@/lib/*` (alias de la app). El host las
 * provee desde `lib/engines.ts`, incluido su registro de motores.
 */
export interface Mr519Deps {
  db: () => Kysely<any>
  authenticateUser: (
    db: Kysely<any>,
    wallet?: string,
  ) => Promise<{ usuario: { id: number } } | null>
  authenticateAdmin: (
    db: Kysely<any>,
    wallet: string,
  ) => Promise<any>
  /** The host's engine registry (`registerEngine` in `lib/engines.ts`). */
  registerEngine: (
    engineName: string,
    handlers: Record<string, () => Promise<EngineHandler>>,
  ) => void
}
