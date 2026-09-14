#!/usr/bin/env node
// E2E: billetera NUEVA conectada por primera vez — la tarjeta del curso aparece
// en "cooldown" y sin avance; al reconectar se ve normal (reporte de alumnos).
//
// Reproducción en dos fases con una billetera nueva (SIWE):
//   A) CONTROL: token dedicado recién obtenido (equivalente a "tras reconectar")
//      → la tarjeta muestra el estado real de la beca.
//   B) REPRO: misma sesión válida pero token de API obsoleto/fallback (CSRF) —
//      lo que deja el PRIMER login cuando `GET /api/auth/token` falla y
//      `ConnectWalletButton` guarda el CSRF como respaldo legacy.
//
// El spec FALLA mientras el bug exista y PASA cuando el primer login (o la
// página) tolera el token obsoleto: sin "cooldown" falso y con el avance real.
//
// Nota de red: el frontend de producción pide la lista de cursos a
// `https://learn.tg:3250/learntg-admin/proyectosfinancieros.json`, puerto que no
// es alcanzable desde la VM de CI/desarrollo (el :3500 sí). Con
// `MOCK_COURSE_LIST=1` el spec obtiene el JSON real por :3500
// (`COURSE_LIST_SOURCE_URL`) y responde con él a las peticiones a
// `proyectosfinancieros.json`, para que la página renderice las tarjetas. En
// dev (lista alcanzable) no se activa.
//
// Ejecución:
//   # dev
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 CHAIN_ID=11142220 \
//     bin/m test:e2e fresh-wallet-first-connect
//   # producción (desde una red sin :3250)
//   MOCK_COURSE_LIST=1 CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg \
//     PUERTOPRU=443 CHAIN_ID=42220 SITE_URL=https://learn.tg bin/m test:e2e fresh-wallet-first-connect

import {
  initTestEnv, launchBrowser,
  resetFailures, fail, ok, summary,
} from '@pasosdejesus/m/e2e'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'
import { gotoWithRetry, retry } from '../helpers/retry.mjs'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11142220', 10)

const COOLDOWN_RE = /cooldown period|etapa de enfriamiento/i
const REAL_STATE_RE = /profile score to be eligible|You are eligible|puntos de perfil|Eres elegible/i
const SCHOLARSHIP_RE = /Scholarship of|Beca de/i
const RELATIONSHIP_RE = /relationship with Jesus|relación con Jesús/i

function attachProbe(page, base) {
  const calls = []
  const other = []
  page.on('response', async (res) => {
    const url = res.url()
    if (/proyectosfinancieros|learntg-admin/.test(url)) other.push(`${res.status()} ${url.replace(base, '').slice(0, 130)}`)
    if (!url.includes('/api/scholarship')) return
    let body = null
    try { body = await res.clone().json() } catch { body = null }
    const q = new URL(url).searchParams
    calls.push({
      courseId: q.get('courseId'),
      walletInQuery: q.get('walletAddress'),
      token: (q.get('token') || '').slice(0, 8),
      status: res.status(),
      canSubmit: body?.canSubmit,
      percentageCompleted: body?.percentageCompleted,
      profileScore: body?.profileScore,
    })
  })
  return { calls, other }
}

async function snapshot(page) {
  return page.evaluate((src) => {
    const rx = new RegExp(src, 'i')
    const nodes = [...document.querySelectorAll('a,div,li,article')]
    const node = nodes.find(n => rx.test(n.textContent || '') && /Scholarship of|Beca de/i.test(n.textContent || ''))
    return (node?.textContent || document.body?.textContent || '').replace(/\s+/g, ' ').trim()
  }, RELATIONSHIP_RE.source)
}

async function main() {
  const t0 = performance.now()
  resetFailures()
  const env = await initTestEnv()
  const { base, timeout } = env

  // Datos reales de la lista de cursos para el mock (puerto :3250 inalcanzable)
  const mockList = process.env.MOCK_COURSE_LIST === '1'
  let courseListJson = '[]'
  if (mockList) {
    const src = process.env.COURSE_LIST_SOURCE_URL ||
      'https://learn.tg:3500/learntg-admin/proyectosfinancieros.json?filtro[busidioma]=en'
    try {
      const r = await fetch(src, { signal: AbortSignal.timeout(20000) })
      courseListJson = JSON.stringify(await r.json())
      console.log(`MOCK_COURSE_LIST=1: lista de cursos desde ${src.replace(/\?.*/, '')} (${courseListJson.length} bytes)`)
    } catch (e) {
      console.log(`[!] no se pudo obtener la lista de cursos (${e.message}) — puede que no se rendericen tarjetas`)
    }
  }

  const pk = generatePrivateKey()
  const account = privateKeyToAccount(pk)
  console.log(`Billetera NUEVA: ${account.address} | ${base} (chain ${CHAIN_ID})\n`)

  const browser = await launchBrowser()
  let page = await browser.newPage()
  page.on('pageerror', (e) => console.log(`  [PAGEERR] ${e.message}`))

  page = await retry(async () => {
    const p = await browser.newPage()
    p.on('pageerror', (e) => console.log(`  [PAGEERR] ${e.message}`))
    await setupE2EAuth(p, account.address, pk, CHAIN_ID, base)
    return p
  }, { label: 'setupE2EAuth billetera nueva' })
  ok('billetera nueva autenticada (SIWE)')

  const { calls, other } = attachProbe(page, base)

  // Con MOCK_COURSE_LIST=1 sirve la lista real a las peticiones
  // `proyectosfinancieros.json` (en prod van a :3250, inalcanzable desde la VM)
  if (mockList) {
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      if (/proyectosfinancieros\.json/.test(req.url())) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': base, Vary: 'Origin' },
          body: courseListJson,
        })
      } else {
        req.continue()
      }
    })
  }

  const loadAndSnapshot = async (label) => {
    await gotoWithRetry(page, `${base}/en`, { waitUntil: 'domcontentloaded', timeout })
    const from = calls.length
    const otherFrom = other.length
    let text = ''
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000))
      text = await snapshot(page)
      if (SCHOLARSHIP_RE.test(text) && calls.length > from) break
    }
    const rel = calls.slice(from)
    const anon = rel.filter(c => !c.walletInQuery)
    const scoped = rel.filter(c => c.walletInQuery)
    console.log(`\n── ${label} ──`)
    console.log(`  /api/scholarship: ${rel.length} llamada(s) — con wallet ${scoped.length}, ANÓNIMAS ${anon.length}`)
    for (const c of rel.slice(0, 6)) {
      console.log(`    courseId=${c.courseId} wallet=${c.walletInQuery ? c.walletInQuery.slice(0, 10) + '…' : '—(anónima)'} → ${c.status} canSubmit=${c.canSubmit} ${c.percentageCompleted}% profileScore=${c.profileScore}`)
    }
    if (rel.length === 0) {
      for (const o of [...new Set(other.slice(otherFrom))].slice(0, 6)) console.log(`    [req] ${o}`)
      console.log(`  cuerpo: ${text.slice(0, 220)}…`)
    }
    const cooldown = COOLDOWN_RE.test(text)
    const realState = REAL_STATE_RE.test(text)
    console.log(`  ¿cooldown?: ${cooldown ? 'SÍ' : 'no'} | ¿estado real?: ${realState ? 'sí' : 'no'}`)
    return { rel, anon, scoped, cooldown, realState, text }
  }

  const control = await loadAndSnapshot('Fase A — control (token dedicado recién obtenido)')

  const stalePrefix = await page.evaluate(async () => {
    const j = await (await fetch('/api/auth/csrf')).json()
    localStorage.setItem('learn.tg.authToken', j.csrfToken)
    return j.csrfToken.slice(0, 8)
  })
  console.log(`\n  token reemplazado por el CSRF legacy (${stalePrefix}…) — estado del primer login si /api/auth/token falló`)
  const repro = await loadAndSnapshot('Fase B — repro (token obsoleto, sesión válida)')

  await page.screenshot({ path: '/tmp/fresh-wallet-first-connect.png' }).catch(() => {})

  // ── Aserciones ──
  // Con una billetera conectada, la página NUNCA debe consultar el avance de
  // forma anónima (es la causa del estado "cooldown"/cero).
  if (control.rel.length === 0) {
    fail('la lista de cursos no consultó /api/scholarship para la billetera nueva (tarjeta sin avance/estado)')
  } else if (control.anon.length > 0 || repro.anon.length > 0) {
    fail(`la página consultó /api/scholarship SIN walletAddress (anónima): control=${control.anon.length}, repro=${repro.anon.length} → estado "cooldown"/cero en la tarjeta (bug del reporte)`)
  } else if (control.cooldown || repro.cooldown) {
    fail('la tarjeta muestra "cooldown" con una billetera nueva (canSubmit:false)')
  } else {
    ok('sin consultas anónimas ni cooldown falso: la página usa el address/token de la billetera conectada')
  }

  await browser.close()
  const failures = summary(t0)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
