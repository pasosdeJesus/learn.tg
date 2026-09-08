// E2E: WalletEventListener no pierde la sesión ni recarga la página ante
// eventos de wallet transitorios (R-#227 problema 1).
//
// Contexto: al confirmar una donación ERC-20 en el vault, algunas billeteras
// (móvil/Rabby/OneKey) emiten `accountsChanged([])` o `disconnect`. Antes del
// fix, WalletEventListener firmaba signOut(redirect) → recarga → se perdía el
// modal "Donation completed" aunque el backend ya registrara la donación.
//
// Este spec usa un provider EIP-1193 que CAPTURA los handlers de
// window.ethereum.on (los mocks de e2e-auth usan on:()=>{} y no permiten
// emitir eventos) y verifica:
//   1. accountsChanged([]) transitorio (cuenta sigue conectada) → NO recarga.
//   2. disconnect transitorio (cuenta sigue conectada) → NO recarga.
//   3. accountsChanged([]) real (eth_accounts vacío) → recarga a "/" (signOut).
//   4. disconnect real (eth_accounts vacío) → recarga a "/" (signOut).
//
// Ejecución:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 CHAIN_ID=11142220 \
//     node e2e/specs/wallet-event-disconnect.spec.mjs

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser, newPage,
  resetFailures, fail, ok, summary, short,
} from '@pasosdejesus/m/e2e'

function loadEnvCredentials() {
  for (const envPath of [path.join(process.cwd(), '..', '.env'), path.join(process.cwd(), 'apps', '.env'), path.join(process.cwd(), '.env')]) {
    if (fs.existsSync(envPath)) {
      const c = fs.readFileSync(envPath, 'utf8')
      const pk = c.match(/PRIVATE_KEY="([^"]+)"/)?.[1] || c.match(/PRIVATE_KEY=(\S+)/)?.[1]
      const addr = c.match(/NEXT_PUBLIC_ADDRESS="([^"]+)"/)?.[1] || c.match(/NEXT_PUBLIC_ADDRESS=(\S+)/)?.[1]
      if (pk && addr) return { pk, addr }
    }
  }
  return null
}

/** Provider EIP-1193 con firma SIWE real y on() que CAPTURA handlers. */
async function injectProvider(page, address, privateKey, chainId) {
  const hexChainId = '0x' + chainId.toString(16)
  await page.exposeFunction('__signSiwe', async (message) => {
    const { privateKeyToAccount } = await import('viem/accounts')
    const sig = await privateKeyToAccount(privateKey).signMessage({ message })
    return typeof sig === 'string' ? sig : sig.signature || sig
  })
  await page.evaluateOnNewDocument((addr, cid) => {
    const handlers = {}
    // accounts desconectados? — el test lo alterna con setDisconnected
    let disconnected = false
    const provider = {
      isMetaMask: true,
      chainId: cid,
      selectedAddress: disconnected ? undefined : addr,
      request: async ({ method, params }) => {
        if (method === 'eth_chainId') return cid
        if (method === 'eth_accounts') return disconnected ? [] : [addr]
        if (method === 'eth_requestAccounts') return disconnected ? [] : [addr]
        if (method === 'personal_sign') return window.__signSiwe(params[0])
        if (method === 'wallet_switchEthereumChain') return null
        if (method === 'wallet_addEthereumChain') return null
        if (method === 'eth_sendTransaction') return '0x' + 'ab'.repeat(32)
        if (method === 'eth_getBalance') return '0x0DE0B6B3A7640000'
        if (method === 'eth_blockNumber') return '0x1312D00'
        if (method === 'eth_gasPrice') return '0x12A05F200'
        if (method === 'eth_estimateGas') return '0x7A120'
        return null
      },
      on: (evt, h) => { (handlers[evt] = handlers[evt] || []).push(h) },
      removeListener: (evt, h) => {
        const arr = handlers[evt] || []
        const i = arr.indexOf(h)
        if (i >= 0) arr.splice(i, 1)
      },
      setDisconnected: (v) => { disconnected = v },
      emitDiag: (evt, ...args) => {
        const arr = handlers[evt] || []
        console.log(`[emit:${new Date().toISOString()}] ${evt} → ${arr.length} handler(s)`)
        arr.forEach((h) => { try { h(...args) } catch (e) { console.log('[emit] handler error', e?.message) } })
        return arr.length
      },
    }
    window.ethereum = provider
  }, address, hexChainId)
}

/** SIWE dentro de la página (cookie queda en el browser jar). */
async function siweInPage(page, address, privateKey, chainId, baseUrl) {
  const { SiweMessage } = await import('siwe')
  const { privateKeyToAccount } = await import('viem/accounts')
  const account = privateKeyToAccount(privateKey)
  const host = new URL(baseUrl).hostname
  const port = new URL(baseUrl).port || '443'
  const domainPort = port === '443' || port === '80' ? '' : `:${port}`
  const csrfRes = await page.evaluate(async () => (await fetch('/api/auth/csrf')).json())
  const csrfToken = csrfRes.csrfToken
  const msg = new SiweMessage({
    domain: `${host}${domainPort}`, address: account.address,
    statement: 'Sign in to Learn through games.', uri: baseUrl,
    version: '1', chainId, nonce: csrfToken,
  })
  const msgStr = msg.prepareMessage()
  const sig = await account.signMessage({ message: msgStr })
  const cb = await page.evaluate(async ({ csrfToken, msgStr, sig }) => {
    const body = new URLSearchParams({ csrfToken, message: msgStr, signature: sig, redirect: 'false', json: 'true' })
    const r = await fetch('/api/auth/callback/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(), redirect: 'manual',
    })
    return { status: r.status }
  }, { csrfToken, msgStr, sig: typeof sig === 'string' ? sig : sig.signature || sig })
  if (cb.status !== 200 && cb.status !== 302) throw new Error(`SIWE callback ${cb.status}`)
  console.log(`  SIWE: ${cb.status}`)
}

async function navAndWait(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await new Promise(r => setTimeout(r, 3000))
}

/** Dispara el evento y espera a ver si la página recarga/navega. */
async function emitAndCheck(page, label, fn) {
  const before = page.url()
  await page.evaluate(fn)
  await new Promise(r => setTimeout(r, 2500))
  const after = page.url()
  const moved = before !== after
  console.log(`  ${label}: ${moved ? 'RECARGÓ → ' + after : 'sin recarga (OK)'}`)
  return moved
}

async function main() {
  const t0 = performance.now()
  resetFailures()
  const creds = loadEnvCredentials()
  if (!creds) { console.error('No credentials'); process.exit(1) }
  process.env.TEST_PRIVATE_KEY = creds.pk
  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { base, timeout, chainId } = env
  console.log(`Wallet: ${short(creds.addr)} | ${base}\n`)

  const browser = await launchBrowser(env.headless)
  const page = await newPage(browser, creds.addr, timeout)
  await injectProvider(page, creds.addr, creds.pk, chainId)

  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))

  // Login + aterrizar en un curso (la sesión debe estar activa)
  await navAndWait(page, base)
  await siweInPage(page, creds.addr, creds.pk, chainId, base)
  // Reload para que SessionProvider lea la cookie y el home liste cursos
  await navAndWait(page, `${base}/en`)
  await new Promise(r => setTimeout(r, 4000))
  let courseLink = null
  for (let i = 0; i < 4 && !courseLink; i++) {
    courseLink = await page.evaluate(() => {
      const a = [...document.querySelectorAll('a[href]')].find((x) => {
        const h = x.getAttribute('href') || ''
        return h.startsWith('/en/') && !h.includes('privacy') && !h.includes('terms') && !h.includes('profile') && !h.includes('donations') && !h.includes('gdcluster') && !h.includes('ranking')
      })
      return a ? a.getAttribute('href') : null
    })
    if (!courseLink) {
      console.log(`  (curso aún no listado, intento ${i + 1}/4)`)
      await new Promise(r => setTimeout(r, 4000))
    }
  }
  if (!courseLink) {
    const body = await page.evaluate(() => document.body?.textContent?.slice(0, 200))
    console.log('  body en /en:', JSON.stringify(body))
    fail('No course link on /en')
    await browser.close()
    process.exit(1)
  }
  console.log(`Curso: ${courseLink}`)
  await navAndWait(page, `${base}${courseLink}`)

  // ── 1. accountsChanged([]) transitorio → NO recarga ──
  const r1 = await emitAndCheck(page, 'accountsChanged([]) transitorio (cuenta conectada)',
    () => window.ethereum.emitDiag('accountsChanged', []))
  if (!r1) ok('1. accountsChanged([]) transitorio NO recarga (fix OK)')
  else fail('1. accountsChanged([]) transitorio RECARGÓ (regresión)')

  // ── 2. disconnect transitorio → NO recarga ──
  const r2 = await emitAndCheck(page, 'disconnect transitorio (cuenta conectada)',
    () => window.ethereum.emitDiag('disconnect'))
  if (!r2) ok('2. disconnect transitorio NO recarga (fix OK)')
  else fail('2. disconnect transitorio RECARGÓ (regresión)')

  // ── 3. accountsChanged([]) real (eth_accounts vacío) → recarga a "/" ──
  await page.evaluate(() => window.ethereum.setDisconnected(true))
  const r3 = await emitAndCheck(page, 'accountsChanged([]) real (desconectado)',
    () => window.ethereum.emitDiag('accountsChanged', []))
  if (r3) ok('3. accountsChanged([]) real recarga (signOut esperado)')
  else fail('3. accountsChanged([]) real NO recargó (debería signOut)')

  await browser.close()
  const failures = summary(t0)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
