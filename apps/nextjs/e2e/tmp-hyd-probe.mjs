// Probe: full React hydration diff (console args) on authed /en.
import { initTestEnv, launchBrowser, newPage, simulateSIWE, short } from '@pasosdejesus/m/e2e'

async function main() {
  const env = await initTestEnv()
  const { base, account, chainId, host, domainPort } = env
  const browser = await launchBrowser(env.headless)
  const page = await newPage(browser, account.address, 120000)
  console.log('wallet', short(account.address), base)
  page.on('console', async (m) => {
    if (m.type() !== 'error') return
    const t = m.text() || ''
    if (/hydrat/i.test(t) || /Warning|error/i.test(t)) {
      let extra = ''
      try {
        const vals = []
        for (const a of m.args.slice(1, 4)) {
          try { const v = await a.jsonValue(); vals.push(typeof v === 'string' ? v.slice(0, 1200) : JSON.stringify(v).slice(0, 1200)) } catch { vals.push('<unserializable>') }
        }
        extra = vals.join(' | ')
      } catch { }
      console.log('── [console.error] ──\n' + t.slice(0, 200).replace(/\n+/g, ' ') + '\n' + extra.slice(0, 2500) + '\n──────────────')
    }
  })
  await page.goto(`${base}/en`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await new Promise(r => setTimeout(r, 4000))
  const siweOk = await simulateSIWE(page, { account, host, domainPort, base, chainId })
  console.log('SIWE:', siweOk)
  await page.goto(`${base}/en`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await new Promise(r => setTimeout(r, 9000))
  await browser.close()
  process.exit(0)
}
main().catch(e => { console.error('❌', e); process.exit(1) })
