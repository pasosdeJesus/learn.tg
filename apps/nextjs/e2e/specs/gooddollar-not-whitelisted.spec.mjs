#!/usr/bin/env node
// E2E de GoodDollar para una billetera **sin verificar** (no whitelisted):
// comprueba que el botón resuelva a `verify` (abrir GoodID) y **no** envíe un
// `claim()` condenado. Chrome + Puppeteer contra Celo mainnet.
// (https://github.com/pasosdeJesus/learn.tg/issues/271, https://github.com/pasosdeJesus/learn.tg/issues/275)
//
// Por defecto usa la billetera de `apps/.env` (`PRIVATE_KEY`, hoy no verificada) en
// modo in-app; pasa `GOODDOLLAR_PRIVATE_KEY` o `GOODDOLLAR_WALLET=external` para otra.
// Si la dirección SÍ está verificada, la spec se salta en verde (para el reclamo real
// está `gooddollar-claim-real`). Esta spec NO envía ninguna transacción.
//
// Lo que verifica:
//   1. on-chain: `getWhitelistedRoot(address) === 0x0` (la dirección no está verificada).
//   2. en el navegador: el botón resuelve a `data-action="verify"` (no a un claim).
//   3. al pulsarlo se abre GoodID (goodid.gooddollar.org) y **no** se envía ningún
//      `eth_sendTransaction` ni aparece un reclamo exitoso.
//
// Ejecución:
//   cd apps/nextjs
//   PROD_SPECS=1 \
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=443 CHAIN_ID=42220 \
//   SITE_URL=https://learn.tg \
//     bin/m test:e2e gooddollar-not-whitelisted

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser,
  resetFailures, fail, ok, summary,
} from '@pasosdejesus/m/e2e'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'
import { resolveSiteTarget } from '../helpers/site-target.mjs'
import { gotoWithRetry } from '../helpers/retry.mjs'
import { createPublicClient, createWalletClient, http, parseAbi, zeroAddress } from 'viem'
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts'
import { celo } from 'viem/chains'

// Direcciones del SDK oficial (`@goodsdks/citizen-sdk@1.2.7`,
// `chainConfigs[42220].contracts.production`), la misma fuente que usa GoodWallet.
const IDENTITY = '0xC361A6E67822a0EDc17D899227dd9FC50BD62F42'
const UBISCHEME = '0x43d72Ff17701B2DA814620735C39C620Ce0ea4A1'
const DEFAULT_RPC = process.env.CELO_RPC_URL || 'https://forno.celo.org'

const identityAbi = parseAbi([
  'function getWhitelistedRoot(address) view returns (address)',
])

const DEFAULT_GUIDE_PATHS =
  '/en/web3-and-ubi/guide4,/en/web3-and-ubi/guide3,/en/web3-and-ubi/guide5,/en/web3-and-ubi/guide2'

/**
 * Guías donde puede estar el botón. El placeholder `{GoodDollarButton}` vive en la
 * guía que el renumerado del 2026-09-30 movió de `guide3` a `guide4`: un sitio sin
 * ese renumerado (producción vieja) lo tiene en `guide3`. Se prueban en orden y se
 * usa la primera que lo muestre. Override: `GOODDOLLAR_GUIDE_PATHS` (lista) o
 * `GOODDOLLAR_GUIDE_PATH` (una sola).
 */
const GUIDE_PATHS = (process.env.GOODDOLLAR_GUIDE_PATHS
  || process.env.GOODDOLLAR_GUIDE_PATH
  || DEFAULT_GUIDE_PATHS)
  .split(',').map((s) => s.trim()).filter(Boolean)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * La billetera de `apps/.env`: el operador la usa para probar sin exponer otra llave.
 * Se busca en las mismas rutas que `in-app-wallet-payments.spec.mjs` (los specs corren
 * desde `apps/nextjs`).
 */
function loadEnv() {
  const candidates = [
    path.join(process.cwd(), '..', '.env'),
    path.join(process.cwd(), 'apps', '.env'),
    path.join(process.cwd(), '.env'),
  ]
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue
    const env = fs.readFileSync(p, 'utf8')
    const g = (k) => env.match(new RegExp(`${k}=\"?([^\"\\n]+)\"?`))?.[1]
    const pk = g('PRIVATE_KEY')
    if (pk) {
      return {
        pk,
        addr: g('NEXT_PUBLIC_ADDRESS'),
        network: g('NEXT_PUBLIC_NETWORK'),
      }
    }
  }
  return null
}

/**
 * Localiza el botón en el DOM. El build nuevo lo marca con
 * `data-testid="gooddollar-claim-button"`; un build anterior (la producción de hoy)
 * NO trae testid, así que se cae al texto del botón (EN/ES).
 */
const findClaimButton = () => {
  const byTestId = document.querySelector('[data-testid="gooddollar-claim-button"]')
  const node = byTestId || [...document.querySelectorAll('button')].find((b) =>
    /Sign up with GoodDollar or Claim UBI|Regístrate con GoodDollar o reclama UBI/i.test(b.innerText || ''),
  )
  if (!node) return null
  return {
    byTestId: !!byTestId,
    reason: node.getAttribute('data-reason') || 'unknown',
    action: node.getAttribute('data-action') || 'unknown',
    disabled: !!node.disabled,
    text: (node.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
  }
}

const clickClaimButton = () => {
  const node = document.querySelector('[data-testid="gooddollar-claim-button"]') || [...document.querySelectorAll('button')].find((b) =>
    /Sign up with GoodDollar or Claim UBI|Regístrate con GoodDollar o reclama UBI/i.test(b.innerText || ''),
  )
  if (node) node.click()
  return !!node
}

/**
 * Captura la respuesta REAL de `/api/guide` (la misma que pide la página, con
 * sesión) para saber si esa guía trae el placeholder `{GoodDollarButton}`. Así no
 * se supone nada sobre el contenido desplegado: se mide.
 */
function attachGuideProbe(page) {
  const responses = []
  page.on('response', async (res) => {
    if (!res.url().includes('/api/guide')) return
    let markdown = null
    let message = null
    try {
      const body = await res.json()
      markdown = body?.markdown ?? null
      message = body?.message ?? null
    } catch { /* sin JSON */ }
    responses.push({
      path: new URL(res.url()).pathname + new URL(res.url()).search,
      status: res.status(),
      hasButton: typeof markdown === 'string' && markdown.includes('{GoodDollarButton}'),
      hasMarkdown: typeof markdown === 'string' && markdown.length > 0,
      message,
    })
  })
  return responses
}

/** Recorre las guías candidatas y devuelve la primera que muestre el botón. */
async function findGoodDollarGuide(page, base, timeout, probe) {
  const tried = []
  for (const path of GUIDE_PATHS) {
    const from = probe.length
    await gotoWithRetry(page, `${base}${path}`, { waitUntil: 'domcontentloaded', timeout }).catch(() => {})
    let info = null
    for (let i = 0; i < 20 && !info; i++) {
      await sleep(1000)
      info = await page.evaluate(findClaimButton)
    }
    await sleep(1500) // deja llegar la respuesta de /api/guide si iba detrás
    const got = probe.slice(from)
    const withButton = got.find((r) => r.hasButton)
    if (info || withButton) {
      return { path, info: info || { reason: 'unknown', disabled: null }, tried, guide: withButton || got[0] || null }
    }
    const api = got.length
      ? `${got[0].status} markdown=${got[0].hasMarkdown} hasButton=${got[0].hasButton}${got[0].message ? ` message=${JSON.stringify(got[0].message)}` : ''}`
      : 'sin respuesta de /api/guide'
    const seen = await page.evaluate(() => (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 120))
    tried.push(`${path} → /api/guide: ${api} | pantalla: ${JSON.stringify(seen)}`)
  }
  return { path: null, info: null, tried, guide: null }
}

/**
 * Espera a que el botón resuelva su acción (la lectura on-chain es asíncrona: al
 * aparecer el nodo el estado todavía es `idle`). Un build sin `data-action` se
 * devuelve tal cual: esa parte no se puede medir y la spec lo reporta.
 */
async function waitForAction(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  let info = await page.evaluate(findClaimButton)
  while (info && info.byTestId && info.action === 'idle' && Date.now() < deadline) {
    await sleep(1000)
    info = await page.evaluate(findClaimButton)
  }
  return info
}

/** Espera a que la sesión de la billetera in-app quede establecida (SIWE automático). */
async function waitForInAppSession(page, address, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const session = await page
      .evaluate(() => (localStorage.getItem('learn.tg.sessionAddress') || '').toLowerCase())
      .catch(() => '')
    if (session === address.toLowerCase()) return true
    await sleep(1000)
  }
  return false
}

/** Importa la llave privada en la billetera in-app de learn.tg por la UI y la desbloquea. */
async function importInAppWallet(page, { mnemonic, privateKey, timeout }) {
  // Import diferido a propósito: `in-app-wallet.mjs` carga `@learn-tg/pdj-wallet`
  // (→ `viem`), que en Node resuelve desde `packages/pdj-wallet/node_modules` y sólo
  // está tras un `pnpm install` dentro del paquete. El modo `external` no debe
  // necesitarlo, así que el helper se carga únicamente cuando se usa la in-app.
  const { chooseWalletProtection, TEST_PASSWORD } = await import('../helpers/in-app-wallet.mjs')
  for (let attempt = 0; attempt < 15; attempt++) {
    await page.click('[data-testid="wallet-open-dialog"]').catch(() => {})
    const opened = await page
      .waitForSelector('[data-testid="wallet-mode-import"]', { timeout: 5000 })
      .then(() => true)
      .catch(() => false)
    if (opened) break
    if (attempt === 14) throw new Error('no se abrió el diálogo de la billetera in-app')
  }
  await page.click('[data-testid="wallet-mode-import"]')
  if (mnemonic) {
    await page.waitForSelector('[data-testid="wallet-mnemonic"]', { timeout })
    await page.type('[data-testid="wallet-mnemonic"]', mnemonic)
  } else {
    await page.waitForSelector('[data-testid="wallet-private-key"]', { timeout })
    await page.type('[data-testid="wallet-private-key"]', privateKey)
  }
  await page.type('[data-testid="wallet-password"]', TEST_PASSWORD)
  await page.click('[data-testid="wallet-import"]')
  await chooseWalletProtection(page)
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  if (process.env.PROD_SPECS !== '1') {
    console.log('[SKIP] navega el sitio de producción y firma con una billetera real: ejecutar con PROD_SPECS=1')
    process.exit(0)
  }

  const mode = (process.env.GOODDOLLAR_WALLET || 'in-app').toLowerCase()
  let mnemonic = process.env.GOODDOLLAR_MNEMONIC
  let rawPk = process.env.GOODDOLLAR_PRIVATE_KEY

  if (!mnemonic && !rawPk) {
    const local = loadEnv()
    if (!local?.pk) {
      console.log('[SKIP] falta GOODDOLLAR_MNEMONIC/GOODDOLLAR_PRIVATE_KEY y no hay apps/.env con PRIVATE_KEY')
      process.exit(0)
    }
    rawPk = local.pk
    console.log(`Billetera tomada de apps/.env (NEXT_PUBLIC_ADDRESS=${local.addr || '?'}, NEXT_PUBLIC_NETWORK=${local.network || '?'})`)
  }

  const pk = rawPk ? (rawPk.startsWith('0x') ? rawPk : `0x${rawPk}`) : null
  const account = mode === 'external' || !mnemonic
    ? privateKeyToAccount(pk)
    : mnemonicToAccount(mnemonic.trim())

  const env = await initTestEnv()
  const { base } = resolveSiteTarget(env)
  const chainId = parseInt(process.env.CHAIN_ID || '42220', 10)
  console.log(`Modo: ${mode} | billetera: ${account.address} | ${base} (chain ${chainId})`)
  console.log(`RPC de lectura: ${DEFAULT_RPC}`)

  if (chainId !== 42220) {
    fail(`GoodDollar UBI solo existe en Celo mainnet (42220); se pidió chain ${chainId}`)
    process.exit(summary(t0) > 0 ? 1 : 0)
  }

  const publicClient = createPublicClient({ chain: celo, transport: http(DEFAULT_RPC) })

  // ── Pre-chequeo on-chain (sin navegador): esta spec es para direcciones NO verificadas ──
  let root
  try {
    root = await publicClient.readContract({
      address: IDENTITY, abi: identityAbi, functionName: 'getWhitelistedRoot', args: [account.address],
    })
  } catch (e) {
    fail(`no se pudo leer la whitelist de GoodDollar en ${DEFAULT_RPC}: ${e instanceof Error ? e.message : e}`)
    process.exit(summary(t0) > 0 ? 1 : 0)
  }
  if (root !== zeroAddress) {
    ok(
      `la dirección SÍ está verificada (root ${root.slice(0, 10)}…): esta spec cubre el caso NO verificado. `
      + 'Para el reclamo real usa gooddollar-claim-real. Se salta en verde.',
    )
    process.exit(0)
  }
  ok(`la dirección NO está verificada con GoodDollar (getWhitelistedRoot ${account.address} = 0x0): se espera el camino de verificación, sin claim`)

  const balance = await publicClient.getBalance({ address: account.address }).catch(() => BigInt(0))
  console.log(`  CELO para gas: ${balance} (irrelevante: esta spec no envía transacciones)`)

  // ── Navegador ──
  const browser = await launchBrowser()
  const page = await browser.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 200)))
  const guideProbe = attachGuideProbe(page)
  let claimTxHash = ''
  // Ningún envío debe salir por el RPC con la dirección no verificada.
  const rpcSends = []
  page.on('request', (req) => {
    const data = req.postData()
    if (data && /eth_sendTransaction|wallet_sendCalls/.test(data)) {
      rpcSends.push(`${req.method()} ${req.url()} ${JSON.stringify(data.slice(0, 180))}`)
    }
  })

  try {
    if (mode === 'in-app') {
      await page.evaluateOnNewDocument(
        "try { localStorage.clear(); indexedDB.deleteDatabase('learn-tg-pdj-wallet') } catch (e) {}",
      )
      await gotoWithRetry(page, `${base}/en`, { waitUntil: 'domcontentloaded', timeout: env.timeout })
      await sleep(2500)
      await importInAppWallet(page, {
        mnemonic: mnemonic ? mnemonic.trim() : null,
        privateKey: mnemonic ? null : pk,
        timeout: env.timeout,
      })
      const signedIn = await waitForInAppSession(page, account.address, 60000)
      if (!signedIn) {
        await fail('la billetera in-app se importó pero la sesión SIWE no quedó establecida')
        throw new Error('no session')
      }
      ok('billetera in-app importada, desbloqueada y sesión iniciada')
    } else {
      await setupE2EAuth(page, account.address, pk, chainId, base)
      ok('sesión SIWE con la billetera externa (mock con firma real)')

      const userWallet = createWalletClient({
        account: privateKeyToAccount(pk),
        chain: celo,
        transport: http(DEFAULT_RPC),
      })
      await page.exposeFunction('__rpcReal', async (method, params) => {
        if (method === 'eth_sendTransaction') {
          const tx = params?.[0] || {}
          const hash = await userWallet.sendTransaction({
            to: tx.to,
            value: BigInt(tx.value || '0x0'),
            ...(tx.data && tx.data !== '0x' ? { data: tx.data } : {}),
            ...(tx.gas ? { gas: BigInt(tx.gas) } : {}),
          })
          claimTxHash = hash
          console.log(`  tx enviada: ${hash}`)
          return hash
        }
        return publicClient.request({ method, params })
      })
      await page.evaluate(() => { window.__e2eRealRpc = true })
    }

    const found = await findGoodDollarGuide(page, base, env.timeout, guideProbe)
    if (!found.info) {
      await fail(`no apareció el botón de GoodDollar en ninguna de estas guías. Detalle (respuesta real de /api/guide): ${found.tried.join(' | ')}`)
      throw new Error('no button')
    }
    const info = await waitForAction(page, 45000)
    const guideNote = found.guide
      ? ` | /api/guide ${found.guide.status} markdown=${found.guide.hasMarkdown} hasButton=${found.guide.hasButton}`
      : ''
    ok(`botón de GoodDollar encontrado en ${found.path} (data-reason=${info.reason}, data-action=${info.action}, disabled=${info.disabled})${guideNote}`)

    if (!info.byTestId) {
      await fail(
        'el botón no trae `data-testid` (build anterior): no se puede medir `data-action`. '
        + `texto: ${JSON.stringify(info.text)}`,
      )
      throw new Error('old build')
    }
    if (info.reason !== 'ready') {
      await fail(`el botón no está listo: data-reason=${info.reason} (la spec esperaba "ready")`)
      throw new Error('not ready')
    }
    if (info.action !== 'verify') {
      await fail(
        `una dirección NO verificada debe resolver a "verify", pero el botón resolvió a "${info.action}". `
        + `texto: ${JSON.stringify(info.text)}`,
      )
      throw new Error('wrong action')
    }
    if (info.disabled) {
      await fail('el botón de verificación está deshabilitado')
      throw new Error('disabled')
    }
    if (!/one-time face verification|verificaci[oó]n facial/i.test(info.text)) {
      await fail(`el botón no mostró el aviso de verificación facial. texto: ${JSON.stringify(info.text)}`)
    } else {
      ok('el botón avisa de la verificación facial (una sola vez)')
    }

    // GoodID: la verificación abre https://goodid.gooddollar.org con el rdu de vuelta.
    let goodIdUrl = ''
    const popupUrls = []
    const sdkLogs = []
    page.on('framenavigated', (f) => {
      if (f === page.mainFrame() && /goodid\.gooddollar\.org/i.test(f.url())) goodIdUrl = f.url()
    })
    page.on('popup', (p) => {
      popupUrls.push(p.url())
      if (/goodid\.gooddollar\.org/i.test(p.url())) goodIdUrl = p.url()
    })
    page.on('console', (m) => {
      const t = m.text()
      if (/gooddollar|goodid|verif|facetec|whitelist|identity|claim/i.test(t)) {
        sdkLogs.push(`${m.type()}: ${t.slice(0, 160)}`)
      }
    })

    const clicked = await page.evaluate(clickClaimButton)
    if (!clicked) {
      await fail('el botón desapareció antes del clic')
      throw new Error('no clickable')
    }

    const successRe = /Claim successful|Reclamo exitoso/i
    const failedRe = /Claim failed|Reclamo fallido/i
    let outcome = 'timeout'
    let seenText = ''
    for (let i = 0; i < 60; i++) {
      await sleep(1000)
      if (goodIdUrl) { outcome = 'goodid'; break }
      const body = await page.evaluate(() => document.body?.innerText || '').catch(() => '')
      seenText = body
      if (failedRe.test(body)) { outcome = 'failed'; break }
      if (successRe.test(body)) { outcome = 'claimed'; break }
    }

    const sent = claimTxHash || rpcSends.join(' | ')
    if (outcome === 'goodid') {
      ok(`se abrió GoodID: ${goodIdUrl.slice(0, 120)}`)
      if (sent) {
        await fail(`se envió una transacción con una dirección no verificada: ${sent}`)
      } else {
        ok('no se envió ninguna transacción (la dirección no está verificada)')
      }
      if (/verified=true/i.test(goodIdUrl)) {
        await fail('la URL de GoodID pedía una vuelta ya verificada; debía ser una verificación nueva')
      }
    } else if (outcome === 'failed') {
      await fail(
        'el botón reportó un fallo en vez de abrir GoodID. '
        + `pantalla: ${JSON.stringify(seenText.replace(/\s+/g, ' ').slice(0, 200))} `
        + `| pageErrors: ${pageErrors.slice(0, 2).join(' | ') || 'ninguno'} `
        + `| popups: ${popupUrls.join(' | ') || 'ninguno'} | SDK: ${sdkLogs.slice(0, 3).join(' || ') || 'sin avisos'}`,
      )
    } else if (outcome === 'claimed') {
      await fail('se reportó un reclamo exitoso con una dirección NO verificada (imposible): revisar el flujo')
    } else {
      await fail(
        'ni se abrió GoodID ni hubo error en 60 s. '
        + `pantalla: ${JSON.stringify(seenText.replace(/\s+/g, ' ').slice(0, 200))} `
        + `| tx: ${sent || 'ninguna'} | popups: ${popupUrls.join(' | ') || 'ninguno'} `
        + `| pageErrors: ${pageErrors.slice(0, 2).join(' | ') || 'ninguno'} | SDK: ${sdkLogs.slice(0, 3).join(' || ') || 'sin avisos'}`,
      )
    }
  } finally {
    await browser.close()
  }

  const failures = summary(t0)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((e) => { console.error('FATAL', e?.message || e); process.exit(1) })
