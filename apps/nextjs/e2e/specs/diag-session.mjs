// Quick diagnostic: check session state and profile data in browser
// CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 node e2e/specs/diag-session.mjs

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser,
  setupSIWEMock, short,
} from '@pasosdejesus/m/e2e'

function loadEnvCredentials() {
  const envPaths = [
    path.join(process.cwd(), '..', '.env'),
    path.join(process.cwd(), 'apps', '.env'),
    path.join(process.cwd(), '.env'),
  ]
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      const pk = content.match(/PRIVATE_KEY="([^"]+)"/)?.[1] || content.match(/PRIVATE_KEY=(\S+)/)?.[1]
      const addr = content.match(/NEXT_PUBLIC_ADDRESS="([^"]+)"/)?.[1] || content.match(/NEXT_PUBLIC_ADDRESS=(\S+)/)?.[1]
      if (pk && addr) return { pk, addr }
    }
  }
  return null
}

async function main() {
  const envCreds = loadEnvCredentials()
  if (!envCreds) { console.error('No credentials'); process.exit(1) }
  process.env.TEST_PRIVATE_KEY = envCreds.pk
  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { base, timeout, chainId } = env

  console.log(`Env creds addr: ${envCreds.addr}`)
  console.log(`initTestEnv addr: ${env.account.address}`)
  console.log(`Base: ${base}\n`)

  const browser = await launchBrowser(false) // headed for debugging
  const page = await browser.newPage()

  // Capture ALL console messages
  page.on('console', msg => {
    const t = msg.text()
    if (t.length < 300) console.log(`  [browser:${msg.type()}]`, t)
  })

  await setupSIWEMock(page, envCreds.addr, envCreds.pk, chainId)

  // Go to landing and connect
  console.log('1. Landing...')
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout })
  await new Promise(r => setTimeout(r, 5000))

  const connectBtn = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button')].find(b =>
      (b.textContent || '').includes('Connect') || (b.textContent || '').includes('Conectar'))
  )
  if (connectBtn.asElement()) {
    console.log('2. Clicking Connect...')
    await connectBtn.asElement().click()
  }

  // Wait for SIWE
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 3000))
    const connected = await page.evaluate(() =>
      !document.body.textContent?.includes('Connect Wallet'))
    if (connected) { console.log(`3. Connected after ${(i+1)*3}s`); break }
  }

  // Check session
  console.log('\n4. Session check:')
  const session = await page.evaluate(async () => {
    const r = await fetch('/api/auth/session')
    return await r.json()
  })
  console.log(JSON.stringify(session, null, 2))

  // Check profile API
  console.log('\n5. Profile API:')
  const profile = await page.evaluate(async () => {
    const r = await fetch('/api/profile')
    return await r.json()
  })
  console.log(`  uname: ${profile.uname}`)
  console.log(`  profilescore: ${profile.profilescore}`)
  console.log(`  name: ${profile.name}`)
  console.log(`  id: ${profile.id}`)

  // Check /en page
  console.log('\n6. /en page:')
  await page.goto(`${base}/en`, { waitUntil: 'domcontentloaded', timeout })
  await new Promise(r => setTimeout(r, 3000))
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('a[href]')]
      .filter(a => {
        const h = a.getAttribute('href') || ''
        return h.startsWith('/en/') && !h.includes('/profile') && !h.includes('/privacy')
      })
      .map(a => a.getAttribute('href'))
  )
  console.log(`  Course links: ${links.join(', ')}`)

  // Check UBI guide
  console.log('\n7. UBI guide:')
  await page.goto(`${base}/en/web3-and-ubi/guide3`, { waitUntil: 'domcontentloaded', timeout })
  await new Promise(r => setTimeout(r, 5000))
  const claimBtnText = await page.evaluate(() =>
    [...document.querySelectorAll('button')].map(b => b.textContent?.trim().slice(0, 60)).join(' | '))
  console.log(`  Buttons: ${claimBtnText || '(none)'}`)

  await browser.close()
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
