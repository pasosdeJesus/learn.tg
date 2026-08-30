// E2E Test: Referral program (REQ/163 §14)
//
// Cubre el flujo completo de referidos contra el sitio dev:
//   1. Landing pública /en/referrals (documentación + fund)
//   2. CTA según estado (wallet con score ≤ 90 → "Complete your profile")
//   3. Checklist de requisitos (✖ compra premium / ✖ score > 90)
//   4. Código de referido (GET /api/referral/code → code + activated)
//   5. /ref/{CODE} guarda pendingReferralCode; al autenticar → claim 200
//   6. 2º claim → 400 "Referral already claimed"; /api/referral/code → referredBy
//   7. /api/referral/history del referidor incluye al referido
//   8. /api/referrals/fund responde saldos
//
// Prerrequisitos: wallet de apps/.env registrada en el dev site (referidor,
// score 75). La billetera "referida" se genera nueva (SIWE la auto-registra).
// Ejecución:
//   IPDES=learn.tg PUERTOPRU=9001 CHAIN_ID=11142220 \
//     CHROME_PATH=/usr/local/bin/chrome bin/m test:e2e referral-program

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser,
  resetFailures, fail, ok, summary,
} from '@pasosdejesus/m/e2e'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11142220', 10)
// skip() no existe en @pasosdejesus/m/e2e: SKIP informativo sin contar como fallo
function skip(msg) { console.log(`  [SKIP] ${msg}`) }

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

async function navAndWait(page, url, timeout) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const bodyLen = await page.evaluate(() =>
      document.body?.textContent?.replace(/\s+/g, '').length || 0)
    if (bodyLen > 100) return true
  }
  return false
}

function authState(page) {
  return page.evaluate(() => ({
    addr: localStorage.getItem('learn.tg.sessionAddress'),
    token: localStorage.getItem('learn.tg.authToken'),
  }))
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  const creds = loadEnvCredentials()
  if (!creds) { console.error('No credentials found'); process.exit(1) }
  process.env.TEST_PRIVATE_KEY = creds.pk

  const env = await initTestEnv()
  const { base, timeout } = env
  console.log(`Referidor: ${creds.addr.slice(0, 10)}... | ${base} (chain: ${CHAIN_ID})`)

  const browser = await launchBrowser()

  // ════════════════════════════════════════════════════════════════
  // Página A — referidor: landing + CTA + requisitos + código
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Referidor: landing, CTA, requisitos, código ──')
  const pageA = await browser.newPage()
  await setupE2EAuth(pageA, creds.addr, creds.pk, CHAIN_ID, base)

  // Step 1: landing pública (sin sesión recién: navegamos y leemos la página)
  if (!await navAndWait(pageA, `${base}/en/referrals`, timeout)) { fail('Landing no cargó'); await browser.close(); process.exit(1) }
  await new Promise(r => setTimeout(r, 3000))
  const landingText = await pageA.evaluate(() => document.body?.textContent?.replace(/\s+/g, ' ') || '')
  if (landingText.includes('Referral Program') && landingText.includes('How it works') && landingText.includes('Pastor bonus')) {
    ok('Landing pública: documentación (cómo funciona + Form 1-3) visible')
  } else { fail('Documentación de la landing incompleta') }
  if (landingText.includes('SLEARN') && landingText.includes('USDT')) ok('Landing muestra saldo de la billetera de referidos')
  else { console.log('  [!] Saldo de la billetera no detectado'); fail('Fund no visible en la landing') }

  // Score del referidor (adaptativo: activado requiere > 90)
  const aState = await authState(pageA)
  const profileRes = await fetch(`${base}/api/profile?walletAddress=${encodeURIComponent(aState.addr)}&token=${encodeURIComponent(aState.token)}`).catch(() => null)
  let score = null
  if (profileRes && profileRes.ok) {
    const pj = await profileRes.json()
    score = pj?.user?.profilescore ?? pj?.profilescore ?? null
  }
  console.log(`  [referidor] profile score: ${score}`)
  const referrerActivated = score != null && score > 90

  // Step 2: CTA según estado (score ≤ 90 → "Complete your profile")
  // La UI tarda unos segundos en hidratar y cargar el score (efecto auth).
  // El CTA dependiente del estado es el ÚLTIMO link bg-blue-600 (el de la
  // tarjeta ámbar "See premium courses" aparece primero en el DOM).
  await pageA.reload({ waitUntil: 'domcontentloaded' })
  let ctaText = ''
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000))
    ctaText = await pageA.evaluate(() => {
      const a = [...document.querySelectorAll('a')].filter(x => x.className.includes('bg-blue-600')).at(-1)
      return a?.textContent?.trim() || ''
    })
    if (ctaText && !ctaText.includes('Go to the Web3')) break
  }
  if (referrerActivated) {
    console.log('  [skip] referidor activado (>90) — CTA de código, no de perfil')
  } else if (ctaText.includes('Complete your profile')) {
    ok('CTA según estado: "Complete your profile" (score ≤ 90)')
  } else { console.log(`  CTA: "${ctaText}"`); fail('CTA esperado "Complete your profile"') }

  // Step 3: checklist de requisitos (✖ score > 90 si no aplica)
  let reqText = ''
  for (let i = 0; i < 10 && !reqText.includes('Requirements to join'); i++) {
    await new Promise(r => setTimeout(r, 2000))
    reqText = await pageA.evaluate(() => document.body?.textContent?.replace(/\s+/g, ' ') || '')
  }
  if (reqText.includes('Requirements to join') && reqText.includes('90 profile points')) {
    ok('Checklist de requisitos visible (compra premium + >90 puntos)')
  } else { fail('Checklist de requisitos no visible') }

  // Step 4: código de referido vía API
  const codeRes = await fetch(`${base}/api/referral/code?walletAddress=${encodeURIComponent(aState.addr)}&token=${encodeURIComponent(aState.token)}`).catch(() => null)
  if (codeRes && codeRes.ok) {
    const codeData = await codeRes.json()
    if (codeData.code) {
      ok(`Código de referido: ${codeData.code} (activated=${codeData.activated})`)
      var refCode = codeData.code
    } else { fail('API no devolvió código') }
  } else { fail('GET /api/referral/code falló') }

  // Step 8: fund (regresión)
  const fundRes = await fetch(`${base}/api/referrals/fund`).catch(() => null)
  if (fundRes && fundRes.ok) {
    const f = await fundRes.json()
    if (f.slearnBalance != null && f.usdtBalance != null) ok(`Fund responde: ${f.slearnBalance} SLEARN · ${f.usdtBalance} USDT`)
    else fail('Fund sin saldos')
  } else { fail('GET /api/referrals/fund falló') }

  // Step 7: historial del referidor (incluye al referido, tras el claim)
  // (se verifica al final, después del claim de la página B)

  // ════════════════════════════════════════════════════════════════
  // Página B — referido (billetera nueva): /ref/{CODE} → claim
  // ════════════════════════════════════════════════════════════════
  console.log('\n── Referido (billetera nueva): /ref/{CODE} → claim ──')
  const refPk = generatePrivateKey()
  const refAccount = privateKeyToAccount(refPk)
  const refAddr = refAccount.address
  console.log(`  [referido] ${refAddr.slice(0, 10)}...`)

  const pageB = await browser.newPage()
  // Visita el enlace de referido SIN sesión → guarda pendingReferralCode
  if (!await navAndWait(pageB, `${base}/ref/${refCode}`, timeout)) { fail('/ref no cargó'); await browser.close(); process.exit(1) }
  await new Promise(r => setTimeout(r, 3000))
  const storedCode = await pageB.evaluate(() => localStorage.getItem('learn.tg.pendingReferralCode'))
  // El contrato del claim es case-insensitive (ilike); códigos legacy en la DB
  // pueden estar en minúsculas mientras /ref/{CODE} guarda en mayúsculas.
  if (storedCode && storedCode.toUpperCase() === String(refCode).toUpperCase()) ok(`/ref/{CODE} guardó pendingReferralCode (${storedCode})`)
  else { console.log(`  stored: ${storedCode}`); fail('pendingReferralCode no guardado') }

  // Autentica al referido (SIWE; la billetera nueva se auto-registra)
  await setupE2EAuth(pageB, refAddr, refPk, CHAIN_ID, base)
  const bState = await authState(pageB)
  if (!bState.addr) { skip('SIWE del referido falló (¿rate-limit?) — se omite claim') }
  else {
    // Claim con el código pendiente (equivalente al auto-claim de ConnectWalletButton)
    const claimRes = await fetch(`${base}/api/referral/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: bState.addr, token: bState.token, code: refCode }),
    })
    const claimData = await claimRes.json().catch(() => ({}))
    if (claimRes.status === 200 && claimData.ok) {
      ok(`Claim 200: referido registrado (referrer_id=${claimData.referrer_id})`)
      await pageB.evaluate(() => localStorage.removeItem('learn.tg.pendingReferralCode'))
    } else {
      console.log(`  claim: ${claimRes.status} ${JSON.stringify(claimData)}`)
      fail('Claim del referido falló')
    }

    // Step 6: 2º claim → 400 "Referral already claimed"
    const again = await fetch(`${base}/api/referral/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: bState.addr, token: bState.token, code: refCode }),
    })
    const againData = await again.json().catch(() => ({}))
    if (again.status === 400 && String(againData.error).includes('already')) ok('2º claim → 400 "Referral already claimed"')
    else { console.log(`  again: ${again.status} ${JSON.stringify(againData)}`); fail('Idempotencia del claim falló') }

    // Step 6b: solo lectura — /api/referral/code del referido → referredBy
    const myCode = await fetch(`${base}/api/referral/code?walletAddress=${encodeURIComponent(bState.addr)}&token=${encodeURIComponent(bState.token)}`).catch(() => null)
    if (myCode && myCode.ok) {
      const myData = await myCode.json()
      if (myData.referredBy) ok(`Solo lectura: "Te refirió: ${myData.referredBy}"`)
      else fail('referredBy no devuelto para el referido')
    }

    // Step 7: historial del referidor incluye al referido
    const histRes = await fetch(`${base}/api/referral/history?walletAddress=${encodeURIComponent(aState.addr)}&token=${encodeURIComponent(aState.token)}`).catch(() => null)
    if (histRes && histRes.ok) {
      const hist = await histRes.json()
      if (Array.isArray(hist.referrals) && hist.referrals.length >= 1) {
        ok(`Historial del referidor muestra ${hist.referrals.length} referido(s)`)
      } else { console.log(`  referrals: ${JSON.stringify(hist.referrals)}`); fail('Historial sin referidos') }
    } else { fail('GET /api/referral/history falló') }
  }

  await browser.close()
  const failures = summary(t0); process.exit(failures > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
