import type { NextRequest } from 'next/server'

type HandlerFn = (req: NextRequest, ctx: { params: Record<string, string> }) => Promise<Response>

interface EngineRegistry {
  [engineName: string]: {
    [methodPath: string]: () => Promise<HandlerFn>
  }
}

const registry: EngineRegistry = {}

export function registerEngine(
  engineName: string,
  handlers: Record<string, () => Promise<HandlerFn>>
) {
  if (!registry[engineName]) registry[engineName] = {}
  Object.assign(registry[engineName], handlers)
}

export async function getEngineHandler(
  engineName: string,
  method: string,
  path: string[]
): Promise<HandlerFn | null> {
  const eng = registry[engineName]
  if (!eng) return null
  const key = `${method} /${path.join('/')}`
  const loader = eng[key]
  if (!loader) return null
  return loader()
}

// ── Auto-register known engines ──────────────────────────────
// Using a wrapper to avoid TypeScript module resolution errors
// for link: packages that don't have their own node_modules.

// @ts-ignore - dynamic import via string, TS can't statically check
async function _import(specifier: string): Promise<any> {
  return import(specifier)
}

// All handlers wrap with try/catch — if the import fails (e.g. in test
// context where next/server is unavailable), returns a stub that logs the error.
function safeHandler(loader: () => Promise<HandlerFn | undefined>): () => Promise<HandlerFn> {
  return async () => {
    try {
      const h = await loader()
      if (h) return h
    } catch (e) {
      console.warn(`[engines] Handler load failed:`, e)
    }
    // Fallback: returns 500 on invocation
    return (async () => new Response(JSON.stringify({ error: 'Engine handler unavailable' }), { status: 500, headers: { 'Content-Type': 'application/json' } })) as HandlerFn
  }
}

registerEngine('mr519', {
  'GET /forms': safeHandler(() => _import('@learn-tg/mr519/src/server/forms/route').then(m => m.GET)),
  'GET /forms/[id]': safeHandler(() => _import('@learn-tg/mr519/src/server/forms/by-id/route').then(m => m.GET)),
  'POST /forms/[id]/responses': safeHandler(() => _import('@learn-tg/mr519/src/server/forms/by-id-responses/route').then(m => m.POST)),
})

registerEngine('mr519-admin', {
  'POST /forms': safeHandler(() => _import('@learn-tg/mr519/src/server/admin/forms/route').then(m => m.POST)),
})