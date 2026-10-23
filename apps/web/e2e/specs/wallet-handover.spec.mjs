#!/usr/bin/env node
// E2E: R-#288 — la billetera in-app se agrega a una cuenta **verificada** existente y
// la cuenta duplicada (la que creó la billetera in-app) se borra.
//
// Escenario entre dispositivos, con dos contextos aislados:
//   A (duplicado): billetera nueva, sin perfil verificado. Desde el perfil pide
//     "Ya tengo una cuenta verificada" y escribe la billetera vieja.
//   B (verificada): la cuenta de prueba de `apps/.env` (perfil ≥ 50). Ve la solicitud
//     en el perfil, la acepta firmando un SIWE con esa billetera.
//
// Comprueba:
//   1. La solicitud se crea y **no** exige 50 puntos al duplicado.
//   2. La cuenta verificada ve la solicitud (`receivedInvitations` y la UI).
//   3. Al aceptar: la billetera in-app queda en la cuenta verificada, el perfil de la
//      verificada no cambia (mismo id y puntaje) y la cuenta duplicada ya no puede
//      iniciar sesión.
//   4. Limpieza: desvincula la billetera para no dejar basura (salvo HANDOVER_KEEP=1).
//
// NO corre contra producción: borra una cuenta.
//
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//   CHAIN_ID=11142220 node e2e/specs/wallet-handover.spec.mjs
//
//   SITE_URL=http://localhost:4000 IPDES=localhost PUERTOPRU=4000 CHAIN_ID=11142220 \
//   CHROME_PATH=/usr/local/bin/chrome node e2e/specs/wallet-handover.spec.mjs

import * as fs from 'fs'
import * as path from 'path'
import {
  fail, initTestEnv, launchBrowser, newIncognitoContext, ok, resetFailures,
  setupFullWalletMock, summary,
} from '@pasosdejesus/m/e2e'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { signInWithCoreWallet } from '../helpers/in-app-wallet.mjs'

const LANG = 'en'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Cuenta de prueba del `.env` (la misma de los demás specs). */
function loadEnvCredentials() {
  for (const envPath of [
    path.join(process.cwd(), '..', '.env'),
    path.join(process.cwd(), 'apps', '.env'),
    path.join(process.cwd(), '.env'),
  ]) {
    if (!fs.existsSync(envPath)) continue
    const contents = fs.readFileSync(envPath, 'utf8')
    const pk = contents.match(/PRIVATE_KEY="([^"]+)"/)?.[1] || contents.match(/PRIVATE_KEY=(\S+)/)?.[1]
    const addr = contents.match(/NEXT_PUBLIC_ADDRESS="([^"]+)"/)?.[1] || contents.match(/NEXT_PUBLIC_ADDRESS=(\S+)/)?.[1]
    if (pk && addr) return { pk, addr }
  }
  return null
}

async function api(page, url, init) {
  return page.evaluate(
    async ({ url, init }) => {
      try {
        const response = await fetch(url, init)
        const text = await response.text()
        let body = null
        try { body = JSON.parse(text) } catch { body = text.slice(0, 200) }
        return { status: response.status, body }
      } catch (error) {
        return { status: 0, body: String(error) }
      }
    },
    { url, init },
  )
}

async function waitFor(page, selector, attempts = 45) {
  for (let i = 0; i < attempts; i++) {
    if (await page.$(selector).catch(() => null)) return true
    await sleep(1000)
  }
  return false
}

async function waitForText(page, selector, pattern, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    const text = await page.$eval(selector, (el) => el.innerText).catch(() => '')
    if (pattern.test(text)) return text
    await sleep(1000)
  }
  return page.$eval(selector, (el) => el.innerText).catch(() => '')
}

function walletsOf(result) {
  return (result.body?.wallets ?? []).map((entry) => String(entry.billetera).toLowerCase())
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const base = process.env.SITE_URL || env.base

  if (/^https:\/\/learn\.tg\/?$/.test(base)) {
    console.log(`[SKIP] ${base} es producción; este spec borra una cuenta duplicada`)
    process.exit(0)
  }

  const creds = loadEnvCredentials()
  if (!creds) {
    console.log('[SKIP] no hay billetera de prueba en apps/.env')
    process.exit(0)
  }

  const duplicatePk = generatePrivateKey()
  const duplicateAddress = privateKeyToAccount(duplicatePk).address
  const verifiedAddress = creds.addr.toLowerCase()
  const browser = await launchBrowser(env.headless)

  console.log(`Handover de billetera (R-#288) | ${base}`)
  console.log(`  duplicado: ${duplicateAddress}`)
  console.log(`  verificada: ${verifiedAddress}\n`)

  try {
    // ── A: la cuenta duplicada (billetera nueva, sin perfil) ────────────────
    const ctxA = await newIncognitoContext(browser)
    const pageA = await ctxA.newPage()
    pageA.setDefaultNavigationTimeout(180000)
    await setupFullWalletMock(pageA, {
      privateKey: duplicatePk,
      address: duplicateAddress,
      chainId: env.chainId,
    })
    await pageA.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
    await signInWithCoreWallet(pageA, {
      privateKey: duplicatePk,
      address: duplicateAddress,
      chainId: env.chainId,
      baseUrl: base,
    })
    // The sign-in is API-level: reload so SessionProvider reads the new cookie (the
    // profile gates its content on `session.address`, known issue #5719).
    await pageA.reload({ waitUntil: 'domcontentloaded' })

    const duplicateProfile = await api(pageA, `/api/profile?walletAddress=${duplicateAddress.toLowerCase()}`)
    if (duplicateProfile.status !== 200 || Number(duplicateProfile.body?.profilescore ?? 0) >= 50) {
      console.log(`[SKIP] el duplicado no quedó sin verificar: ${JSON.stringify(duplicateProfile).slice(0, 200)}`)
      await ctxA.close()
      process.exit(0)
    }

    await pageA.goto(`${base}/${LANG}/profile`, { waitUntil: 'domcontentloaded' })
    if (!(await waitFor(pageA, '[data-testid="handover-open"]'))) {
      console.log('[SKIP] el perfil no ofrece "Ya tengo una cuenta verificada" (función no desplegada)')
      await ctxA.close()
      process.exit(0)
    }

    await pageA.click('[data-testid="handover-open"]').catch(() => {})
    await pageA.waitForSelector('[data-testid="handover-address"]', { timeout: 15000 })
    await pageA.type('[data-testid="handover-address"]', verifiedAddress)
    await pageA.click('[data-testid="handover-send"]').catch(() => {})
    // The banner is informative; the authoritative check is the pending invitation.
    const sent = await waitForText(
      pageA,
      '[data-testid="handover-message"]',
      /request sent|solicitud enviada|not verified|no está verificada|failed|no se pudo/i,
    )
    if (/not verified|no está verificada/i.test(sent)) {
      console.log(`[SKIP] la cuenta de prueba no está verificada: "${sent}"`)
      await ctxA.close()
      process.exit(0)
    }
    if (/request sent|solicitud enviada/i.test(sent)) {
      ok(`Solicitud enviada desde el duplicado: "${sent}"`)
    } else {
      console.log(`[INFO] mensaje de la UI: "${sent}" (se valida por API)`)
    }

    const pending = await api(
      pageA,
      `/api/wallet?walletAddress=${duplicateAddress.toLowerCase()}`,
    )
    const pendingTargets = (pending.body?.invitations ?? []).map((entry) =>
      String(entry.direccion_invitada).toLowerCase(),
    )
    if (pendingTargets.includes(verifiedAddress)) {
      ok('La solicitud pendiente aparece en GET /api/wallet del duplicado')
    } else {
      fail(`No hay solicitud pendiente: ${JSON.stringify(pending).slice(0, 300)}`)
    }

    // ── B: la cuenta verificada (billetera del `.env`) ─────────────────────
    const ctxB = await newIncognitoContext(browser)
    const pageB = await ctxB.newPage()
    pageB.setDefaultNavigationTimeout(180000)
    await setupFullWalletMock(pageB, {
      privateKey: creds.pk,
      address: creds.addr,
      chainId: env.chainId,
    })
    await pageB.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
    await signInWithCoreWallet(pageB, {
      privateKey: creds.pk,
      address: creds.addr,
      chainId: env.chainId,
      baseUrl: base,
    })
    await pageB.reload({ waitUntil: 'domcontentloaded' })

    const beforeProfile = await api(pageB, `/api/profile?walletAddress=${verifiedAddress}`)
    if (beforeProfile.status !== 200 || Number(beforeProfile.body?.profilescore ?? 0) < 50) {
      console.log(`[SKIP] la billetera de apps/.env no está verificada en este sitio: ${JSON.stringify(beforeProfile).slice(0, 200)}`)
      await ctxA.close()
      await ctxB.close()
      process.exit(0)
    }
    const beforeId = beforeProfile.body?.id
    const beforeScore = Number(beforeProfile.body?.profilescore ?? 0)

    const overview = await api(
      pageB,
      `/api/wallet?walletAddress=${encodeURIComponent(verifiedAddress)}`,
    )
    const received = overview.body?.receivedInvitations ?? []
    const duplicateId = Number(duplicateProfile.body?.id)
    // `direccion_invitada` is the verified wallet (the target); the requester is the
    // duplicate account and its wallet comes in `duplicate_wallet`.
    if (
      received.some((entry) => Number(entry.duplicate_id) === duplicateId) &&
      received.some(
        (entry) =>
          String(entry.duplicate_wallet ?? '').toLowerCase() ===
          duplicateAddress.toLowerCase(),
      )
    ) {
      ok('GET /api/wallet de la cuenta verificada lista la solicitud recibida')
    } else {
      fail(`La solicitud no aparece en receivedInvitations: ${JSON.stringify(overview).slice(0, 300)}`)
    }
    if (overview.body?.verified === true) {
      ok('La cuenta de la billetera de prueba está verificada')
    } else {
      fail('GET /api/wallet no marca la cuenta como verificada')
    }

    // La UI de la cuenta verificada muestra la solicitud y la acepta firmando.
    await pageB.goto(`${base}/${LANG}/profile`, { waitUntil: 'domcontentloaded' })
    if (!(await waitFor(pageB, '[data-testid="handover-request"]'))) {
      fail('El perfil de la cuenta verificada no muestra la solicitud de handover')
    } else {
      await pageB.click('[data-testid="handover-accept"]').catch(() => {})
      const accepted = await waitForText(
        pageB,
        '[data-testid="handover-message"]',
        /wallet added|billetera agregada|transactions|transacciones|failed|no se pudo/i,
      )
      if (/wallet added|billetera agregada/i.test(accepted)) {
        ok(`Handover aceptado desde el perfil: "${accepted}"`)
      } else {
        fail(`El handover no se completó: "${accepted}"`)
      }
    }

    const afterWallets = await api(
      pageB,
      `/api/wallet?walletAddress=${encodeURIComponent(verifiedAddress)}`,
    )
    const wallets = walletsOf(afterWallets)
    if (
      afterWallets.status === 200 &&
      wallets.includes(verifiedAddress) &&
      wallets.includes(duplicateAddress.toLowerCase())
    ) {
      ok('La cuenta verificada conserva su billetera y ahora tiene la in-app')
    } else {
      fail(`Billeteras de la cuenta verificada: ${JSON.stringify(afterWallets).slice(0, 300)}`)
    }

    const afterProfile = await api(pageB, `/api/profile?walletAddress=${verifiedAddress}`)
    if (
      afterProfile.status === 200 &&
      afterProfile.body?.id === beforeId &&
      Number(afterProfile.body?.profilescore ?? 0) === beforeScore
    ) {
      ok('El perfil de la cuenta verificada no cambió (mismo id y puntaje)')
    } else {
      fail(`El perfil de la verificada cambió: ${JSON.stringify(afterProfile).slice(0, 300)}`)
    }

    // La cuenta duplicada ya no existe: su cookie apunta a un usuario borrado.
    const deadProfile = await api(pageA, `/api/profile?walletAddress=${duplicateAddress.toLowerCase()}`)
    const deadWallet = await api(
      pageA,
      `/api/wallet?walletAddress=${duplicateAddress.toLowerCase()}`,
    )
    // NextAuth keeps answering `/api/auth/session` from the cookie, so the check is the
    // database-backed routes: both must reject the deleted account.
    if (deadProfile.status === 401 && deadWallet.status === 401) {
      ok('La cuenta duplicada fue borrada: perfil y billeteras responden 401')
    } else {
      fail(
        `La cuenta duplicada sigue viva: profile=${deadProfile.status} wallet=${deadWallet.status}`,
      )
    }

    // ── Limpieza (salvo HANDOVER_KEEP=1) ───────────────────────────────────
    if (process.env.HANDOVER_KEEP === '1') {
      console.log('[INFO] HANDOVER_KEEP=1: se conserva la billetera adoptada')
    } else {
      const unlink = await api(pageB, '/api/wallet/unlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: verifiedAddress, address: duplicateAddress }),
      })
      if (unlink.status === 200 && !walletsOf(unlink).includes(duplicateAddress.toLowerCase())) {
        ok('Limpieza: la billetera adoptada fue desvinculada')
      } else {
        fail(`La limpieza no desvinculó la billetera: ${JSON.stringify(unlink).slice(0, 300)}`)
      }
    }

    await ctxA.close()
    await ctxB.close()
  } catch (error) {
    fail(`Excepción: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    await browser.close()
  }

  const failures = summary(t0)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
