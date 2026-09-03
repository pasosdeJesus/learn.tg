#!/usr/bin/env node
/**
 * Warmup para el sitio de desarrollo (https://learn.tg:9001).
 *
 * Tras un deploy, Next.js compila rutas bajo demanda y el primer request es
 * lentísimo. Este script toca las páginas y APIs clave:
 *   pasada 1 = compila en SECUENCIAL (el paralelismo en frío satura el dev
 *              server y provoca timeouts), timeout generoso por ruta.
 *   pasada 2 = verifica tiempos en paralelo (caché ya caliente).
 *
 * Uso:
 *   bin/warmup            # SITE_URL por defecto (learn.tg:9001)
 *   SITE_URL=https://learn.tg bin/warmup
 */

import https from 'https'

const SITE = process.env.SITE_URL || 'https://learn.tg:9001'
const agent = new https.Agent({ rejectUnauthorized: false })

// Rutas clave: páginas (compilan server components + client chunks) y APIs.
const URLS = [
  // Páginas
  '/en',
  '/es',
  '/en/gdcluster',
  '/en/gdcluster/ranking',
  '/en/a-relationship-with-Jesus',
  '/en/web3-and-ubi',
  '/en/user-transactions/191',
  // Páginas que tocan los specs E2E (guías, clúster, redgd, referidos)
  '/en/web3-and-ubi/guide3',
  '/en/redgd',
  '/en/cluster/1',
  '/en/referrals',
  '/ref/5F75CC53',
  // APIs de guías/cursos (compilan el route handler en la primera visita)
  '/api/guide?courseId=103&lang=en&prefix=web3-and-ubi&guide=guide3&guideNumber=3',
  '/api/gdcluster/donations/history',
  '/api/gdcluster/donations/verify',
  // Campañas (REQ/223): página de donación Lensenia + balance multi-cadena + verify
  '/en/donations/lensenia',
  '/es/donations/lensenia',
  '/api/donations/lensenia/balance',
  '/api/donations/lensenia/verify',
  '/api/churches/search?q=a',
  '/api/profile',
  '/api/claim-celo-ubi',
  '/api/add-donation',
  '/api/courses/premium/purchase',
  '/api/user-transactions/191',
  '/api/self-verify',
  // APIs
  '/api/gdcluster/ranking/funds',
  '/api/gdcluster/ranking/clusters',
  '/api/gdcluster/ranking/countries',
  '/api/churches/fund',
  '/api/referrals/fund',
  '/api/courses/premium/price?courseId=10',
  '/api/scholarship?courseId=1',
  '/api/transparency',
  '/api/courses/premium/mine',
  '/api/courses/10/access',
  '/api/auth/csrf',
  '/api/auth/providers',
  // Referidos (https://github.com/pasosdeJesus/learn.tg/issues/163) — rutas de los specs E2E de desembolso:
  // referral-payout (Form 2, crucigrama misional) y referral-premium (Form 1+3)
  '/en/ref/5F75CC53',
  '/api/referral/code',
  '/api/referral/stats',
  '/api/referral/history',
  '/api/referral/share',
  '/api/referral/claim',
  '/api/referral/lookup?code=5F75CC53',
  '/api/check-crossword',
  '/api/crossword?lang=en&prefix=a-relationship-with-Jesus&guide=guide1',
  '/api/guide?lang=en&prefix=a-relationship-with-Jesus&guide=guide1',
  '/api/guide-status?courseId=2&guideNumber=1',
  '/api/auth/callback/credentials',
  '/api/admin/check-verifier',
  '/api/admin/user/191',
  '/api/admin/churches',
]

function fetchOnce(url, timeoutMs) {
  return new Promise((resolve) => {
    const t0 = Date.now()
    const req = https.get(SITE + url, { agent, timeout: timeoutMs }, (res) => {
      let size = 0
      res.on('data', (chunk) => { size += chunk.length })
      res.on('end', () => resolve({ url, status: res.statusCode, ms: Date.now() - t0, size }))
    })
    req.on('timeout', () => { req.destroy(); resolve({ url, status: 0, ms: Date.now() - t0, size: 0, err: 'timeout' }) })
    req.on('error', (e) => resolve({ url, status: 0, ms: Date.now() - t0, size: 0, err: e.message }))
  })
}

async function pass(label, sequential, timeoutMs) {
  const results = []
  if (sequential) {
    for (const url of URLS) {
      const r = await fetchOnce(url, timeoutMs)
      results.push(r)
      const mark = r.err ? 'ERR' : (r.status >= 200 && r.status < 500 ? 'OK ' : '?? ')
      console.log(`  ${mark} ${String(r.status).padStart(3)} ${String(r.ms).padStart(7)}ms  ${r.url}${r.err ? '  (' + r.err + ')' : ''}`)
    }
  } else {
    results.push(...await Promise.all(URLS.map(url => fetchOnce(url, timeoutMs))))
    for (const r of results) {
      const mark = r.err ? 'ERR' : (r.status >= 200 && r.status < 500 ? 'OK ' : '?? ')
      console.log(`  ${mark} ${String(r.status).padStart(3)} ${String(r.ms).padStart(7)}ms  ${r.url}${r.err ? '  (' + r.err + ')' : ''}`)
    }
  }
  const slow = results.filter(r => r.ms > 15000)
  if (slow.length) console.log(`  [!] ${slow.length} rutas aún lentas (>15s): ${slow.map(r => r.url).join(', ')}`)
  return results
}

async function main() {
  console.log(`Warmup ${SITE} — ${URLS.length} rutas`)
  console.log(`\n── Pasada 1 (compila, secuencial) ──`)
  await pass('compile', true, 300000)
  console.log(`\n── Pasada 2 (verifica, paralela) ──`)
  await pass('verify', false, 20000)
  console.log('\nWarmup completo')
}

main().catch((e) => { console.error(e); process.exit(1) })
