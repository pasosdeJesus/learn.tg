// Formas y comprobación de los code frames con el binding WASM de Next
// (R-#302 / vercel/next.js#99348). Sin el parche estas formas lanzan
// `invalid type: boolean 'false', expected enum CodeFrameColorMode` o `expected usize`
// en lugar de renderizar.
//
// Vive aquí (y no en `bin/`) para que lo usen los dos: la prueba de regresión
// (`lib/__tests__/next-codeframe-wasm.test.ts`, dentro de `make test`) y el chequeo
// rápido del parche (`bin/check-next-codeframe.mjs`, dentro de `make next-patch-check`).
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export const SOURCE = [
  'const a = 1',
  'const b = 2',
  'const missing = await readFile("x")',
  'const c = 4',
].join('\n')

export const LOCATION = { start: { line: 3, column: 1 } }

// Formas que Next pasa en la vida real (dev overlay, diagnósticos de TypeScript,
// `jsconfig.json`) más los bordes del mapeo de napi (`color` booleano/numérico/enum,
// campos `undefined`, `language` en sus dos grafías y `message`).
export const SHAPES = [
  ['dev overlay (color booleano false)', { color: false, maxWidth: undefined }],
  ['diagnóstico TypeScript (color true)', { color: true }],
  ['color enum "None"', { color: 'None' }],
  ['color numérico 0 (Error)', { color: 0 }],
  ['color numérico 2 (Info)', { color: 2 }],
  [
    'campos undefined (language, highlightCode, linesAbove)',
    { color: false, maxWidth: 240, language: undefined, highlightCode: undefined, linesAbove: undefined },
  ],
  ['language "css" y message', { color: true, message: 'boom', language: 'css' }],
  ['language "javascript" en minúscula', { color: true, language: 'javascript' }],
]

/** Directorio del binding wasm de esta instalación (o el que diga el entorno). */
export function wasmDir() {
  return process.env.NEXT_TEST_WASM_DIR || join(process.cwd(), 'node_modules', '@next', 'swc-wasm-nodejs')
}

/** ¿Hay binding wasm para probar? En una plataforma con nativos, no aplica. */
export function hasWasmBindings() {
  return existsSync(join(wasmDir(), 'wasm_bg.wasm'))
}

/**
 * Renderiza todas las formas. Devuelve `{ ok, failures }` con un mensaje por forma fallida.
 * Debe llamarse después de fijar `NEXT_TEST_WASM=1` y `NEXT_TEST_WASM_DIR`.
 */
export async function checkCodeFrames() {
  const { loadBindings } = await import('next/dist/build/swc/index.js')
  const { codeFrameColumns } = await import('next/dist/shared/lib/errors/code-frame.js')
  await loadBindings()

  const failures = []
  for (const [name, options] of SHAPES) {
    try {
      const output = codeFrameColumns(SOURCE, LOCATION, options)
      if (typeof output !== 'string' || output.length === 0) {
        failures.push(`${name}: devolvió ${JSON.stringify(String(output).slice(0, 60))}`)
        continue
      }
      // Con color la línea sale token por token, así que el contenido se comprueba sólo en
      // las formas sin color; en las demás basta con que no lancen.
      if (options.color === false && !output.includes('missing = await readFile')) {
        failures.push(`${name}: no incluye la línea del error`)
      }
    } catch (error) {
      failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return { ok: failures.length === 0, failures }
}
