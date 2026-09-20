/**
 * Registro de errores del servidor en un archivo.
 *
 * Por qué: en `next dev` el overlay de errores puede fallar al pintar el error
 * (medido 2026-09-20: `invalid type: boolean \`false\`, expected enum
 * CodeFrameColorMode`) y un 500 se queda sin causa visible: ni el `console.error`
 * del route ni la página de error llegan a la consola del servidor. Este helper
 * escribe el error (mensaje, `sql`, `detail`, `cause` y stack) en un archivo
 * además de stderr, y `instrumentation.ts` lo usa para los errores de request que
 * escapan a los `try/catch` de las rutas.
 *
 * Solo se usa en el servidor.
 *
 * Importante: NO importar `fs` con `import`. `instrumentation.ts` también se
 * compila para el runtime **edge** (el proyecto tiene `proxy.ts`), y ahí
 * `Can't resolve 'fs'` rompe el arranque entero (medido 2026-09-20: el sitio
 * local respondía 404/500 hasta quitar el import). Se usa
 * `process.getBuiltinModule('fs')` (Node >= 20.16), que el bundler no resuelve y
 * que en edge simplemente no existe.
 *
 * "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los
 * hombres" (Colosenses 3:23)
 */

/** `fs` de Node sin `import`, para no romper la compilación del runtime edge. */
function nodeFs(): typeof import('fs') | null {
  const getBuiltinModule = (process as unknown as {
    getBuiltinModule?: (id: string) => unknown
  }).getBuiltinModule
  if (typeof getBuiltinModule !== 'function') return null
  try {
    return getBuiltinModule('fs') as typeof import('fs')
  } catch {
    return null
  }
}

const DEFAULT_LOG = '/tmp/learn-tg-server-errors.log'

/** Archivo de errores (configurable con `SERVER_ERROR_LOG`). */
export function serverErrorLogPath(): string {
  return process.env.SERVER_ERROR_LOG || DEFAULT_LOG
}

export interface ServerErrorContext {
  /** Quién registra el error, por ejemplo `PATCH /api/admin/church/[id]`. */
  source: string
  method?: string
  url?: string
  routePath?: string
  /** Datos útiles para reproducir: ids, campos del body, etc. Nunca secretos. */
  extra?: Record<string, unknown>
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    const anyError = error as unknown as Record<string, unknown>
    const parts = [`${error.name}: ${error.message}`]
    if (anyError.sql) parts.push(`sql: ${String(anyError.sql).slice(0, 500)}`)
    if (anyError.detail) parts.push(`detail: ${String(anyError.detail).slice(0, 300)}`)
    if (anyError.code) parts.push(`code: ${String(anyError.code)}`)
    if (anyError.cause) {
      const cause = anyError.cause
      parts.push(`cause: ${cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause)}`)
    }
    if (error.stack) parts.push(error.stack.split('\n').slice(0, 10).join('\n'))
    return parts.join('\n')
  }
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

/**
 * Registra un error del servidor en stderr y en el archivo. Nunca lanza: si el
 * registro falla, el error original debe seguir su curso.
 */
export function logServerError(error: unknown, context: ServerErrorContext): void {
  const head = `[${new Date().toISOString()}] ${context.source}` +
    `${context.method ? ` ${context.method}` : ''}${context.url ? ` ${context.url}` : ''}`
  const blocks = [head]
  if (context.routePath) blocks.push(`route: ${context.routePath}`)
  if (context.extra) blocks.push(`extra: ${JSON.stringify(context.extra)}`)
  blocks.push(describe(error))
  const text = `${blocks.join('\n')}\n`
  console.error(text.trimEnd())
  try {
    nodeFs()?.appendFileSync(serverErrorLogPath(), text)
  } catch {
    // El log es best-effort: no debe tapar el error original.
  }
}

/**
 * Detalle del error para la respuesta JSON, solo fuera de producción (en
 * producción no se filtra información interna al cliente).
 */
export function devErrorDetail(error: unknown): string | undefined {
  if (process.env.NODE_ENV === 'production') return undefined
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  return message.slice(0, 500)
}
