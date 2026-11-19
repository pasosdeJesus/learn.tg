import { describe, it, expect, beforeAll } from 'vitest'
import { SHAPES, checkCodeFrames, hasWasmBindings, wasmDir } from '@/lib/next-codeframe-check.mjs'

// Regresión del parche de Next (R-#302 / vercel/next.js#99348): en OpenBSD/adJ no hay
// bindings nativos de SWC, así que Next usa `@next/swc-wasm-nodejs`, cuyo binding
// deserializa `CodeFrameOptions` de forma estricta. Sin el parche, cualquier code frame
// (dev overlay, diagnóstico de TypeScript, `jsconfig.json`) se sustituye por
// `invalid type: boolean 'false', expected enum CodeFrameColorMode` y el error real se
// pierde. La forma de la prueba vive en `lib/next-codeframe-check.mjs` para compartirla con
// `bin/check-next-codeframe.mjs` (`make next-patch-check`).
//
// En una plataforma con bindings nativos no aplica: se omite.

const applicable = hasWasmBindings()

describe.skipIf(!applicable)(`code frames con el binding WASM (${wasmDir()})`, () => {
  beforeAll(() => {
    // `next/dist/build/swc` decide por estas variables antes de cargarse.
    process.env.NEXT_TEST_WASM = '1'
    process.env.NEXT_TEST_WASM_DIR = wasmDir()
  })

  it(`renderiza las ${SHAPES.length} formas que Next usa en la vida real`, async () => {
    const { ok, failures } = await checkCodeFrames()
    expect(failures).toEqual([])
    expect(ok).toBe(true)
  }, 60000)

  it('cubre las formas del dev overlay y de TypeScript', () => {
    expect(SHAPES.map(([name]) => name)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('dev overlay'),
        expect.stringContaining('TypeScript'),
        expect.stringContaining('undefined'),
      ]),
    )
  })
})
