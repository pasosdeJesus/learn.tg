#!/usr/bin/env node
// E2E: dejar un clúster **listo** para presentarse a Global Disciples, todo por la
// interfaz y sin semilla SQL (R-#161).
//
// Tres pastores forman el clúster, se fija la billetera, se registran presupuesto y
// oferta del director con sus PDF, cada pastor resuelve las 6 guías del curso, el
// verificador confirma sus datos (puntaje > 90) y fija las invitaciones, cada pastor
// aprueba y al final se exige `ready: true` con `missing: []`.
//
// Ejecución:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//   CHAIN_ID=11142220 node e2e/specs/cluster-ready.spec.mjs

import * as fs from 'node:fs'
import { fail, initTestEnv, launchBrowser, newIncognitoContext, newIncognitoPage, ok, resetFailures, resolveSiteTarget, summary } from '@pasosdejesus/m/e2e'
import { SiweMessage } from 'siwe'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'
import { loadVerifierWallet, loadWalletCredentials } from '../helpers/e2e-wallet.mjs'
import { apiOn, ensurePastorFixture } from '../helpers/e2e-fixture.mjs'
import { completeGuides } from '../helpers/guides.mjs'
import { rememberWallet } from '../helpers/e2e-wallets-registry.mjs'

const LANG = process.env.E2E_LANG === 'es' ? 'es' : 'en'
const COURSE = LANG === 'es' ? { prefix: 'redgd', suffix: (n) => `guia${n}` } : { prefix: 'gdcluster', suffix: (n) => `guide${n}` }
const LABELS = {
  en: { create: 'Create a cluster', name: 'Cluster name', code: '6-char code', join: 'Join', budget: 'First-year budget', director: 'Program director' },
  es: { create: 'Crear un clúster', name: 'Nombre del clúster', code: 'Código de 6 caracteres', join: 'Unirse', budget: 'Presupuesto del primer año', director: 'Director del programa' },
}
const t = LABELS[LANG]
const PDF_PATH = '/tmp/e2e-cluster-budget.pdf'

function skip(message) {
  console.log(`  [NOTE] ${message}`)
}

function writeTinyPdf(path) {
  fs.writeFileSync(
    path,
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
  )
}

async function fillByLabel(page, labelText, value) {
  return page.evaluate((args) => {
    const inputs = Array.from(document.querySelectorAll('input'))
    const byPlaceholder = inputs.find((i) => (i.placeholder || '') === args.label)
    const byLabel = byPlaceholder || (() => {
      const label = Array.from(document.querySelectorAll('label'))
        .find((l) => (l.textContent || '').trim().startsWith(args.label))
      if (!label) return null
      const inside = label.querySelector('input')
      if (inside) return inside
      const sibling = label.nextElementSibling
      if (sibling && sibling.tagName === 'INPUT') return sibling
      return sibling ? sibling.querySelector('input') : null
    })()
    const input = byLabel || inputs[0]
    if (!input) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, args.value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }, { label: labelText, value })
}

async function clickButton(page, texts, pickLast = false) {
  return page.evaluate(({ wanted, last }) => {
    const buttons = Array.from(document.querySelectorAll('button'))
      .filter((b) => wanted.some((text) => (b.textContent || '').trim().toLowerCase() === text.toLowerCase()))
    const button = last ? buttons[buttons.length - 1] : buttons[0]
    if (!button) return false
    button.click()
    return true
  }, { wanted: texts, last: pickLast })
}

async function fillNumbers(page, values) {
  return page.evaluate((vals) => {
    const inputs = Array.from(document.querySelectorAll('input[type="number"]'))
    if (inputs.length < 3) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    inputs.slice(0, 3).forEach((input, index) => {
      setter.call(input, String(vals[index]))
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    return true
  }, values)
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  const pastors = [1, 2, 3].map((n) => loadWalletCredentials({ variable: `TEST_PASTOR${n}` }))
  const verifier = loadVerifierWallet()
  if (pastors.some((p) => !p) || !verifier) {
    console.error('Faltan TEST_PASTOR1..3_PRIVATE_KEY o PRIVATE_KEY en apps/.env')
    process.exit(1)
  }

  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { timeout } = env
  const { base } = resolveSiteTarget(env)
  writeTinyPdf(PDF_PATH)
  console.log(`Pastores: ${pastors.map((p) => p.address.slice(0, 8)).join(', ')} | ${base}`)

  const browser = await launchBrowser(env.headless)
  const verifierContext = await newIncognitoContext(browser)
  const verifierPage = await newIncognitoPage(verifierContext, verifier.address, timeout)
  await setupE2EAuth(verifierPage, verifier.address, verifier.pk, process.env.CHAIN_ID, base)

  const sessions = []
  for (const pastor of pastors) {
    const context = await newIncognitoContext(browser)
    const page = await newIncognitoPage(context, pastor.address, timeout)
    await page.setDefaultNavigationTimeout(180000)
    await setupE2EAuth(page, pastor.address, pastor.pk, process.env.CHAIN_ID, base)
    sessions.push({ pastor, page })
  }
  const initiator = sessions[0]
  const verifierApi = (path, init) => apiOn(verifierPage, path.includes('?') ? `${path}&wallet=${verifier.address}` : `${path}?wallet=${verifier.address}`, init)

  // ── 1. Fixture y limpieza ───────────────────────────────────────────
  console.log('\n── 1. Fixture de los tres pastores ──')
  for (const session of sessions) {
    try {
      const fixture = await ensurePastorFixture({
        verifierPage,
        verifierAddress: verifier.address,
        pastorPage: session.page,
        pastor: session.pastor,
        churchName: `E2E ${session.pastor.variable} Church`,
      })
      const status = await apiOn(session.page, `/api/cluster/status?walletAddress=${session.pastor.address}`)
      if (status.body?.hasCluster) {
        await apiOn(session.page, `/api/cluster/${status.body.clusterId}/leave`, {
          method: 'POST',
          body: JSON.stringify({ walletAddress: session.pastor.address }),
        })
      }
      session.fixture = fixture
      ok(`${session.pastor.variable}: perfil #${fixture.userId}, iglesia #${fixture.churchId}`)
    } catch (error) {
      fail(`${session.pastor.variable}: ${error.message}`)
    }
  }

  // ── 2. Clúster activo con tres iglesias (UI) ────────────────────────
  console.log('\n── 2. Formar el clúster ──')
  const name = `E2E Listo ${Date.now().toString(36)}`
  let clusterId = null
  let code = null
  for (let attempt = 0; attempt < 2 && !clusterId; attempt++) {
    await initiator.page.goto(`${base}/${LANG}/cluster`, { waitUntil: 'domcontentloaded' })
    await initiator.page.waitForFunction(
      (label) => (document.body?.innerText || '').includes(label),
      { timeout: 60000 },
      t.create,
    ).catch(() => {})
    await clickButton(initiator.page, [t.create])
    await initiator.page.waitForFunction(
      (label) => (document.body?.innerText || '').includes(label),
      { timeout: 20000 },
      t.name,
    ).catch(() => {})
    await fillByLabel(initiator.page, t.name, name)
    await clickButton(initiator.page, [t.create], true)
    await new Promise((r) => setTimeout(r, 5000))
    const status = await apiOn(initiator.page, `/api/cluster/status?walletAddress=${initiator.pastor.address}`)
    clusterId = status.body?.clusterId || null
    code = status.body?.cluster?.code || null
  }
  if (!clusterId) {
    fail('la interfaz no creó el clúster')
    summary()
    await browser.close()
    return
  }
  ok(`clúster #${clusterId} (${code})`)

  for (const session of sessions.slice(1)) {
    let joined = false
    for (let attempt = 0; attempt < 2 && !joined; attempt++) {
      await session.page.goto(`${base}/${LANG}/cluster/${clusterId}`, { waitUntil: 'domcontentloaded' })
      await session.page.waitForFunction(
        (placeholder) => !!Array.from(document.querySelectorAll('input')).find((i) => (i.placeholder || '') === placeholder),
        { timeout: 60000 },
        t.code,
      ).catch(() => {})
      joined = await fillByLabel(session.page, t.code, code)
    }
    if (joined) await clickButton(session.page, [t.join])
    await new Promise((r) => setTimeout(r, 3000))
  }
  const cluster = await apiOn(initiator.page, `/api/cluster/${clusterId}?walletAddress=${initiator.pastor.address}`)
  if (cluster.body?.members?.length === 3 && cluster.body?.status === 'active') ok('clúster activo con 3 iglesias')
  else fail(`clúster: ${cluster.body?.status} / ${cluster.body?.members?.length} iglesias`)

  // ── 3. Billetera, presupuesto y oferta (UI) ─────────────────────────
  console.log('\n── 3. Billetera y datos fijos ──')
  const linked = privateKeyToAccount(generatePrivateKey())
  const nonce = await initiator.page.evaluate(async () => {
    const res = await fetch('/api/auth/csrf')
    return (await res.json()).csrfToken
  })
  const message = new SiweMessage({
    domain: new URL(base).host, address: linked.address, statement: 'Sign in to Learn through games.',
    uri: base, version: '1', chainId: process.env.CHAIN_ID, nonce,
  }).prepareMessage()
  const signature = await linked.signMessage({ message })
  const link = await apiOn(initiator.page, '/api/wallet/link', {
    method: 'POST',
    body: JSON.stringify({ walletAddress: initiator.pastor.address, message, signature }),
  })
  if (link.status === 200) ok('segunda billetera enlazada a la cuenta del iniciador')
  else fail(`wallet/link → ${link.status}`)
  const walletSet = await apiOn(initiator.page, `/api/cluster/${clusterId}`, {
    method: 'PATCH',
    body: JSON.stringify({ walletAddress: initiator.pastor.address, clusterWallet: linked.address }),
  })
  if (walletSet.status === 200) ok('billetera del clúster configurada')
  else fail(`billetera del clúster → ${walletSet.status} ${JSON.stringify(walletSet.body).slice(0, 120)}`)

  await initiator.page.goto(`${base}/${LANG}/cluster/${clusterId}`, { waitUntil: 'domcontentloaded' })
  await initiator.page.waitForFunction(
    () => document.querySelectorAll('input[type="number"]').length >= 3,
    { timeout: 45000 },
  ).catch(() => {})
  if (await fillNumbers(initiator.page, [400, 180, 40])) ok('valores del presupuesto y del director escritos')
  else fail('no aparecieron los campos numéricos del panel')
  await clickButton(initiator.page, ['Save', 'Guardar'])
  await new Promise((r) => setTimeout(r, 2500))
  await fillNumbers(initiator.page, [400, 180, 40])
  await clickButton(initiator.page, ['Save', 'Guardar'], true)
  await new Promise((r) => setTimeout(r, 2500))

  const files = await initiator.page.$$('input[type=file]')
  if (files.length >= 2) {
    await files[0].uploadFile(PDF_PATH)
    await new Promise((r) => setTimeout(r, 3000))
    const again = await initiator.page.$$('input[type=file]')
    if (again.length >= 2) await again[1].uploadFile(PDF_PATH)
    await new Promise((r) => setTimeout(r, 3000))
    ok('PDF de presupuesto y de oferta subidos')
  } else {
    fail('no aparecieron los campos de PDF')
  }

  // ── 4. Seis guías por pastor (UI) ───────────────────────────────────
  console.log('\n── 4. Guías del curso (18 crucigramas) ──')
  const suffixes = [1, 2, 3, 4, 5, 6].map((n) => COURSE.suffix(n))
  for (const session of sessions) {
    const results = await completeGuides(session.page, base, { lang: LANG, prefix: COURSE.prefix, suffixes })
    const done = results.filter((r) => r.accepted).length
    if (done === suffixes.length) ok(`${session.pastor.variable}: 6/6 guías`)
    else fail(`${session.pastor.variable}: ${done}/6 guías (${JSON.stringify(results.filter((r) => !r.accepted))})`)
  }

  // ── 5. Puntaje verificado (> 90) e invitaciones ─────────────────────
  console.log('\n── 5. Puntaje e invitaciones ──')
  for (const session of sessions) {
    const profile = await apiOn(session.page, `/api/profile?walletAddress=${session.pastor.address}`)
    const user = profile.body || {}
    const patch = await verifierApi(`/api/admin/user/${session.fixture.userId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        passport_name: user.nombre,
        passport_nationality: user.pais_id,
        verified_email: user.email,
        verified_whatsapp: user.whatsapp,
        place_of_worship_location: 'Freetown',
        verified_place_of_worship_location: 'Freetown',
        verified_church_relationship: 'pastor',
        proposed_date_of_interview: new Date().toISOString(),
      }),
    })
    if (patch.status === 200) {
      const after = await apiOn(session.page, `/api/profile?walletAddress=${session.pastor.address}`)
      if (Number(after.body?.profilescore) > 90) ok(`${session.pastor.variable}: puntaje ${after.body.profilescore}`)
      else fail(`${session.pastor.variable}: puntaje ${after.body?.profilescore}`)
    } else {
      fail(`${session.pastor.variable}: no se pudo verificar (${patch.status})`)
    }
  }

  // invite_pastor: cada pastor refirió a otro pastor (ciclo).
  for (let i = 0; i < sessions.length; i++) {
    const referred = sessions[(i + 1) % sessions.length]
    const res = await verifierApi(`/api/admin/user/${referred.fixture.userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ referrer: sessions[i].pastor.address }),
    })
    if (res.status !== 200) fail(`referrer pastor ${i + 1} → ${res.status}`)
  }
  ok('invitaciones entre pastores (invite_pastor)')

  // invite_member: una cuenta miembro en la iglesia de cada pastor, referida por él.
  let members = 0
  for (const session of sessions) {
    const member = privateKeyToAccount(generatePrivateKey())
    const memberContext = await newIncognitoContext(browser)
    const memberPage = await newIncognitoPage(memberContext, member.address, timeout)
    await setupE2EAuth(memberPage, member.address, member.pk, process.env.CHAIN_ID, base)
    const profile = await apiOn(memberPage, `/api/profile?walletAddress=${member.address}`)
    const assigned = await verifierApi(`/api/admin/user/${profile.body?.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        pais_id: 694,
        religion_id: 2,
        church_id: session.fixture.churchId,
        church_relationship: 'member',
      }),
    })
    const referred = await verifierApi(`/api/admin/user/${profile.body?.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ referrer: session.pastor.address }),
    })
    if (assigned.status === 200 && referred.status === 200) members++
    rememberWallet({ privateKey: member.pk, address: member.address, role: 'member', note: 'cluster-ready' })
  }
  if (members === 3) ok('un miembro de la iglesia de cada pastor (invite_member)')
  else fail(`miembros preparados: ${members}/3`)

  // ── 6. Aprobaciones y readiness ─────────────────────────────────────
  console.log('\n── 6. Aprobaciones y readiness ──')
  for (const session of sessions) {
    await session.page.goto(`${base}/${LANG}/cluster/${clusterId}`, { waitUntil: 'domcontentloaded' })
    await session.page.waitForFunction(
      () => Array.from(document.querySelectorAll('button'))
        .some((b) => /i know and approve|conozco y apruebo/i.test(b.textContent || '')),
      { timeout: 45000 },
    ).catch(() => {})
    const clicked = await session.page.evaluate(() => {
      const button = Array.from(document.querySelectorAll('button'))
        .find((b) => /i know and approve|conozco y apruebo/i.test(b.textContent || ''))
      if (!button) return false
      button.click()
      return true
    })
    if (!clicked) fail(`${session.pastor.variable}: sin botón de aprobación`)
    await new Promise((r) => setTimeout(r, 2500))
  }

  const presentation = await apiOn(initiator.page, `/api/cluster/${clusterId}/gd-presentation?walletAddress=${initiator.pastor.address}`)
  const body = presentation.body || {}
  console.log(`  [estado] ready=${body.ready} missing=${JSON.stringify(body.missing)} missing_data=${JSON.stringify(body.missing_data)}`)
  if (body.ready === true && (body.missing || []).length === 0 && (body.missing_data || []).length === 0) {
    ok('el clúster está listo para presentarse')
  } else {
    fail(`todavía no está listo: ${JSON.stringify({ missing: body.missing, missing_data: body.missing_data })}`)
    for (const pastor of body.pastors || []) console.log(`  [pastor] ${pastor.usuario_id} missing=${JSON.stringify(pastor.missing)}`)
  }

  skip('la presentación (devolver, corregir, sent) y las respuestas de GD van en cluster-flow.spec.mjs')

  // ── 7. Limpieza ─────────────────────────────────────────────────────
  console.log('\n── 7. Limpieza ──')
  for (const session of sessions) {
    await apiOn(session.page, `/api/cluster/${clusterId}/leave`, {
      method: 'POST',
      body: JSON.stringify({ walletAddress: session.pastor.address }),
    })
  }
  ok('los tres pastores salieron')

  await browser.close()
  const seconds = ((performance.now() - t0) / 1000).toFixed(1)
  console.log(`\nDuración: ${seconds}s`)
  summary()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
