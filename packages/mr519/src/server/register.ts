import { registerEngine } from '@/lib/engines'
import type { Mr519Deps } from './deps'

/**
 * Registra los motores mr519/mr519-admin con las deps del core inyectadas
 * (D2, https://gitlab.com/pasosdeJesus/m/-/work_items/35 §10.3): db/auth vienen del host (lib/engines.ts), el motor no
 * importa `@/.config/kysely-db` ni `@/lib/*`.
 */
export function registerMr519(deps: Mr519Deps) {
  registerEngine('mr519', {
    'GET /forms': () => import('./forms/route').then(m => m.makeGetForms(deps)),
    'GET /forms/[id]': () => import('./forms/by-id/route').then(m => m.makeGetFormById(deps)),
    'POST /forms/[id]/responses': () => import('./forms/by-id-responses/route').then(m => m.makePostResponse(deps)),
  })

  registerEngine('mr519-admin', {
    'POST /forms': () => import('./admin/forms/route').then(m => m.makePostAdminForm(deps)),
  })
}
