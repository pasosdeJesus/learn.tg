// Helper compartido de retry para specs E2E (https://gitlab.com/pasosdeJesus/m/-/work_items/35 §12.8).
// El dev site (16G compartido, prod+dev) limita por wallet/IP (429) y bajo
// carga los specs de timing flaquean; reintentar con espera los estabiliza.

/**
 * Reintenta `fn` hasta `retries` veces con `delayMs` de espera entre intentos.
 * Loguea el error de cada intento (causa + mensaje truncado).
 */
export async function retry(fn, { retries = 3, delayMs = 10000, label = '' } = {}) {
  for (let i = 1; ; i++) {
    try {
      return await fn()
    } catch (e) {
      if (i > retries) throw e
      const msg = e?.shortMessage || e?.message || String(e)
      console.log(`  [retry:${label}] intento ${i}/${retries} falló (${msg.slice(0, 100)}) — reintento en ${delayMs / 1000}s`)
      await new Promise(r => setTimeout(r, delayMs))
    }
  }
}

/**
 * Re-ejecuta `run` (cuerpo completo del spec) hasta `attempts` veces si falla,
 * con `delayMs` de espera. SOLO usar en specs seguros de re-correr (billetera
 * fresca por intento o diagnóstico sin gasto on-chain): re-correr un flujo con
 * transacción real duplicaría el gasto.
 */
export async function retrySpec(run, { attempts = 2, delayMs = 20000, label = 'spec' } = {}) {
  for (let i = 1; ; i++) {
    try {
      return await run()
    } catch (e) {
      if (i >= attempts) throw e
      const msg = e?.shortMessage || e?.message || String(e)
      console.log(`  [retrySpec:${label}] intento ${i}/${attempts} falló (${msg.slice(0, 100)}) — reintento en ${delayMs / 1000}s`)
      await new Promise(r => setTimeout(r, delayMs))
    }
  }
}
