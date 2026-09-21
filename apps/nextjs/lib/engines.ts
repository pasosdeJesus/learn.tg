import type { NextRequest } from 'next/server'

import { createRegistry } from '@pasosdejesus/m/engine'
import { newKyselyPostgresql } from '@/.config/kysely-db'
import { authenticateUser } from '@/lib/authenticateUser'
import { authenticateAdmin } from '@/lib/admin-auth'

type HandlerFn = (req: NextRequest, ctx: { params: Record<string, string> }) => Promise<Response>
type EngineHandlers = Record<string, () => Promise<HandlerFn>>

// Engine registry backed by the generic globalThis registry from
// @pasosdejesus/m/engine (https://gitlab.com/pasosdeJesus/m/-/work_items/35, https://gitlab.com/pasosdeJesus/m/-/work_items/44). Lazy accessor so the static import
// below (which self-registers engines) can run before this module finishes
// evaluating (circular import is safe: registerEngine is a hoisted function).
function registry() {
  return createRegistry<EngineHandlers>('learn-tg:engine')
}

export function registerEngine(engineName: string, handlers: EngineHandlers): void {
  const r = registry()
  const existing = r.get(engineName) ?? {}
  for (const [k, v] of Object.entries(handlers)) existing[k] = v
  r.register(engineName, existing)
}

// ── Auto-register engines ───────────────────────────────────
// Each engine package self-registers via registerEngine on import
// (see packages/mr519/src/server/register.ts). Loaded lazily to avoid a
// circular import: a static import here would evaluate before this module's
// body, so `registerEngine` would be undefined inside the engine.
let enginesLoaded = false
async function ensureEnginesLoaded(): Promise<void> {
  if (enginesLoaded) return
  enginesLoaded = true
  // mr519 recibe sus deps inyectadas (D2, https://gitlab.com/pasosdeJesus/m/-/work_items/35 §10.3): db/auth del core.
  await import('@learn-tg/mr519/src/server/register').then((m) =>
    m.registerMr519({
      db: () => newKyselyPostgresql(),
      authenticateUser,
      authenticateAdmin,
    })
  )
}

export async function getEngineHandler(
  engineName: string,
  method: string,
  path: string[]
): Promise<HandlerFn | null> {
  await ensureEnginesLoaded()
  const eng = registry().get(engineName)
  if (!eng) return null
  const loader = findLoader(eng, method, path)
  if (!loader) return null
  try {
    return await loader()
  } catch (e) {
    // Graceful fallback (e.g. test context where next/server is unavailable):
    // the engine is registered, but its route could not be loaded.
    console.warn(
      `[engines] Handler load failed for ${engineName} ${method} /${path.join('/')}:`,
      e,
    )
    return (async () =>
      new Response(JSON.stringify({ error: 'Engine handler unavailable' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })) as HandlerFn
  }
}

/**
 * Resolves an engine loader: the exact key first, then the `[param]` templates a
 * package may register (`GET /forms/[id]`, `POST /forms/[id]/responses`).
 *
 * Without the template match the parameterised routes of `mr519` were unreachable
 * through `/api/engine/[engname]/[...path]` (the built key, `GET /forms/3`, did not
 * exist), so the engine only served its listing.
 * https://github.com/pasosdeJesus/learn.tg/issues/204
 */
function findLoader(
  eng: EngineHandlers,
  method: string,
  path: string[],
): (() => Promise<HandlerFn>) | undefined {
  const exact = eng[`${method} /${path.join('/')}`]
  if (exact) return exact

  for (const [key, loader] of Object.entries(eng)) {
    const [keyMethod, keyPath] = key.split(' ')
    if (keyMethod !== method || !keyPath) continue
    const template = keyPath.replace(/^\//, '').split('/')
    if (template.length !== path.length) continue
    const matches = template.every(
      (segment, i) =>
        (segment.startsWith('[') && segment.endsWith(']')) || segment === path[i],
    )
    if (matches) return loader
  }
  return undefined
}