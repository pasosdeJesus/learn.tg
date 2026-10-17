#!/usr/bin/env node
// E2E: invitación de una billetera **entre dispositivos** (R-#265 §3.2).
//
// Escenario: la cuenta A invita una **dirección** desde su dispositivo; esa billetera
// (nueva, con su propia clave) abre learn.tg en **otro** contexto de navegador, firma y
// acepta al entrar. El ingreso normal se rechaza a propósito (una billetera invitada no
// crea su propia cuenta), así que el cliente consulta la invitación, pide confirmación
// explícita, la enlaza y **reintenta con la misma firma**.
//
// Comprueba:
//   1. A (cuenta de prueba del `.env`, perfil verificado) invita la dirección desde la
//      cabecera y la invitación queda pendiente.
//   2. B entra con esa billetera en otro contexto: el primer callback falla, el cliente
//      acepta la invitación (diálogo de confirmación) y el reintento abre la sesión.
//   3. `GET /api/wallet` de B lista las dos billeteras de la cuenta.
//
// NO corre contra producción: crear una invitación es una escritura. Por defecto apunta
// al sitio de desarrollo (`learn.tg:9001`).
//
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//   CHAIN_ID=11142220 node e2e/specs/wallet-invitation-two-devices.spec.mjs
//
// Contra un servidor local: SITE_URL=http://localhost:4000 …

import * as fs from 'fs'
import * as path from 'path'
import {
  fail, initTestEnv, launchBrowser, newIncognitoContext, ok, resetFailures,
  setupFullWalletMock, summary,
} from '@pasosdejesus/m/e2e'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import {
  connectExternalWallet, signInWithCoreWallet,
} from '../helpers/in-app-wallet.mjs'

const LANG = 'en'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Cuenta de prueba local (`apps/.env`), la misma que usan los demás specs. */
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

async function sessionAddress(page) {
  return page
    .evaluate(async () => {
      const body = await fetch('/api/auth/session').then((r) => r.json()).catch(() => null)
      return body?.address || null
    })
    .catch(() => null)
}

async function accountWallets(page, hint) {
  return page
    .evaluate(async (wallet) => {
      const res = await fetch(`/api/wallet?walletAddress=${encodeURIComponent(wallet)}`)
      if (!res.ok) return { status: res.status, wallets: null, invitations: null }
      const body = await res.json()
      return {
        status: res.status,
        wallets: (body?.wallets ?? []).map((entry) => String(entry.billetera).toLowerCase()),
        invitations: (body?.invitations ?? []).map((entry) => String(entry.direccion_invitada).toLowerCase()),
      }
    }, hint)
    .catch((error) => ({ status: 0, wallets: null, invitations: null, error: String(error) }))
}

async function waitForText(page, selector, pattern, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    const text = await page.$eval(selector, (el) => el.innerText).catch(() => '')
    if (pattern.test(text)) return text
    await sleep(1000)
  }
  return page.$eval(selector, (el) => el.innerText).catch(() => '')
}

/** La cabecera se hidrata tarde: esperar el control de invitación. */
async function waitForInviteControl(page) {
  for (let i = 0; i < 45; i++) {
    if (await page.$('[data-testid="wallet-invite-toggle"]').catch(() => null)) return true
    await sleep(1000)
  }
  return false
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const base = process.env.SITE_URL || env.base

  // Crear invitaciones es una escritura: nunca contra producción.
  if (/^https:\/\/learn\.tg\/?$/.test(base)) {
    console.log(`[SKIP] ${base} es producción; este spec escribe invitaciones`)
    process.exit(0)
  }

  const creds = loadEnvCredentials()
  if (!creds) {
    console.log('[SKIP] no hay billetera de prueba en apps/.env')
    process.exit(0)
  }

  const invitedPk = generatePrivateKey()
  const invitedAddress = privateKeyToAccount(invitedPk).address
  const browser = await launchBrowser(env.headless)

  console.log(`Invitación entre dispositivos | ${base}`)
  console.log(`  invitada: ${invitedAddress}\n`)

  try {
    // ── A: el dispositivo que invita (cuenta de prueba) ─────────────────────
    const ctxA = await newIncognitoContext(browser)
    const pageA = await ctxA.newPage()
    pageA.setDefaultNavigationTimeout(180000)
    await setupFullWalletMock(pageA, {
      privateKey: creds.pk,
      address: creds.addr,
      chainId: env.chainId,
    })

    await pageA.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
    await signInWithCoreWallet(pageA, {
      privateKey: creds.pk,
      address: creds.addr,
      chainId: env.chainId,
      baseUrl: base,
    })
    // Recarga para que la cabecera hidrate con la sesión.
    await pageA.goto(`${base}/${LANG}`, { waitUntil: 'domcontentloaded' })

    if (!(await waitForInviteControl(pageA))) {
      console.log('[SKIP] la cabecera no ofrece invitar billeteras (función no desplegada)')
      await ctxA.close()
      process.exit(0)
    }

    await pageA.click('[data-testid="wallet-invite-toggle"]').catch(() => {})
    await pageA.waitForSelector('[data-testid="wallet-invite-address"]', { timeout: 15000 }).catch(() => {})
    await pageA.type('[data-testid="wallet-invite-address"]', invitedAddress)
    await pageA.click('[data-testid="wallet-invite-submit"]').catch(() => {})
    const message = await waitForText(pageA, '[data-testid="wallet-invite-message"]', /invitation created|invitaci[oó]n creada|50 points|50 puntos/i, 30)

    if (/50 points|50 puntos/i.test(message)) {
      console.log(`[SKIP] la cuenta de prueba no tiene perfil para invitar: "${message}"`)
      await ctxA.close()
      process.exit(0)
    }
    if (!/invitation created|invitaci[oó]n creada/i.test(message)) {
      fail(`La invitación no se creó: "${message}"`)
    } else {
      ok(`Invitación creada desde la cabecera: "${message}"`)
    }

    const inviterView = await accountWallets(pageA, creds.addr)
    if (inviterView.invitations?.includes(invitedAddress.toLowerCase())) {
      ok('La invitación pendiente aparece en GET /api/wallet')
    } else {
      fail(`La invitación no aparece en GET /api/wallet: ${JSON.stringify(inviterView)}`)
    }

    // ── B: el "otro dispositivo" (contexto aislado, clave nueva) ────────────
    const ctxB = await newIncognitoContext(browser)
    const pageB = await ctxB.newPage()
    pageB.setDefaultNavigationTimeout(180000)
    // La confirmación es explícita (`window.confirm`): se acepta como lo haría la persona.
    pageB.on('dialog', (dialog) => { void dialog.accept().catch(() => {}) })
    await setupFullWalletMock(pageB, {
      privateKey: invitedPk,
      address: invitedAddress,
      chainId: env.chainId,
    })

    await pageB.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
    // R-#265 §3.9: el helper abre el modal del motor `WalletConnect` y firma con la
    // billetera externa. Ese primer callback falla (hay invitación pendiente); el
    // cliente consulta, confirma, acepta y reintenta con la misma firma.
    if (!(await connectExternalWallet(pageB))) {
      fail('El dispositivo invitado no pudo iniciar el flujo de la billetera externa')
    } else {
      let address = null
      for (let i = 0; i < 90; i++) {
        await sleep(1000)
        address = await sessionAddress(pageB)
        if (address) break
      }
      if (address && address.toLowerCase() === invitedAddress.toLowerCase()) {
        ok(`La billetera invitada aceptó y entró a la cuenta: ${address.slice(0, 10)}…`)
      } else {
        fail(`El ingreso de la billetera invitada no abrió sesión (address=${address})`)
      }
    }

    const invitedView = await accountWallets(pageB, invitedAddress)
    const expected = [creds.addr.toLowerCase(), invitedAddress.toLowerCase()]
    const got = invitedView.wallets || []
    if (invitedView.status === 200 && expected.every((wallet) => got.includes(wallet)) && got.length === 2) {
      ok('Desde el otro dispositivo, la cuenta muestra las dos billeteras')
    } else {
      fail(`GET /api/wallet en el dispositivo invitado = ${JSON.stringify(invitedView)}`)
    }

    const invitationAfter = await accountWallets(pageA, creds.addr)
    if (invitationAfter.invitations && !invitationAfter.invitations.includes(invitedAddress.toLowerCase())) {
      ok('La invitación dejó de estar pendiente tras aceptarla')
    } else {
      fail(`La invitación sigue pendiente: ${JSON.stringify(invitationAfter.invitations)}`)
    }

    await ctxB.close()
    await ctxA.close()
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
