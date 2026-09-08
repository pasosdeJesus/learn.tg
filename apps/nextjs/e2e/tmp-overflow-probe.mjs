// Probe 2: guide1 con contenido asegurado, anchos 280-412 + capturas.
import { initTestEnv, launchBrowser, newPage, simulateSIWE, short } from '@pasosdejesus/m/e2e'
import fs from 'fs'

async function main() {
  const env = await initTestEnv()
  const { base, account, chainId, host, domainPort } = env
  const browser = await launchBrowser(env.headless)
  const page = await newPage(browser, account.address, 120000)
  console.log('wallet', short(account.address))
  await page.goto(`${base}/en`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await new Promise(r => setTimeout(r, 3000))
  await simulateSIWE(page, { account, host, domainPort, base, chainId })
  const d = await page.evaluate(async () => { const r = await fetch('/api/auth/token'); return (await r.json()).token || null })
  await page.evaluate(t => localStorage.setItem('learn.tg.authToken', t), d)

  let loaded = false
  for (let attempt = 0; attempt < 3 && !loaded; attempt++) {
    if (attempt > 0) await page.goto(`${base}/en/gdcluster/guide1`, { waitUntil: 'domcontentloaded', timeout: 120000 })
    for (let i = 0; i < 12 && !loaded; i++) {
      await new Promise(r => setTimeout(r, 2000))
      loaded = await page.evaluate(() => {
        const sec = document.querySelector('[aria-label="Guide text"]')
        return !!sec && !!sec.querySelector('table')
      })
    }
  }
  console.log('tabla presente:', loaded)
  if (!loaded) { process.exit(1) }

  for (const w of [412, 393, 375, 360, 320, 280]) {
    await page.setViewport({ width: w, height: 780 })
    await new Promise(r => setTimeout(r, 700))
    const m = await page.evaluate(() => {
      const sec = document.querySelector('[aria-label="Guide text"]')
      const wrapper = sec?.parentElement
      const table = sec?.querySelector('table')
      let lastRight = 0
      for (const td of [...(table?.querySelectorAll('tr') || [])].map(tr => tr.lastElementChild)) {
        if (td) lastRight = Math.max(lastRight, td.getBoundingClientRect().right)
      }
      const cs = sec ? getComputedStyle(sec) : null
      return {
        vw: window.innerWidth,
        docScroll: document.documentElement.scrollWidth,
        secPadL: cs?.paddingLeft, secPadR: cs?.paddingRight,
        wrapperOvX: wrapper ? getComputedStyle(wrapper).overflowX : null,
        tableRight: Math.round(lastRight),
        lastColVisible: lastRight <= window.innerWidth,
      }
    })
    console.log(`ancho ${w}:`, JSON.stringify(m))
  }
  // capturas
  for (const w of [393, 360]) {
    await page.setViewport({ width: w, height: 780 })
    await new Promise(r => setTimeout(r, 500))
    const shot = `/tmp/guide1-${w}.png`
    await page.screenshot({ path: shot, fullPage: false })
    console.log('captura:', shot)
  }
  await browser.close()
  process.exit(0)
}
main().catch(e => { console.error('❌', e); process.exit(1) })
