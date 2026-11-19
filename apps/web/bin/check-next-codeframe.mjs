#!/usr/bin/env node
// Chequeo rápido de los code frames con el binding WASM de Next (R-#302 /
// vercel/next.js#99348). Lo usa `make next-patch-check`; la misma comprobación corre en la
// suite de regresión como `lib/__tests__/next-codeframe-wasm.test.ts`.
//
//   node bin/check-next-codeframe.mjs
//
// Sale con 0 si todas las formas renderizan, 1 si alguna falla y 0 con nota si no hay
// binding wasm (plataforma con bindings nativos).

// Se fija antes de cargar Next: `next/dist/build/swc` decide por esta variable.
process.env.NEXT_TEST_WASM = '1'

const { hasWasmBindings, checkCodeFrames, wasmDir, SHAPES } = await import(
  '../lib/next-codeframe-check.mjs'
)

if (!hasWasmBindings()) {
  console.log(`[codeframe] SKIP: no hay bindings wasm en ${wasmDir()}`)
  process.exit(0)
}

try {
  const { ok, failures } = await checkCodeFrames()
  if (ok) {
    console.log(`[codeframe] OK: ${SHAPES.length} formas renderizan con el binding wasm`)
    process.exit(0)
  }
  console.error(`[codeframe] FAIL: ${failures.length}/${SHAPES.length} formas no renderizan`)
  for (const failure of failures) console.error(`  - ${failure}`)
  console.error('  El parche de Next (R-#302) no está aplicado o cambió el binding wasm:')
  console.error('  cd apps/web && pnpm install    # y `pnpm patch next@<versión>` si hay que regenerarlo')
  process.exit(1)
} catch (error) {
  console.error(`[codeframe] FAIL: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
