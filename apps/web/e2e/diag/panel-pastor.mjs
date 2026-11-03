import { initTestEnv, launchBrowser, newPage, resolveSiteTarget } from '@pasosdejesus/m/e2e'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'
import { loadSelectedWallet } from '../helpers/e2e-wallet.mjs'
import { apiOn } from '../helpers/e2e-fixture.mjs'
if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'
const creds = loadSelectedWallet()
const env = await initTestEnv()
const { base } = resolveSiteTarget(env)
const browser = await launchBrowser(env.headless)
const page = await newPage(browser, creds.address, env.timeout)
await setupE2EAuth(page, creds.address, creds.pk, process.env.CHAIN_ID, base)
const pres = await apiOn(page, `/api/cluster/57/gd-presentation?walletAddress=${creds.address}`)
console.log('presentation', pres.status, JSON.stringify({ missing: pres.body?.missing, missing_data: pres.body?.missing_data, wallet: pres.body?.wallet, isInitiator: pres.body?.isInitiator }))
await page.goto(`${base}/en/cluster/57`, { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 12000))
const info = await page.evaluate(() => {
  const t = document.body.innerText.replace(/\s+/g, ' ')
  const idx = t.indexOf('First-year budget')
  return {
    numbers: document.querySelectorAll('input[type="number"]').length,
    hasBlock: t.includes('Before requesting the presentation'),
    around: idx >= 0 ? t.slice(idx - 260, idx + 260) : t.slice(0, 300),
  }
})
console.log(JSON.stringify(info, null, 1))
await browser.close()
