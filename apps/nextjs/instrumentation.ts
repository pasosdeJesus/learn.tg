/**
 * Hooks de instrumentación del servidor (Next 16).
 *
 * `onRequestError` captura los errores que escapan a los `try/catch` de las
 * rutas (incluidos los del middleware/proxy y los de render): en `next dev` el
 * overlay de errores puede fallar al pintarlos (medido 2026-09-20: `invalid type:
 * boolean \`false\`, expected enum CodeFrameColorMode`) y un 500 quedaba sin causa
 * visible en la consola del servidor. Se registran en stderr y en
 * `SERVER_ERROR_LOG` (por defecto `/tmp/learn-tg-server-errors.log`) — ver
 * `lib/server-errors.ts`.
 *
 * Se registra también `unhandledRejection` / `uncaughtException` porque los
 * fallos de las rutas de streaming y de las promesas sueltas no pasan por
 * `onRequestError`.
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor" (Colosenses 3:23)
 */

export async function register(): Promise<void> {
  // `instrumentation.ts` también puede cargarse en el runtime edge, que no tiene
  // `process.on` ni `fs`: los hooks se registran solo en nodejs.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { logServerError, serverErrorLogPath } = await import('@/lib/server-errors')
  console.log(`[server-errors] errores del servidor -> ${serverErrorLogPath()}`)
  process.on('unhandledRejection', (reason: unknown) => {
    logServerError(reason, { source: 'unhandledRejection' })
  })
  process.on('uncaughtException', (error: unknown) => {
    logServerError(error, { source: 'uncaughtException' })
  })
}

export async function onRequestError(
  error: unknown,
  request: { path?: string; method?: string },
  context: { routePath?: string; routerKind?: string; routeType?: string },
): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { logServerError } = await import('@/lib/server-errors')
  logServerError(error, {
    source: 'onRequestError',
    method: request?.method,
    url: request?.path,
    routePath: context?.routePath,
    extra: { routerKind: context?.routerKind, routeType: context?.routeType },
  })
}
