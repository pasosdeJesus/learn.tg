#!/usr/bin/env node
// E2E de formación de un clúster con tres pastores (R-#161, R-#220).
//
// Todo por la interfaz: el iniciador crea el clúster con el formulario, los otros
// dos se unen con el código de 6 caracteres y cada uno aprueba con el botón. La
// billetera verificadora siembra (iglesia, rol, ciudad) en su propio contexto y
// nunca actúa como pastor. Los tres pastores son TEST_PASTOR1..3, así se
// reutilizan en cada corrida.
//
// Ejecución:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//   CHAIN_ID=11142220 node e2e/specs/cluster-three-pastors.spec.mjs

import { fail, initTestEnv, launchBrowser, newIncognitoContext, newIncognitoPage, ok, resetFailures, resolveSiteTarget, summary } from '@pasosdejesus/m/e2e'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'
import { loadVerifierWallet, loadWalletCredentials } from '../helpers/e2e-wallet.mjs'
import { apiOn, ensurePastorFixture } from '../helpers/e2e-fixture.mjs'

const LANG = process.env.E2E_LANG === 'es' ? 'es' : 'en'
const LABELS = {
  en: { create: 'Create a cluster', name: 'Cluster name', code: '6-char code', join: 'Join', codeLabel: 'Join code' },
  es: { create: 'Crear un clúster', name: 'Nombre del clúster', code: 'Código de 6 caracteres', join: 'Unirse', codeLabel: 'Código de unión' },
}
const t = LABELS[LANG]

function skip(message) {
  console.log(`  [NOTE] ${message}`)
}

/** Escribe en un input por su placeholder o por el texto de su etiqueta. */
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

async function clickButton(page, texts) {
  return page.evaluate((wanted) => {
    const button = Array.from(document.querySelectorAll('button'))
      .find((b) => wanted.some((text) => (b.textContent || '').trim().toLowerCase() === text.toLowerCase()))
    if (!button) return false
    button.click()
    return true
  }, texts)
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
  console.log(`Pastores: ${pastors.map((p) => p.address.slice(0, 8)).join(', ')} | ${base}`)

  const browser = await launchBrowser(env.headless)

  // Cada pastor en su propio contexto y la verificadora en otro: sin eso, cada
  // inicio de sesión reemplaza al anterior en las mismas cookies.
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

  const apiOnPage = (page) => (path, init) => apiOn(page, path, init)
  const initiator = sessions[0]
  const initiatorApi = apiOnPage(initiator.page)

  // ── 1. Siembra de los tres pastores y limpieza de clústeres previos ──
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
      const status = await apiOnPage(session.page)(`/api/cluster/status?walletAddress=${session.pastor.address}`)
      if (status.body?.hasCluster) {
        const clusterId = status.body.clusterId
        await apiOnPage(session.page)(`/api/cluster/${clusterId}/leave`, {
          method: 'POST',
          body: JSON.stringify({ walletAddress: session.pastor.address }),
        })
      }
      ok(`${session.pastor.variable}: perfil #${fixture.userId}, iglesia #${fixture.churchId}`)
    } catch (error) {
      fail(`${session.pastor.variable}: ${error.message}`)
    }
  }

  // ── 2. El iniciador crea el clúster con el formulario ────────────────
  console.log('\n── 2. Crear el clúster (formulario) ──')
  const name = `E2E Tres ${Date.now().toString(36)}`
  await initiator.page.goto(`${base}/${LANG}/cluster`, { waitUntil: 'domcontentloaded' })
  await initiator.page.waitForFunction(
    (label) => (document.body?.innerText || '').includes(label),
    { timeout: 45000 },
    t.create,
  ).catch(() => {})
  // "Create a cluster" abre el formulario; después se escribe el nombre y se
  // confirma con el botón del formulario.
  if (await clickButton(initiator.page, [t.create])) ok('formulario abierto')
  else fail('no se encontró el botón que abre el formulario')
  await initiator.page.waitForFunction(
    (label) => (document.body?.innerText || '').includes(label),
    { timeout: 20000 },
    t.name,
  ).catch(() => {})

  const filled = await fillByLabel(initiator.page, t.name, name)
  if (filled) ok('nombre escrito en el formulario')
  else fail('no se encontró el campo del nombre')

  const submitted = await initiator.page.evaluate((label) => {
    const buttons = Array.from(document.querySelectorAll('button'))
      .filter((b) => (b.textContent || '').trim() === label)
    const button = buttons[buttons.length - 1]
    if (!button) return false
    button.click()
    return true
  }, t.create)
  if (submitted) ok('clúster enviado a crear')
  else fail('no se encontró el botón de confirmar')

  await new Promise((r) => setTimeout(r, 5000))
  let status = await initiatorApi(`/api/cluster/status?walletAddress=${initiator.pastor.address}`)
  const clusterId = status.body?.clusterId
  const code = status.body?.cluster?.code
  if (clusterId) ok(`clúster creado (#${clusterId}, código ${code})`)
  else {
    fail(`la interfaz no creó el clúster (${JSON.stringify(status.body).slice(0, 160)})`)
    summary()
    await browser.close()
    return
  }

  // ── 3. Los otros dos se unen con el código ──────────────────────────
  console.log('\n── 3. Unirse con el código ──')
  for (const session of sessions.slice(1)) {
    let filledCode = false
    for (let attempt = 0; attempt < 2 && !filledCode; attempt++) {
      await session.page.goto(`${base}/${LANG}/cluster/${clusterId}`, { waitUntil: 'domcontentloaded' })
      await session.page.waitForFunction(
        (placeholder) => !!Array.from(document.querySelectorAll('input'))
          .find((i) => (i.placeholder || '') === placeholder),
        { timeout: 60000 },
        t.code,
      ).catch(() => {})
      filledCode = await fillByLabel(session.page, t.code, code)
    }
    if (!filledCode) {
      fail(`${session.pastor.variable}: no se encontró el campo del código`)
      continue
    }
    if (await clickButton(session.page, [t.join])) ok(`${session.pastor.variable}: "unirse" pulsado`)
    else fail(`${session.pastor.variable}: no se encontró el botón de unirse`)
    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise((r) => setTimeout(r, 1000))
      const probe = await apiOnPage(session.page)(`/api/cluster/${clusterId}?walletAddress=${session.pastor.address}`)
      if ((probe.body?.members?.length || 0) >= 2) break
    }
    const member = await apiOnPage(session.page)(`/api/cluster/${clusterId}?walletAddress=${session.pastor.address}`)
    if (member.body?.members?.length >= 2) ok(`${session.pastor.variable}: iglesia dentro (${member.body.members.length} iglesias)`)
    else fail(`${session.pastor.variable}: la iglesia no quedó dentro`)
  }

  const cluster = await initiatorApi(`/api/cluster/${clusterId}?walletAddress=${initiator.pastor.address}`)
  if (cluster.body?.members?.length === 3) ok('el clúster tiene 3 iglesias')
  else fail(`iglesias del clúster: ${cluster.body?.members?.length}`)
  if (cluster.body?.status === 'active') ok('el clúster está activo con las tres iglesias')
  else fail(`estado del clúster: ${cluster.body?.status}`)

  // ── 4. Cada pastor aprueba con el botón ─────────────────────────────
  console.log('\n── 4. Aprobación de los tres pastores ──')
  for (const session of sessions) {
    await session.page.goto(`${base}/${LANG}/cluster/${clusterId}`, { waitUntil: 'domcontentloaded' })
    await session.page.waitForFunction(
      () => Array.from(document.querySelectorAll('button'))
        .some((b) => /i know and approve|conozco y apruebo/i.test(b.textContent || '')),
      { timeout: 45000 },
    ).catch(() => {})
    const clickApproveOnce = () => session.page.evaluate(() => {
      const button = Array.from(document.querySelectorAll('button'))
        .find((b) => /i know and approve|conozco y apruebo/i.test(b.textContent || ''))
      if (!button) return false
      button.click()
      return true
    })
    let clicked = await clickApproveOnce()
    if (!clicked) {
      await session.page.reload({ waitUntil: 'domcontentloaded' })
      await session.page.waitForFunction(
        () => Array.from(document.querySelectorAll('button'))
          .some((b) => /i know and approve|conozco y apruebo/i.test(b.textContent || '')),
        { timeout: 30000 },
      ).catch(() => {})
      clicked = await clickApproveOnce()
    }
    if (clicked) ok(`${session.pastor.variable}: aprobación pulsada`)
    else fail(`${session.pastor.variable}: no apareció el botón de aprobación`)
    await new Promise((r) => setTimeout(r, 2500))
  }

  const presentations = await initiatorApi(`/api/cluster/${clusterId}/gd-presentation?walletAddress=${initiator.pastor.address}`)
  const approvals = presentations.body?.approvals
  if (approvals?.approved === 3 && approvals?.pastors === 3) ok('aprobaciones 3/3')
  else fail(`aprobaciones inesperadas: ${JSON.stringify(approvals)}`)
  if (!(presentations.body?.missing || []).includes('approvals')) ok('la aprobación ya no falta para presentar')

  await initiator.page.goto(`${base}/${LANG}/cluster/${clusterId}`, { waitUntil: 'domcontentloaded' })
  await new Promise((r) => setTimeout(r, 3000))
  const text = await initiator.page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
  if (/all the pastors approved|todos los pastores aprobaron/i.test(text)) ok('la página muestra la aprobación completa')
  else fail('la página no muestra la aprobación completa')

  // ── 5. Fuera de alcance ─────────────────────────────────────────────
  console.log('\n── 5. Fuera de alcance ──')
  skip('la solicitud (`requested`) exige además el curso de cada pastor completo, puntaje > 90 e invitaciones')
  skip('`sent`/`answered` y la liberación del fondo: contrato y firma del operador')

  // ── 6. Limpieza: cada pastor sale ───────────────────────────────────
  console.log('\n── 6. Limpieza ──')
  for (const session of sessions) {
    const left = await apiOnPage(session.page)(`/api/cluster/${clusterId}/leave`, {
      method: 'POST',
      body: JSON.stringify({ walletAddress: session.pastor.address }),
    })
    if (left.status === 200) ok(`${session.pastor.variable}: salió del clúster`)
    else fail(`${session.pastor.variable}: no pudo salir (${left.status})`)
  }

  await browser.close()
  const seconds = ((performance.now() - t0) / 1000).toFixed(1)
  console.log(`\nDuración: ${seconds}s`)
  summary()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
