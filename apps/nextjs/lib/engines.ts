import type { NextRequest } from 'next/server'

type HandlerFn = (req: NextRequest, ctx: { params: Record<string, string> }) => Promise<Response>

interface EngineRegistry {
  [engineName: string]: {
    // method + path → handler
    [methodPath: string]: () => Promise<HandlerFn>
  }
}

const registry: EngineRegistry = {}

/**
 * Register an engine's route handlers.
 * Called from each engine package at startup.
 */
export function registerEngine(
  engineName: string,
  handlers: Record<string, () => Promise<HandlerFn>>
) {
  if (!registry[engineName]) registry[engineName] = {}
  Object.assign(registry[engineName], handlers)
}

/**
 * Get the handler for a given engine, method, and path.
 */
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

/**
 * Discover and load all engine packages.
 * In production, this is static. In dev, it scans packages/*.
 */
export async function discoverEngines(): Promise<string[]> {
  return Object.keys(registry)
}
