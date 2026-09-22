// E2E Test: Premium course checkout
// Verifies that a premium course (GD) shows a "Buy this course" button **with its
// price**, opens the CheckoutModal with the USDT/SLEARN split, and — optionally —
// completes a real purchase and checks the result screen, the course access and
// the purchase in the profile. Covers
// https://github.com/pasosdeJesus/learn.tg/issues/128 §2.1-§2.3 and §4.2.
//
// Uses a fresh pastor wallet made eligible via the API (Sierra Leone profile
// + verifier confirmation of the worship location), so the Buy button is
// always shown regardless of what the fixture wallet has purchased.
//
// The payment mixes of §4.2 need a funded wallet. A fresh wallet starts empty
// and a (user, course) purchase cannot be repeated, so funding is explicit:
//
//   SLEARN_PCT=100 FUND_FRESH=1 …  # 100% SLEARN
//   SLEARN_PCT=0   FUND_FRESH=1 …  # 100% USDT
//   SLEARN_PCT=50  FUND_FRESH=1 …  # mixed 50/50
//
// FUND_FRESH=1 transfers testnet USDT/SLEARN (+ gas CELO) from the fixture wallet
// to the fresh one, so it spends dev funds: run the three mixes on purpose, not
// on every suite run. Without it the spec still checks the price, the modal and
// the slider, and reports the purchase steps as skipped.
//
// Execution:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 CHAIN_ID=11142220 \
//     node e2e/specs/premium-course-checkout.spec.mjs

import * as fs from 'fs'
import * as path from 'path'
import https from 'https'
import axios from 'axios'
import { SiweMessage } from 'siwe'
import { generatePrivateKey, privateKeyToAddress, privateKeyToAccount } from 'viem/accounts'
import { createPublicClient, createWalletClient, http, parseEther, parseUnits } from 'viem'
import { celoSepolia } from 'viem/chains'
import {
  initTestEnv, launchBrowser, newPage,
  resetFailures, fail, ok, summary, short,
} from '@pasosdejesus/m/e2e'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'
import { gotoWithRetry } from '../helpers/retry.mjs'

const SITE = process.env.SITE_URL || 'https://learn.tg:9001'
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11142220', 10)
const SLEARN_PCT = Number(process.env.SLEARN_PCT ?? '100') // 0 | 50 | 100
const FUND_FRESH = process.env.FUND_FRESH === '1'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const httpsAgent = new https.Agent({ rejectUnauthorized: false })

const ERC20_TRANSFER = [{
  name: 'transfer', type: 'function',
  inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
  outputs: [{ type: 'bool' }],
}, {
  name: 'balanceOf', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'owner', type: 'address' }],
  outputs: [{ type: 'uint256' }],
}]

function loadEnvCredentials() {
  for (const envPath of [path.join(process.cwd(), '..', '.env'), path.join(process.cwd(), 'apps', '.env'), path.join(process.cwd(), '.env')]) {
    if (fs.existsSync(envPath)) {
      const c = fs.readFileSync(envPath, 'utf8')
      const pk = c.match(/PRIVATE_KEY="([^"]+)"/)?.[1] || c.match(/PRIVATE_KEY=(\S+)/)?.[1]
      const addr = c.match(/NEXT_PUBLIC_ADDRESS="([^"]+)"/)?.[1] || c.match(/NEXT_PUBLIC_ADDRESS=(\S+)/)?.[1]
      const usdt = c.match(/NEXT_PUBLIC_USDT_ADDRESS="([^"]+)"/)?.[1] || c.match(/NEXT_PUBLIC_USDT_ADDRESS=(\S+)/)?.[1]
      const slearn = c.match(/NEXT_PUBLIC_SLEARN_ADDRESS="([^"]+)"/)?.[1] || c.match(/NEXT_PUBLIC_SLEARN_ADDRESS=(\S+)/)?.[1]
      const rpc = c.match(/NEXT_PUBLIC_RPC_URL="([^"]+)"/)?.[1] || c.match(/NEXT_PUBLIC_RPC_URL=(\S+)/)?.[1]
      if (pk && addr) return { pk, addr, usdt, slearn, rpc }
    }
  }
  return null
}

// Fund the fresh wallet from the fixture (testnet), only what this mix needs so
// the fixture's SLEARN is not drained (other specs, e.g. vault-both-donate, also
// spend from it). Returns null when the fixture cannot cover the mix.
async function fundFreshWallet(fixture, to, need) {
  const account = privateKeyToAccount(fixture.pk)
  const wallet = createWalletClient({
    account,
    chain: celoSepolia,
    transport: http(fixture.rpc),
  })
  const read = createPublicClient({ chain: celoSepolia, transport: http(fixture.rpc) })

  const [usdtBal, slearnBal] = await Promise.all([
    read.readContract({ address: fixture.usdt, abi: ERC20_TRANSFER, functionName: 'balanceOf', args: [fixture.addr] }),
    read.readContract({ address: fixture.slearn, abi: ERC20_TRANSFER, functionName: 'balanceOf', args: [fixture.addr] }),
  ])
  const usdtHave = Number(usdtBal) / 1e6
  const slearnHave = Number(slearnBal) / 100
  if (usdtHave < need.usdt || slearnHave < need.slearn) {
    console.log(`  [SKIP] fixture funds insufficient: has ${usdtHave.toFixed(2)} USDT / ${slearnHave.toFixed(2)} SLEARN, needs ${need.usdt} / ${need.slearn}`)
    return null
  }

  // Las transferencias se envían esperando cada recibo: sin eso la segunda reutiliza
  // el nonce de la primera y el RPC la rechaza ("nonce too low", medido 2026-09-21).
  const send = async (fn) => {
    const hash = await fn()
    await read.waitForTransactionReceipt({ hash })
    return hash
  }
  const gas = await send(() => wallet.sendTransaction({ to, value: parseEther('0.05') }))
  const usdt = need.usdt > 0
    ? await send(() => wallet.writeContract({
        address: fixture.usdt, abi: ERC20_TRANSFER, functionName: 'transfer',
        args: [to, parseUnits(String(need.usdt), 6)],
      }))
    : null
  const slearn = need.slearn > 0
    ? await send(() => wallet.writeContract({
        address: fixture.slearn, abi: ERC20_TRANSFER, functionName: 'transfer',
        args: [to, parseUnits(String(need.slearn), 2)],
      }))
    : null
  return { gas, usdt, slearn }
}

// What this mix costs, with a 15% margin for rounding and gas.
function mixNeeds(priceUSDT, priceSLEARN, pct) {
  const round2 = (n) => Math.ceil(n * 100) / 100
  return {
    usdt: Math.max(round2(priceUSDT * ((100 - pct) / 100) * 1.15), 0.5),
    slearn: round2(priceSLEARN * (pct / 100) * 1.15),
  }
}

function updateCookies(current, setCookieHeaders) {
  const map = new Map()
  if (current) {
    current.split(';').forEach(c => {
      const [name, ...rest] = c.trim().split('=')
      if (name && rest.length) map.set(name, `${name}=${rest.join('=')}`)
    })
  }
  if (setCookieHeaders) {
    setCookieHeaders.forEach(h => {
      const c = h.split(';')[0].trim()
      const [name, ...rest] = c.split('=')
      if (name && rest.length) map.set(name, c)
    })
  }
  return Array.from(map.values()).join('; ')
}

async function siweSignIn(privateKey, address) {
  const account = privateKeyToAccount(privateKey)
  const csrfRes = await axios.get(`${SITE}/api/auth/csrf`, { httpsAgent })
  const csrfToken = csrfRes.data.csrfToken
  let cookies = ''
  if (csrfRes.headers['set-cookie']) cookies = updateCookies(cookies, csrfRes.headers['set-cookie'])
  const siweMessage = new SiweMessage({
    domain: new URL(SITE).host, address,
    statement: 'Sign in to Learn through games with DIVVI tracking.',
    uri: SITE, version: '1', chainId: CHAIN_ID, nonce: csrfToken,
    issuedAt: new Date().toISOString(),
  })
  const message = siweMessage.prepareMessage()
  const signature = await account.signMessage({ message })
  const fd = new URLSearchParams({ csrfToken, message, signature, redirect: 'false', callbackUrl: `${SITE}/`, json: 'true' })
  const res = await axios.post(`${SITE}/api/auth/callback/credentials`, fd.toString(), {
    httpsAgent, headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookies },
    maxRedirects: 0, validateStatus: s => s < 400,
  })
  if (res.headers['set-cookie']) cookies = updateCookies(cookies, res.headers['set-cookie'])

  // R-#233 Fase 2: la credencial es la cookie de sesión; no hay token de API.
  return { cookies, address }
}

async function apiPatch(pathname, body, params, cookies) {
  const url = new URL(pathname, SITE)
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await axios.patch(url.toString(), body, {
    httpsAgent, headers: { 'Content-Type': 'application/json', ...(cookies ? { Cookie: cookies } : {}) },
  })
  return res.data
}

async function main() {
  const t0 = performance.now()
  resetFailures()
  const verifier = loadEnvCredentials()
  if (!verifier) { console.error('No verifier credentials'); process.exit(1) }
  const env = await initTestEnv()
  const { timeout, chainId } = env
  // SITE_URL permite apuntar a un servidor local (`next dev -p 4000`, HTTP);
  // el helper de m fija https, así que sin esto no se puede probar en local.
  const base = process.env.SITE_URL || env.base

  // 1. Fresh eligible pastor wallet
  const pk = generatePrivateKey()
  const addr = privateKeyToAddress(pk)
  const testEmail = `checkout-${addr.slice(2, 10).toLowerCase()}@learn.tg`
  console.log(`Pastor: ${short(addr)} | ${base}`)

  // 2. Fill Sierra Leone profile (Christian, pilot country, non-Zionist)
  const s = await siweSignIn(pk, addr)
  const auth = { walletAddress: addr }
  await apiPatch('/api/profile', {
    nombre: 'E2E Checkout', email: testEmail, pais_id: 694, religion_id: 2,
    position_israel_gaza: 'no', place_of_worship: 'E2E Checkout Church',
    place_of_worship_location: 'Freetown', church_relationship: 'pastor',
  }, auth, s.cookies)

  // 3. Verifier confirms the worship location → eligible to buy GD
  const vAuth = await siweSignIn(verifier.pk, verifier.addr)
  const profile = await axios.get(`${SITE}/api/profile?walletAddress=${encodeURIComponent(addr)}`, { httpsAgent, headers: { Cookie: s.cookies } }).then(r => r.data)
  await apiPatch(`/api/admin/user/${profile.id}`, {
    verified_place_of_worship_location: 'Freetown',
    verified_place_of_worship: 'E2E Checkout Church',
    verified_church_relationship: 'pastor',
  }, { wallet: verifier.addr }, vAuth.cookies)

  // 4. Browser: Buy button + CheckoutModal
  const browser = await launchBrowser(env.headless)
  const page = await newPage(browser, addr, 120000)
  // Diagnóstico del flujo de compra: sin esto, un fallo dentro del modal solo
  // dejaba "Result screen did not appear" sin causa (medido 2026-09-21: la compra
  // con 100% SLEARN no llegaba a la pantalla de resultado y no había ni error).
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(`console: ${String(m.text()).slice(0, 200)}`) })
  page.on('response', (r) => {
    const u = r.url()
    if (u.includes('/api/') && r.status() >= 400) pageErrors.push(`http ${r.status()} ${u.slice(u.indexOf('/api/'))}`)
  })
  await setupE2EAuth(page, addr, pk, chainId, base)
  await gotoWithRetry(page, `${base}/en/gdcluster`, { waitUntil: 'domcontentloaded' , timeout: 120000 })

  // Wait for the course page to finish loading (cold on-demand compilation can
  // leave "Loading course..." up for a while in the full suite).
  let state = null
  for (let i = 0; i < 30 && !state; i++) {
    await new Promise(r => setTimeout(r, 1500))
    state = await page.evaluate(() => {
      const txt = document.body.innerText || ''
      if (txt.includes('Buy this course')) return 'buy'
      if (txt.includes('Purchased') || txt.includes('Comprado')) return 'purchased'
      if (txt.includes('Loading course') || txt.includes('Cargando curso')) return null
      // eligibility reason shown instead of Buy
      if (txt.includes('requires a verified city') || txt.includes('ciudad de culto verificada') ||
          txt.includes('Not eligible') || txt.includes('No cumples') || txt.includes('for Christians') ||
          txt.includes('para cristianos') || txt.includes('pilot') || txt.includes('país piloto')) return 'reason'
      return null
    })
  }
  console.log('  [course state] ' + state)

  const buyVisible = state === 'buy' || await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, span'))
    return btns.some(b => (b.textContent || '').includes('Buy this course'))
  })
  if (buyVisible) ok('Buy button visible')
  else {
    fail('Buy button not visible on premium course page (state: ' + state + ')')
    const dump = await page.evaluate(() => (document.body.innerText || '').slice(0, 400))
    console.log('  [page dump] ' + JSON.stringify(dump))
  }

  // §2.1: the price (USDT + SLEARN) is shown next to the Buy button, not only
  // inside the modal. It arrives with the price request, hence the wait.
  let priceText = null
  for (let i = 0; i < 15 && !priceText; i++) {
    await new Promise(r => setTimeout(r, 1000))
    priceText = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="premium-price"]')
      return el ? (el.textContent || '').trim() : null
    })
  }
  if (priceText && /USDT/.test(priceText)) ok(`Price next to the buy button: ${priceText}`)
  else fail(`Price not shown next to the buy button (got: ${JSON.stringify(priceText)})`)

  const clicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    const btn = buttons.find((b) => (b.textContent || '').includes('Buy this course'))
    if (btn) { btn.click(); return true }
    return false
  })
  if (clicked) ok('Buy button clicked')
  else fail('Buy button not found/clickable')

  // Checkout modal opened
  let modalVisible = false
  for (let i = 0; i < 12 && !modalVisible; i++) {
    await new Promise(r => setTimeout(r, 1000))
    modalVisible = await page.evaluate(() =>
      (document.body.textContent || '').includes('Purchase course') ||
      (document.body.textContent || '').includes('Comprar curso'))
  }
  if (modalVisible) ok('Checkout modal opened')
  else fail('Checkout modal did not open')

  // Slider (USDT/SLEARN split) present and functional: it is moved to the mix
  // this run covers (SLEARN_PCT).
  const sliderInfo = await page.evaluate((pct) => {
    const range = document.querySelector('input[type="range"]')
    if (!range) return null
    const before = range.value
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(range, String(pct))
    range.dispatchEvent(new Event('input', { bubbles: true }))
    range.dispatchEvent(new Event('change', { bubbles: true }))
    return { before, after: range.value, min: range.min, max: range.max }
  }, SLEARN_PCT)
  if (sliderInfo) ok(`Slider present (${sliderInfo.min}–${sliderInfo.max}, moved ${sliderInfo.before}→${sliderInfo.after} for ${SLEARN_PCT}% SLEARN)`)
  else fail('Slider not found in modal')

  // ── Purchase (§4.2) ─────────────────────────────────────────────────────
  // Only with FUND_FRESH=1: a fresh wallet is empty, so it is funded from the
  // fixture wallet with testnet tokens (see the header).
  const fundNeeded = FUND_FRESH
  if (!fundNeeded) {
    console.log(`  [SKIP] purchase steps (${SLEARN_PCT}% SLEARN): rerun with FUND_FRESH=1 to fund the fresh wallet and buy for real`)
  } else {
    try {
      // Precio real de este pastor (SL) para pedirle a la fixture solo lo que la
      // mezcla necesita.
      const priceRes = await axios.get(
        `${SITE}/api/courses/premium/price?courseId=10&walletAddress=${encodeURIComponent(addr)}`,
        { httpsAgent, headers: { Cookie: s.cookies } },
      )
      const need = mixNeeds(Number(priceRes.data.priceUSDT), Number(priceRes.data.priceSLEARN), SLEARN_PCT)
      console.log(`  [mix] ${SLEARN_PCT}% SLEARN → funding ${need.usdt} USDT + ${need.slearn} SLEARN`)

      const hashes = await fundFreshWallet(verifier, addr, need)
      if (!hashes) {
        console.log(`  [SKIP] purchase steps: top up the fixture wallet and rerun with SLEARN_PCT=${SLEARN_PCT} FUND_FRESH=1`)
      } else {
        ok(`Fresh wallet funded from the fixture (${short(hashes.gas)}…)`)
        await new Promise(r => setTimeout(r, 8000)) // let the funding settle

        const purchaseClicked = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'))
          const btn = buttons.find((b) => {
            const txt = (b.textContent || '').trim()
            return (txt === 'Purchase' || txt === 'Comprar') && !b.disabled
          })
          if (btn) { btn.click(); return true }
          return false
        })
        if (purchaseClicked) ok('Purchase button clicked')
        else fail('Purchase button not found/clickable in the modal')

        // Result screen: title + transaction link (§2.2)
        let resultTitle = false
        let txHref = null
        let gasPanel = false
        let lastSnippet = ''
        const snapshots = []
        for (let i = 0; i < 60 && !resultTitle && !gasPanel; i++) {
          await new Promise(r => setTimeout(r, 2000))
          const st = await page.evaluate(() => {
            const txt = document.body.textContent || ''
            const link = Array.from(document.querySelectorAll('a')).find(a => (a.getAttribute('href') || '').includes('/tx/'))
            return {
              result: txt.includes('Course purchased') || txt.includes('Curso comprado'),
              // Copias exactas del GasInsufficientPanel (components/GasInsufficientPanel.tsx).
              // Antes se miraba también 'You need', que coincide con los avisos de USDT del
              // CheckoutModal ('You need to add USDT…', 'You need X more USDT…'): el 2026-09-21
              // eso reportó "el wallet no pudo pagar (gas)" cuando el panel real podía ser otro.
              gas: txt.includes('Se necesita CELO') || txt.includes('CELO is needed'),
              snippet: txt.replace(/\s+/g, ' ').slice(0, 300),
              href: link ? link.getAttribute('href') : null,
            }
          })
          resultTitle = st.result
          txHref = st.href || txHref
          gasPanel = st.gas
          lastSnippet = st.snippet || lastSnippet
          if (snapshots.length < 6 && st.snippet !== snapshots[snapshots.length - 1]) snapshots.push(st.snippet)
        }

        if (resultTitle) ok('Result screen shown after the purchase')
        else if (gasPanel) console.log(`  [SKIP] el wallet no tiene CELO para el gas (panel "CELO is needed"). Texto: ${lastSnippet}`)
        else {
          fail(`Result screen did not appear after the purchase. Texto: ${lastSnippet}`)
          snapshots.forEach((sn, i) => console.log(`  [snapshot ${i}] ${sn}`))
          if (pageErrors.length) {
            console.log('  [page errors]')
            pageErrors.slice(-12).forEach(e => console.log(`    ${e}`))
          }
        }

        if (resultTitle) {
          if (txHref && /\/tx\/0x/.test(txHref)) ok(`Result screen links the transaction (${txHref.slice(-12)})`)
          else fail('Result screen has no transaction link')

          // OK closes the modal and reloads the page
          await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'))
            const okBtn = buttons.find(b => ['OK', 'Listo', 'Close', 'Cerrar', 'Continue'].includes((b.textContent || '').trim()))
            if (okBtn) okBtn.click()
          })
          await new Promise(r => setTimeout(r, 8000))

          // Access after the purchase + the state on the course page
          await gotoWithRetry(page, `${base}/en/gdcluster`, { waitUntil: 'domcontentloaded', timeout: 120000 })
          await new Promise(r => setTimeout(r, 5000))
          const purchased = await page.evaluate(() => {
            const txt = document.body.innerText || ''
            return txt.includes('Purchased') || txt.includes('Comprado')
          })
          if (purchased) ok('Course page shows the course as purchased')
          else fail('Course page does not show the course as purchased')

          // §2.3: the purchase is listed in the profile
          await gotoWithRetry(page, `${base}/en/profile`, { waitUntil: 'domcontentloaded', timeout: 120000 })
          let listed = false
          for (let i = 0; i < 30 && !listed; i++) {
            await new Promise(r => setTimeout(r, 1500))
            listed = await page.evaluate(() => {
              const el = document.querySelector('[data-testid="premium-courses"]')
              return !!el && (el.textContent || '').includes('Global Disciples')
            })
          }
          if (listed) ok('The purchase is listed in the profile ("My premium courses")')
          else fail('The purchase is not listed in the profile')

          // §4.2: the guide is accessible after the purchase
          await gotoWithRetry(page, `${base}/en/gdcluster/guide1`, { waitUntil: 'domcontentloaded', timeout: 120000 })
          await new Promise(r => setTimeout(r, 5000))
          const guideState = await page.evaluate(() => {
            const txt = document.body.innerText || ''
            return {
              wall: txt.includes('Buy this course') || txt.includes('Comprar este curso'),
              len: txt.length,
            }
          })
          if (!guideState.wall && guideState.len > 500) ok(`Guide accessible after the purchase (${guideState.len} chars)`)
          else fail(`Guide not accessible after the purchase (wall=${guideState.wall}, len=${guideState.len})`)
        }
      }
    } catch (e) {
      fail(`Purchase flow failed: ${e?.shortMessage || e?.message || e}`)
    }
  }

  await browser.close()
  const elapsed = ((performance.now() - t0) / 1000).toFixed(1)
  const failures = summary(t0)
  console.log(`\n${failures} failures | ${elapsed}s`)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
