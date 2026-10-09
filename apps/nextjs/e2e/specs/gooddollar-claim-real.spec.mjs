#!/usr/bin/env node
// E2E REAL de GoodDollar: reclama el UBI diario desde learn.tg con Chrome + Puppeteer
// (https://github.com/pasosdeJesus/learn.tg/issues/271).
//
// Dos modos, elegidos con `GOODDOLLAR_WALLET`:
//
//   in-app (por defecto) — importa TU frase de recuperación (12/24 palabras) **o tu
//     llave privada** en la billetera de learn.tg por la UI, la desbloquea y reclama
//     con ella. Es el camino que queremos que funcione de verdad. Pasa
//     `GOODDOLLAR_MNEMONIC` (cuenta #1) o `GOODDOLLAR_PRIVATE_KEY`.
//     Este modo usa el núcleo compartido `@pasosdejesus/m/wallet` (ya instalado
//     en `apps/nextjs/node_modules`), porque el helper E2E lo importa desde Node
//     (R-#239, doc/environments.md).
//     El proveedor in-app habla con el RPC configurado del sitio: las lecturas y el
//     envío son reales, sin puente extra.
//
//   external — inyecta una billetera EIP-1193 que firma con tu llave privada y un
//     puente RPC real (`setupE2EAuth` + `__rpcReal`, el patrón de
//     `premium-course-checkout`). Requiere `GOODDOLLAR_PRIVATE_KEY`.
//
// Requisitos (cualquiera de los dos modos):
//   1. `PROD_SPECS=1`.
//   2. La dirección (cuenta #1 de la mnemónica, o la de la llave privada) **ya
//      verificada** con GoodDollar y con un poco de CELO para el gas. La verificación
//      facial (FaceTec) NO se puede automatizar: si no está verificada, la spec lo
//      reporta y no hace clic.
//   3. Celo mainnet (`https://learn.tg`, chain 42220): GoodDollar no tiene UBI en Celo
//      Sepolia (el SDK soporta 50/122/42220).
//
// El UBI es uno por día: si ya se reclamó hoy, la spec termina en verde sin clic.
//
// Ejecución (máquina con Chrome y el secreto en el entorno):
//   cd apps/nextjs
//   PROD_SPECS=1 GOODDOLLAR_MNEMONIC="palabra ... palabra" \
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=443 CHAIN_ID=42220 \
//   SITE_URL=https://learn.tg \
//     bin/m test:e2e gooddollar-claim-real
//
//   # modo externo:
//   PROD_SPECS=1 GOODDOLLAR_WALLET=external GOODDOLLAR_PRIVATE_KEY=0x... ... bin/m test:e2e gooddollar-claim-real

import { fail, gotoWithRetry, initTestEnv, launchBrowser, newIncognitoContext, ok, resetFailures, resolveSiteTarget, summary } from '@pasosdejesus/m/e2e'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'
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
const ubiAbi = parseAbi([
  'function checkEntitlement(address) view returns (uint256)',
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
 * Espera a que la sesión de la billetera in-app quede establecida. El SIWE de la
 * importación hace `window.location.reload()`, así que se miran las dos señales que
 * deja: la cabecera (`wallet-selector-in-app`, que el componente decide por
 * `sessionAddress`) y la propia clave en `localStorage`.
 */
async function waitForInAppSession(page, address, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const state = await page
      .evaluate(() => ({
        stored: (localStorage.getItem('learn.tg.sessionAddress') || '').toLowerCase(),
        header: !!document.querySelector('[data-testid="wallet-selector-in-app"]'),
      }))
      .catch(() => ({ stored: '', header: false }))
    if (state.stored === address.toLowerCase() || state.header) return true
    await sleep(1000)
  }
  return false
}

/**
 * Desbloquea la billetera in-app por la UI. Tras el SIWE la página recarga y la clave
 * sale de memoria, así que queda bloqueada: sin desbloquear, el botón de GoodDollar
 * se queda en `data-reason="locked"` y sólo ofrece el diálogo.
 */
async function unlockInAppWallet(page) {
  const { TEST_PASSWORD } = await import('../helpers/in-app-wallet.mjs')
  await page.click('[data-testid="wallet-open-dialog"]').catch(() => {})
  await page.waitForSelector('[data-testid="wallet-password"]', { timeout: 8000 }).catch(() => null)
  await page.type('[data-testid="wallet-password"]', TEST_PASSWORD).catch(() => {})
  await page.click('[data-testid="wallet-unlock"]').catch(() => {})
  await sleep(2500)
}

/**
 * Espera a que el botón quede listo (`reason=ready`) y resuelva su acción: la lectura
 * on-chain es asíncrona, así que al aparecer el nodo el estado todavía es `idle`. Si
 * la billetera quedó bloqueada se desbloquea hasta 3 veces. Un build sin
 * `data-action` se devuelve tal cual: esa parte no se puede medir y la spec lo reporta.
 */
async function waitForReadyButton(page, timeoutMs, unlockFn) {
  const deadline = Date.now() + timeoutMs
  let unlocks = 0
  let info = await page.evaluate(findClaimButton)
  while (info && Date.now() < deadline) {
    if (info.byTestId && info.reason === 'ready' && info.action !== 'idle') return info
    if (info.byTestId && info.reason === 'locked' && unlocks < 3) {
      unlocks++
      await unlockFn()
    }
    await sleep(1000)
    info = await page.evaluate(findClaimButton)
  }
  return info
}

/** Importa la mnemónica en la billetera in-app de learn.tg por la UI y la desbloquea. */
async function importInAppWallet(page, { mnemonic, privateKey, timeout }) {
  // Import diferido a propósito: `in-app-wallet.mjs` carga `@pasosdejesus/m/wallet`
  // (→ `viem`), que en Node resuelve desde `apps/nextjs/node_modules`. El modo
  // `external` no debe necesitarlo, así que el helper se carga únicamente cuando se
  // usa la in-app.
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
    console.log('[SKIP] escribe en producción (reclama GoodDollar en Celo mainnet): ejecutar con PROD_SPECS=1')
    process.exit(0)
  }

  const mode = (process.env.GOODDOLLAR_WALLET || 'in-app').toLowerCase()
  const mnemonic = process.env.GOODDOLLAR_MNEMONIC
  const rawPk = process.env.GOODDOLLAR_PRIVATE_KEY

  if (mode === 'in-app' && !mnemonic && !rawPk) {
    console.log('[SKIP] modo in-app: falta GOODDOLLAR_MNEMONIC o GOODDOLLAR_PRIVATE_KEY')
    process.exit(0)
  }
  if (mode === 'external' && !rawPk) {
    console.log('[SKIP] modo external: falta GOODDOLLAR_PRIVATE_KEY')
    process.exit(0)
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

  // ── Pre-chequeo on-chain (sin navegador) ──
  let root
  try {
    root = await publicClient.readContract({
      address: IDENTITY, abi: identityAbi, functionName: 'getWhitelistedRoot', args: [account.address],
    })
  } catch (e) {
    fail(`no se pudo leer la whitelist de GoodDollar en ${DEFAULT_RPC}: ${e instanceof Error ? e.message : e}`)
    process.exit(summary(t0) > 0 ? 1 : 0)
  }
  if (root === zeroAddress) {
    fail(
      'la dirección NO está verificada con GoodDollar (whitelist vacía): la verificación facial (FaceTec) es manual. ' +
      'Verifícala desde learn.tg (botón de GoodDollar → Verify) o desde gooddapp.org y vuelve a correr la spec',
    )
    process.exit(summary(t0) > 0 ? 1 : 0)
  }
  ok(`dirección verificada con GoodDollar (root ${root.slice(0, 10)}…)`)

  const entitledBefore = await publicClient.readContract({
    address: UBISCHEME, abi: ubiAbi, functionName: 'checkEntitlement', args: [root],
  })
  if (entitledBefore === BigInt(0)) {
    ok('ya se reclamó el UBI de hoy (checkEntitlement = 0): nada que hacer, verde')
    process.exit(0)
  }
  ok(`UBI disponible hoy: ${entitledBefore} (unidades mínimas)`)

  const balance = await publicClient.getBalance({ address: account.address }).catch(() => BigInt(0))
  console.log(`  CELO para gas: ${balance}`)
  if (balance === BigInt(0)) {
    fail('la dirección no tiene CELO para el gas del claim')
    process.exit(summary(t0) > 0 ? 1 : 0)
  }

  // ── Navegador ──
  // Contexto de incógnito (perfil limpio) en vez de borrar `localStorage` en cada
  // documento: el SIWE de la importación recarga la página, y un
  // `evaluateOnNewDocument` que limpiara al arrancar borraría la sesión recién creada.
  const browser = await launchBrowser()
  const context = await newIncognitoContext(browser)
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 200)))
  const guideProbe = attachGuideProbe(page)
  let claimTxHash = ''

  try {
    if (mode === 'in-app') {
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
    const info = await waitForReadyButton(page, 60000, () => unlockInAppWallet(page))
    const guideNote = found.guide
      ? ` | /api/guide ${found.guide.status} markdown=${found.guide.hasMarkdown} hasButton=${found.guide.hasButton}`
      : ''
    ok(`botón de GoodDollar encontrado en ${found.path} (data-reason = ${info.reason}, data-action = ${info.action}, disabled = ${info.disabled})${guideNote}`)

    if (info.byTestId && info.action !== 'direct-claim') {
      await fail(
        `una dirección verificada y con beca debe resolver a "direct-claim", pero resolvió a "${info.action}". `
        + `texto: ${JSON.stringify(info.text)}`,
      )
      throw new Error('wrong action')
    }

    if (info.reason !== 'ready' && info.reason !== 'unknown') {
      await fail(`el botón no está listo para reclamar: data-reason = ${info.reason} (la spec esperaba "ready")`)
      throw new Error('not ready')
    }
    if (info.disabled) {
      await fail(`el botón está deshabilitado (data-reason = ${info.reason}): con un build anterior eso puede ser el SDK sin proveedor (billetera bloqueada)`)
      throw new Error('disabled')
    }

    // Por si la whitelist on-chain no alcanzara y el flujo abra la verificación GoodID.
    let goodIdOpened = false
    const popupUrls = []
    const sdkLogs = []
    page.on('framenavigated', (f) => {
      if (f === page.mainFrame() && /goodid/i.test(f.url())) {
        goodIdOpened = true
        popupUrls.push(`main → ${f.url()}`)
      }
    })
    page.on('popup', (p) => {
      popupUrls.push(`popup → ${p.url()}`)
      if (/goodid/i.test(p.url())) goodIdOpened = true
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
    for (let i = 0; i < 60; i++) {
      await sleep(1500)
      const body = await page.evaluate(() => document.body?.innerText || '')
      if (successRe.test(body)) { outcome = 'success'; break }
      if (failedRe.test(body)) { outcome = 'failed'; break }
      if (goodIdOpened) { outcome = 'verification'; break }
      const after = await publicClient.readContract({
        address: UBISCHEME, abi: ubiAbi, functionName: 'checkEntitlement', args: [root],
      }).catch(() => entitledBefore)
      if (after === BigInt(0)) { outcome = 'claimed-on-chain'; break }
    }

    if (outcome === 'verification') {
      await fail(
        'el flujo abrió la verificación de GoodID (la verificación facial FaceTec es manual). '
        + `popups: ${popupUrls.join(' | ') || 'ninguno'}`
        + ` | tx: ${claimTxHash || 'no enviada'}`
        + ` | SDK: ${sdkLogs.slice(0, 4).join(' || ') || 'sin avisos'}`,
      )
    } else if (outcome === 'failed') {
      await fail(`el botón reportó un fallo (revisa el toast/consola). pageErrors: ${pageErrors.slice(0, 2).join(' | ')} | SDK: ${sdkLogs.slice(0, 3).join(' || ')}`)
    } else if (outcome === 'timeout') {
      await fail(`no se confirmó el reclamo (tx: ${claimTxHash || 'no capturada'}). popups: ${popupUrls.join(' | ') || 'ninguno'} | SDK: ${sdkLogs.slice(0, 3).join(' || ') || 'sin avisos'}`)
    } else {
      ok(`reclamo confirmado (${outcome}${claimTxHash ? `, tx ${claimTxHash}` : ''})`)
      if (claimTxHash) console.log(`  https://celoscan.io/tx/${claimTxHash}`)
    }
  } finally {
    await browser.close()
  }

  const failures = summary(t0)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((e) => { console.error('FATAL', e?.message || e); process.exit(1) })
