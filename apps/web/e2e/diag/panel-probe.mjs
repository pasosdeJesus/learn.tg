import * as fs from 'node:fs'
import nodePath from 'node:path'
import { initTestEnv, launchBrowser, newPage, resolveSiteTarget } from '@pasosdejesus/m/e2e'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'
function credsFromEnv() {
  for (const p of [nodePath.join(process.cwd(), '..', '.env'), nodePath.join(process.cwd(), 'apps', '.env'), nodePath.join(process.cwd(), '.env')]) {
    if (!fs.existsSync(p)) continue
    const c = fs.readFileSync(p, 'utf8')
    const pk = c.match(/PRIVATE_KEY="([^"]+)"/)?.[1] || c.match(/PRIVATE_KEY=(\S+)/)?.[1]
    const addr = c.match(/NEXT_PUBLIC_ADDRESS="([^"]+)"/)?.[1] || c.match(/NEXT_PUBLIC_ADDRESS=(\S+)/)?.[1]
    if (pk && addr) return { pk, addr }
  }
  return null
}
if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'
const creds = credsFromEnv()
const env = await initTestEnv()
const { base } = resolveSiteTarget(env)
const browser = await launchBrowser(env.headless)
const page = await newPage(browser, creds.addr, env.timeout)
await setupE2EAuth(page, creds.addr, creds.pk, process.env.CHAIN_ID, base)
const api = (path, init = {}) => page.evaluate(async (a) => {
  const r = await fetch(a.path, { ...a.init, headers: { 'Content-Type': 'application/json', ...(a.init?.headers || {}) } })
  let b = null; try { b = await r.json() } catch {}
  return { status: r.status, body: b }
}, { path, init })
const w = creds.addr
const status = await api(`/api/cluster/status?walletAddress=${w}`)
const clusterId = process.argv[2] ? Number(process.argv[2]) : status.body?.clusterId
console.log('cluster', clusterId, status.body?.cluster?.status)
console.log('cluster', clusterId)
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })
page.on('response', async (r) => {
  if (r.url().includes('/gd-presentation')) {
    console.log('response', r.status(), r.url().slice(0, 80))
  }
})
await page.goto(`${base}/en/cluster/${clusterId}`, { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 12000))
const info = await page.evaluate(() => ({
  hasBudget: document.body.innerText.includes('First-year budget'),
  hasApprovals: document.body.innerText.includes('Pastors approval'),
  numbers: document.querySelectorAll('input[type=number]').length,
  missingBlock: document.body.innerText.includes('Before requesting the presentation'),
  connectionError: document.body.innerText.includes('Connection Error'),
  text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 300),
}))
console.log(JSON.stringify(info, null, 1))
console.log('errors', errors.slice(0, 5))
const pres = await api(`/api/cluster/${clusterId}/gd-presentation?walletAddress=${w}`)
console.log('API gd-presentation', pres.status, { isInitiator: pres.body?.isInitiator, isMember: pres.body?.isMember })
await browser.close()
