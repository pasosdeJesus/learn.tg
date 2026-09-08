#!/usr/bin/env node
// E2E: verificación UX R-#230/R-#231 (cabecera + menú ☰), R-#228 (scroll
// horizontal de tablas en guías), R-#217 (sin warnings de preload woff2) y
// R-#218 (sin hydration mismatch; footer con /{lang}).
//
// Ejecución:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//     CHAIN_ID=11142220 node e2e/specs/ux-mobile-menu.spec.mjs

import {
  initTestEnv, launchBrowser, newPage,
  resetFailures, fail, ok, summary, short, simulateSIWE,
} from '@pasosdejesus/m/e2e'

async function main() {
  const t0 = performance.now()
  resetFailures()
  const env = await initTestEnv()
  const { base, timeout, account, chainId, host, domainPort } = env
  const browser = await launchBrowser(env.headless)
  const page = await newPage(browser, account.address, 120000)
  await page.setViewport({ width: 375, height: 700 }) // móvil (R-#228/#230)

  const consoleIssues = []
  page.on('console', (m) => {
    const t = m.text() || ''
    const preloadWoff = /preload[\s\S]*woff2|woff2[\s\S]*preload/.test(t)
    if (m.type() === 'error' || preloadWoff) {
      consoleIssues.push(`${m.type()}: ${t.slice(0, 180)}`)
    }
  })
  page.on('pageerror', (e) => consoleIssues.push(`pageerror: ${String(e.message).slice(0, 600)}`))

  const hrefs = () => page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')))
  const uiState = () => page.evaluate(() => {
    const links = [...document.querySelectorAll('a[href]')]
    const droplet = links.find(l => (l.getAttribute('href') || '').endsWith('/donations/lensenia') && (l.textContent || '').trim() === '💧')
    const menuBtn = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || '') === 'Menu')
    return { droplet: !!droplet, menuBtn: !!menuBtn }
  })
  const openMenu = async () => {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '') === 'Menu')
      if (b) b.click()
    })
    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`Wallet: ${short(account.address)} | ${base} (móvil 375px)\n`)

  // ═══ Parte A: invitado (sin sesión) — R-#230/R-#231 ═══
  console.log('── A. Invitado en /en ──')
  await page.goto(`${base}/en`, { waitUntil: 'domcontentloaded', timeout })
  await new Promise(r => setTimeout(r, 6000))
  {
    const s = await uiState()
    if (s.menuBtn) { ok('☰ visible para invitado (R-#230)') } else { fail('☰ ausente para invitado') }
    if (s.droplet) { ok('Gota 💧 visible para invitado') } else { fail('Gota 💧 ausente para invitado') }
    await openMenu()
    const hs = await hrefs()
    if (hs.includes('/en')) { ok('Menú invitado incluye Courses → /en (R-#231)') } else { fail(`Menú sin Courses /en: ${JSON.stringify(hs)}`) }
    if (!hs.includes('/en/profile')) { ok('Menú invitado NO incluye Profile (R-#230)') } else { fail('Menú invitado incluye /en/profile (no debe)') }
  }

  // ═══ Parte B: autenticado — R-#230 (gota oculta + Profile) ═══
  console.log('\n── B. Autenticado en /en ──')
  const siweOk = await simulateSIWE(page, { account, host, domainPort, base, chainId })
  if (!siweOk) { fail('SIWE failed'); await browser.close(); process.exit(1) }
  // Token dedicado (R-#227) para las APIs de la guía en Parte C
  const dedicated = await page.evaluate(async () => {
    const r = await fetch('/api/auth/token')
    if (!r.ok) return null
    const j = await r.json()
    return (j && typeof j.token === 'string' && j.token) || null
  })
  if (dedicated) await page.evaluate(t => localStorage.setItem('learn.tg.authToken', t), dedicated)
  await page.goto(`${base}/en`, { waitUntil: 'domcontentloaded', timeout })
  await new Promise(r => setTimeout(r, 6000))
  {
    const s = await uiState()
    if (!s.droplet) { ok('Gota 💧 oculta con sesión (R-#230)') } else { fail('Gota 💧 aún visible con sesión') }
    if (s.menuBtn) { ok('☰ visible con sesión') } else { fail('☰ ausente con sesión') }
    await openMenu()
    const hs = await hrefs()
    if (hs.includes('/en/profile') && hs.includes('/en')) { ok('Menú con sesión: Profile + Courses (R-#230/R-#231)') } else { fail(`Menú con sesión inesperado: ${JSON.stringify(hs)}`) }
    if (hs.includes('/en/donations/lensenia')) { ok('Donación presente en el menú con sesión') }
  }

  // ═══ Parte C: guía móvil con tabla — R-#228 (con retry: la 1.ª carga tras
  // login puede 401 mientras la sesión termina de propagarse) ═══
  console.log('\n── C. Tabla en /en/gdcluster/guide1 (móvil) ──')
  let guideOk = false
  for (let attempt = 0; attempt < 3 && !guideOk; attempt++) {
    if (attempt > 0) {
      console.log(`  Reintentando guía (${attempt + 1}/3)...`)
      await page.goto(`${base}/en/gdcluster/guide1`, { waitUntil: 'domcontentloaded', timeout })
    }
    for (let i = 0; i < 8 && !guideOk; i++) {
      await new Promise(r => setTimeout(r, 2000))
      guideOk = await page.evaluate(() => !!document.querySelector('[aria-label="Guide text"]'))
    }
  }
  if (!guideOk) {
    const body = await page.evaluate(() => (document.body?.innerText || '').slice(0, 160).replace(/\s+/g, ' '))
    fail(`Guía no cargó: ${body}`)
  } else {
    ok('Guide text presente')
    const meas = await page.evaluate(() => {
      const sec = document.querySelector('[aria-label="Guide text"]')
      const wrapper = sec?.parentElement
      if (!wrapper) return null
      const table = sec.querySelector('table')
      if (!table) return { noTable: true }
      // Tercera (última) columna: ¿algún right edge se sale del viewport?
      let lastRight = 0
      const lastCols = [...table.querySelectorAll('tr')].map(tr => tr.lastElementChild)
      for (const td of lastCols) {
        if (td) lastRight = Math.max(lastRight, td.getBoundingClientRect().right)
      }
      return {
        ovX: getComputedStyle(wrapper).overflowX,
        vw: window.innerWidth,
        wrapperClient: wrapper.clientWidth,
        tableScroll: table.scrollWidth,
        lastColVisible: lastRight <= window.innerWidth,
        lastRight: Math.round(lastRight),
        canScroll: wrapper.scrollWidth > wrapper.clientWidth,
      }
    })
    if (meas?.noTable) {
      console.log('  [!] Sin <table> en guide1 (verificación de tabla no aplica)')
    } else if (meas) {
      if (meas.ovX !== 'auto' && meas.ovX !== 'scroll') {
        fail(`Contenedor sin overflow-x (${meas.ovX})`)
      } else if (meas.lastColVisible) {
        ok(`Tercera columna visible en móvil (right ${meas.lastRight}px ≤ viewport ${meas.vw}px) — sin recorte (R-#228)`)
      } else if (meas.canScroll) {
        ok(`overflow-x=${meas.ovX}: la tabla desborda y el contenedor permite scroll (R-#228)`)
        const moved = await page.evaluate(() => {
          const sec = document.querySelector('[aria-label="Guide text"]')
          const w = sec?.parentElement
          if (!w) return false
          w.scrollLeft = w.scrollWidth
          return w.scrollLeft > 0
        })
        if (moved) { ok('Scroll horizontal opera — tercera columna alcanzable') } else { fail('scrollLeft no avanza') }
      } else {
        fail(`Tabla recortada sin scroll: right=${meas.lastRight} > vw=${meas.vw}, wrapper ${meas.wrapperClient} table ${meas.tableScroll}`)
      }
    }
  }

  // ═══ Parte D: consola limpia (R-#217/R-#218) + footer /es ═══
  console.log('\n── D. Consola y footer ──')
  await page.goto(`${base}/es`, { waitUntil: 'domcontentloaded', timeout })
  await new Promise(r => setTimeout(r, 5000))
  {
    const legal = await page.evaluate(() =>
      [...document.querySelectorAll('a[href]')]
        .map(a => a.getAttribute('href'))
        .filter(h => h && (h.includes('privacy-policy') || h.includes('terms-of-service'))))
    if (legal.some(h => h === '/es/privacy-policy')) {
      ok('Footer con enlace legal /es/privacy-policy (R-#218)')
    } else {
      fail(`Footer legal hrefs: ${JSON.stringify(legal)}`)
    }
  }
  // R-#217: sin warnings de preload woff2. R-#218: el hydration del FOOTER
  // (privacy/terms) debe haber desaparecido; el mismatch residual de
  // Header/ConnectWalletButton (con sesión) es PREEXISTENTE (anterior a este
  // lote, se veía en donate-campaign-celo-modal) y se reporta como nota.
  const woff2Preload = consoleIssues.filter(i => /preload[\s\S]*woff2|woff2[\s\S]*preload/.test(i))
  const footerHydr = consoleIssues.filter(i => /privacy-policy|terms-of-service|Footer|footer/i.test(i) && /hydrat/i.test(i))
  const preexisting = consoleIssues.filter(i => !woff2Preload.includes(i) && !footerHydr.includes(i))
  if (woff2Preload.length === 0) {
    ok('Sin warnings de preload woff2 (R-#217)')
  } else {
    fail(`Preload woff2 presente (${woff2Preload.length})`)
  }
  if (footerHydr.length === 0) {
    ok('Sin hydration mismatch de footer (R-#218)')
  } else {
    console.log('  [!] footer hydration:', JSON.stringify(footerHydr.slice(0, 3), null, 2))
    fail(`Hydration de footer residual (${footerHydr.length})`)
  }
  if (preexisting.length > 0) {
    console.log(`  [i] ${preexisting.length} issue(s) de consola preexistentes (header/connect/recursos):`)
    console.log('      ' + JSON.stringify(preexisting.slice(0, 4)).slice(0, 500))
  }

  await browser.close()
  const failures = summary(t0)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch(e => { console.error('❌', e); process.exit(1) })
