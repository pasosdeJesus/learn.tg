#!/usr/bin/env node
// Calentamiento LOCAL del servidor de desarrollo (http). A diferencia de
// bin/warmup.mjs (pensado para el dev site remoto) aquí se pide una lista corta
// y se hace TODO secuencial con timeout largo: en esta VM (1 CPU, límite de
// datos del chroot) compilar 55 rutas en paralelo mata al `next dev` con
// "Fatal error ... Check failed: (result.ptr) != nullptr" (2026-09-20).
//
// Uso: SITE_URL=http://localhost:4000 bin/warmup-local.mjs [filtro]

const SITE = process.env.SITE_URL || 'http://localhost:4000'
const FILTER = process.argv[2] || ''
const TIMEOUT_MS = Number(process.env.WARMUP_TIMEOUT_MS || 180000)

const URLS = [
  '/en',
  '/es',
  '/en/test/wallet',
  '/en/donations/lensenia',
  '/en/gdcluster',
  '/en/redgd',
  '/en/web3-and-ubi/guide3',
  '/en/referrals',
  '/api/auth/csrf',
  '/api/auth/providers',
  '/api/churches/fund',
  '/api/profile',
  '/api/courses/10/access',
  '/api/courses/premium/price?courseId=10',
  '/api/courses/premium/mine',
  '/api/admin/check-verifier',
  '/api/admin/user/191',
  '/api/admin/churches',
  '/api/course-catalog',
  '/api/donations/lensenia/balance',
  '/api/donations/lensenia/verify',
  '/api/guide?lang=en&prefix=a-relationship-with-Jesus&guide=guide1',
  '/api/gdcluster/donations/history',
  '/api/user-transactions/191',
].filter((u) => u.includes(FILTER))

async function once(url) {
  const t0 = Date.now()
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    const res = await fetch(SITE + url, { signal: ctrl.signal })
    const body = await res.text()
    clearTimeout(timer)
    return { url, status: res.status, ms: Date.now() - t0, size: body.length }
  } catch (e) {
    return { url, status: 0, ms: Date.now() - t0, err: e.message }
  }
}

console.log(`Calentamiento local ${SITE} — ${URLS.length} rutas (secuencial, ${TIMEOUT_MS}ms)`)
let errs = 0
for (const url of URLS) {
  const r = await once(url)
  if (r.err) errs += 1
  const mark = r.err ? 'ERR' : r.status < 400 ? 'OK ' : '?? '
  console.log(`  ${mark} ${String(r.status).padStart(3)} ${String(r.ms).padStart(7)}ms ${url}${r.err ? `  (${r.err})` : ''}`)
}
console.log(`\nFin: ${errs} ruta(s) con error`)
