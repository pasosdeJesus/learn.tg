#!/usr/bin/env node
// E2E: el service worker sirve un shell VIEJO de la lista de cursos.
//
// Síntoma del operador (2026-10-01): al abrir `/en` en una pestaña nueva la página
// dice "This page couldn't load" (consola: ChunkLoadError al cargar
// `2233-cdb765b3bf2bb74f.js`, 404 con MIME text/plain — un chunk que el deploy ya
// había removido); con Reload funciona, y al conectar una billetera externa suele
// quedarse en "Loading..." (el HTML SSR ya dice "Loading..." y, sin hidratar,
// se queda así).
//
// Causa: `next.config.ts` precachea `/en` y `/es` como entradas SIN revisión
// (`additionalManifestEntries`), y Workbox sirve el precache **cache-first**: el
// shell del build anterior sobrevive al deploy y referencia chunks que ya no
// existen.
//
// El spec reproduce la causa (un shell precacheado se sirve tal cual) y el síntoma
// (al shell le falta un chunk → ChunkLoadError y la página queda en el "Loading..."
// del SSR). Falla mientras la causa siga viva; pasa cuando los shells se
// revalidan (o cuando la app se recupera de un ChunkLoadError).
//
// Ejecución:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 CHAIN_ID=11142220 \
//     bin/m test:e2e sw-stale-shell

import { fail, gotoWithRetry, initTestEnv, launchBrowser, ok, resetFailures, resolveSiteTarget, summary } from '@pasosdejesus/m/e2e'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const MARKER = 'STALE-SHELL-MARKER'
const DEAD_CHUNK = 'page-0000000000000000.js'

async function clearCaches(page) {
  await page.evaluate(async () => {
    const names = await caches.keys()
    await Promise.all(names.map((n) => caches.delete(n)))
  }).catch(() => {})
}

async function main() {
  const t0 = performance.now()
  resetFailures()
  const env = await initTestEnv()
  const { base } = resolveSiteTarget(env)

  console.log(`Sitio: ${base}\n`)

  // ── Todos los chunks que el HTML de /en referencia existen ──
  const html = await (await fetch(`${base}/en`, { cache: 'no-store' })).text()
  const chunks = [...new Set((html.match(/\/_next\/static\/chunks\/[^"'\\ ]+\.js/g) || []))]
  const missing = []
  for (const c of chunks) {
    const res = await fetch(`${base}${c}`, { cache: 'no-store' }).catch(() => null)
    if (!res || !res.ok) missing.push(`${c} → ${res ? res.status : 'sin respuesta'}`)
  }
  if (chunks.length === 0) {
    fail('el HTML de /en no referencia ningún chunk (¿cambió el layout?)')
  } else if (missing.length > 0) {
    fail(`el HTML de /en referencia ${missing.length} chunk(s) que el servidor no tiene (esto es el trigger del bug): ${missing.slice(0, 3).join(', ')}`)
  } else {
    ok(`los ${chunks.length} chunks que referencia /en existen (200)`)
  }

  const browser = await launchBrowser()

  // ── Control: una carga limpia instala el SW y no tiene ChunkLoadError ──
  const page = await browser.newPage()
  const errs = []
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)) })
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message.slice(0, 200)}`))
  await gotoWithRetry(page, `${base}/en`, { waitUntil: 'domcontentloaded', timeout: env.timeout })
  await page.evaluate(() => navigator.serviceWorker.ready).catch(() => {})
  await sleep(2500)
  if (errs.some((e) => /ChunkLoadError|Loading chunk/i.test(e))) {
    fail(`una carga limpia de /en ya trae un ChunkLoadError: ${errs[0]}`)
  } else {
    ok('carga limpia de /en sin ChunkLoadError (control)')
  }

  // La causa es el PRECACHE de Workbox (`workbox-precache-*`), no la caché runtime
  // `learntg-pages` (NetworkFirst, que sí revalida). Buscamos `/en` solo ahí.
  const precache = await page.evaluate(async () => {
    const names = await caches.keys()
    for (const n of names) {
      if (!n.startsWith('workbox-precache')) continue
      const c = await caches.open(n)
      const keys = await c.keys()
      if (keys.some((k) => new URL(k.url).pathname === '/en')) return n
    }
    return null
  })

  if (!precache) {
    ok('/en ya no se precachea: el shell se sirve por NetworkFirst y revalida (fix de R-#272 §10)')
  } else {
    ok(`/en sigue precacheado en ${precache} (causa viva)`)

    // ── Reproducción: shell precacheado que apunta a un chunk inexistente ──
    // Se toma el HTML real y se cambia el nombre del chunk de la página por uno que
    // no existe (como el `2233-…js` que el deploy removió), más un marcador para
    // saber si el SW sirvió nuestra copia.
    const stale = html
      .replace(/page-[0-9a-f]+\.js/g, DEAD_CHUNK)
      .replace('</body>', `<div id="stale-marker">${MARKER}</div></body>`)
    if (!stale.includes(DEAD_CHUNK)) fail('no se pudo fabricar el shell viejo (no se encontró un chunk "page-*.js")')

    await page.evaluate(async ({ staleHtml }) => {
      const names = await caches.keys()
      for (const n of names) {
        if (!n.startsWith('workbox-precache')) continue
        const c = await caches.open(n)
        const keys = await c.keys()
        if (keys.some((k) => new URL(k.url).pathname === '/en')) {
          await c.put('/en', new Response(staleHtml, { headers: { 'Content-Type': 'text/html' } }))
        }
      }
    }, { staleHtml: stale })

    const page2 = await browser.newPage()
    const errs2 = []
    page2.on('console', (m) => { if (m.type() === 'error') errs2.push(m.text().slice(0, 200)) })
    page2.on('pageerror', (e) => errs2.push(`pageerror: ${e.message.slice(0, 200)}`))
    await page2.goto(`${base}/en`, { waitUntil: 'domcontentloaded', timeout: env.timeout }).catch(() => {})
    await sleep(3000)
    const servedStale = await page2.evaluate((m) => (document.documentElement?.outerHTML || '').includes(m), MARKER)
    const body2 = await page2.evaluate(() => (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 160))
    const chunkErr = errs2.find((e) => /ChunkLoadError|Loading chunk/i.test(e))
    const stuckLoading = /Loading\.\.\./.test(body2)
    await page2.close()

    // Todos los chunks reales existen (arriba), así que un ChunkLoadError solo puede
    // venir del shell precacheado que apunta al chunk ausente que inyectamos.
    if (chunkErr) {
      fail(`el shell precacheado se sirvió y su chunk ausente rompió la carga → ${chunkErr} (el "This page couldn't load" del operador)`)
    } else if (servedStale) {
      fail('el service worker sirvió el shell precacheado de /en SIN revalidar contra la red: causa del "This page couldn\'t load" tras un deploy')
    } else {
      ok('una pestaña nueva revalidó /en contra la red (no sirvió el shell precacheado)')
    }

    if (stuckLoading) {
      ok('sin hidratar, la página queda en el "Loading..." del SSR (segundo síntoma reproducido)')
    }
  }

  await clearCaches(page)
  await browser.close()
  const failures = summary(t0)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
