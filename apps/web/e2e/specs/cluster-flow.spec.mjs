#!/usr/bin/env node
// E2E: el recorrido del verificador sobre un clúster listo (R-#161).
//
// Por interfaz: el iniciador solicita la presentación desde la página del curso, el
// verificador la devuelve con sugerencias desde `/{lang}/admin/clusters`, el iniciador
// corrige el presupuesto en el panel (eso invalida las aprobaciones), los pastores
// vuelven a aprobar y el verificador aprueba y marca `sent`.
//
// Ejecución:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//   CHAIN_ID=11142220 node e2e/specs/cluster-flow.spec.mjs

import { fail, initTestEnv, launchBrowser, ok, resetFailures, resolveSiteTarget, summary } from '@pasosdejesus/m/e2e'
import { loadVerifierWallet } from '../helpers/e2e-wallet.mjs'
import { markClusterCompleted, resolveClusterPastors } from '../helpers/e2e-pastors.mjs'
import { apiOn } from '../helpers/e2e-fixture.mjs'
import { clickApprove, prepareReadyCluster } from '../helpers/cluster-ready-fixture.mjs'

const LANG = process.env.E2E_LANG === 'es' ? 'es' : 'en'
const COURSE = LANG === 'es' ? 'redgd' : 'gdcluster'
const LABELS = {
  en: {
    requestBox: 'Request the presentation to Global Disciples',
    requestButton: 'Send request',
    gd: 'GD',
    save: 'Save',
  },
  es: {
    requestBox: 'Solicitar la presentación a Global Disciples',
    requestButton: 'Enviar solicitud',
    gd: 'GD',
    save: 'Guardar',
  },
}
const t = LABELS[LANG]

async function stateOf(page, clusterId, wallet) {
  const res = await apiOn(page, `/api/cluster/${clusterId}/gd-presentation?walletAddress=${wallet}`)
  return res.body || {}
}


/** Abre el formulario de GD del clúster en el panel del verificador (espera la fila). */
async function openGdForm(verifierPage, base, lang, clusterId, gdLabel) {
  await verifierPage.goto(`${base}/${lang}/admin/clusters`, { waitUntil: 'domcontentloaded' })
  return verifierPage.waitForFunction(
    ({ id, label }) => {
      const row = Array.from(document.querySelectorAll('tbody tr'))
        .find((r) => ((r.querySelector('td')?.textContent || '').trim()) === String(id))
      if (!row) return false
      const button = Array.from(row.querySelectorAll('button'))
        .find((b) => (b.textContent || '').trim().toLowerCase() === label.toLowerCase())
      if (!button) return false
      button.click()
      return true
    },
    { timeout: 60000 },
    { id: clusterId, label: gdLabel },
  ).then(() => true).catch(() => false)
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  // Pastors come from the local registry (reuse first, create only when needed);
  // answering GD spends the ones it uses (`cluster_completed` is permanent).
  const picked = resolveClusterPastors({ count: 3 })
  const pastors = picked.pastors
  if (picked.missing) {
    console.log(`[SKIP] ${picked.reason}`)
    process.exit(0)
  }
  const verifier = loadVerifierWallet()
  if (pastors.some((p) => !p) || !verifier) {
    console.error('Faltan TEST_PASTOR1..3_PRIVATE_KEY o PRIVATE_KEY en apps/.env')
    process.exit(1)
  }
  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { base } = resolveSiteTarget(env)
  const browser = await launchBrowser(env.headless)

  console.log('\n── 1. Clúster listo ──')
  let prepared
  try {
    prepared = await prepareReadyCluster({
      browser, base, timeout: env.timeout, chainId: process.env.CHAIN_ID, lang: LANG, pastors, verifier,
      ok, fail,
      log: (message) => console.log(`  [estado] ${message}`),
    })
  } catch (error) {
    fail(`no se pudo preparar el clúster: ${error.message}`)
    summary()
    await browser.close()
    return
  }
  const { clusterId, sessions, verifierPage } = prepared
  const initiator = sessions[0]
  const wallet = initiator.pastor.address
  console.log(`  [info] clúster #${clusterId}`)

  // ── 2. El iniciador solicita la presentación (página del curso) ─────
  console.log('\n── 2. Solicitud del iniciador ──')
  // La solicitud se hace desde la página del clúster (el panel es del iniciador); el
  // control de la página del curso solo sirve cuando aún no hay datos.
  const requestLabel = LANG === 'es'
    ? '¿Solicitar la presentación a Global Discip'
    : 'Request the presentation to Global Discip'
  for (let attempt = 0; attempt < 2; attempt++) {
    await initiator.page.goto(`${base}/${LANG}/cluster/${clusterId}`, { waitUntil: 'domcontentloaded' })
    await initiator.page.waitForFunction(
      (label) => (document.body?.innerText || '').includes(label),
      { timeout: 90000 },
      requestLabel,
    ).catch(() => {})
    const hasCheckbox = await initiator.page.evaluate(
      () => !!document.querySelector('input[type="checkbox"]'),
    )
    if (hasCheckbox) break
    console.log('  [retry] el panel aún no muestra la casilla de solicitud')
    await new Promise((r) => setTimeout(r, 5000))
  }
  const checked = await initiator.page.evaluate((label) => {
    const box = Array.from(document.querySelectorAll('input[type="checkbox"]'))
      .find((input) => ((input.closest('label')?.textContent || '').trim()).includes(label.slice(0, 20)))
      || document.querySelector('input[type="checkbox"]')
    if (!box || box.disabled) return false
    box.click()
    return true
  }, requestLabel)
  if (checked) ok('casilla de la solicitud marcada')
  else fail('no se encontró la casilla de la solicitud')

  const requested = await initiator.page.evaluate((label) => {
    const button = Array.from(document.querySelectorAll('button'))
      .find((b) => (b.textContent || '').trim() === label && !b.disabled)
    if (!button) return false
    button.click()
    return true
  }, t.requestButton)
  if (requested) ok('botón de solicitar pulsado')
  else fail('no se encontró el botón de solicitar (¿sigue deshabilitado?)')

  await new Promise((r) => setTimeout(r, 4000))
  let state = await stateOf(initiator.page, clusterId, wallet)
  if (state.request?.status === 'requested') ok('estado `requested`')
  else fail(`estado tras solicitar: ${state.request?.status}`)
  if (state.request?.locked === true) ok('los datos quedaron fijos')
  else fail('los datos no aparecen fijos')

  // ── 3. El verificador devuelve con sugerencias ──────────────────────
  console.log('\n── 3. Devolución del verificador ──')
  const opened = await openGdForm(verifierPage, base, LANG, clusterId, t.gd)
  if (opened) ok('formulario de GD abierto')
  else fail('no se pudo abrir el formulario de GD')

  const moved = await verifierPage.evaluate(({ statusLabel, saveLabel }) => {
    const dialogSelect = Array.from(document.querySelectorAll('select'))
      .find((select) => Array.from(select.options).some((option) => /returned|under_review|approved|sent/i.test(option.value)))
    if (!dialogSelect) return false
    const option = Array.from(dialogSelect.options).find((o) => o.value === statusLabel)
    if (!option) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
    setter.call(dialogSelect, statusLabel)
    dialogSelect.dispatchEvent(new Event('change', { bubbles: true }))
    const textareas = Array.from(document.querySelectorAll('textarea'))
      .filter((area) => !area.readOnly)
    if (textareas[0]) {
      const areaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      areaSetter.call(textareas[0], 'Revisión de pdJ: falta precisar el presupuesto.')
      textareas[0].dispatchEvent(new Event('input', { bubbles: true }))
    }
    const save = Array.from(document.querySelectorAll('button'))
      .find((b) => (b.textContent || '').trim().toLowerCase() === saveLabel.toLowerCase())
    if (!save) return false
    save.click()
    return true
  }, { statusLabel: 'returned', saveLabel: t.save })
  if (moved) ok('estado `returned` enviado con evaluación')
  else fail('no se pudo mover a `returned`')

  await new Promise((r) => setTimeout(r, 4000))
  state = await stateOf(initiator.page, clusterId, wallet)
  if (state.request?.status === 'returned') ok('estado `returned` confirmado')
  else fail(`estado tras devolver: ${state.request?.status}`)
  if (state.request?.locked === false) ok('los datos se desbloquearon')
  else fail('los datos siguen bloqueados')

  // ── 4. El iniciador corrige (invalida las aprobaciones) ─────────────
  console.log('\n── 4. Corrección del iniciador ──')
  await initiator.page.goto(`${base}/${LANG}/cluster/${clusterId}`, { waitUntil: 'domcontentloaded' })
  await initiator.page.waitForFunction(
    () => document.querySelectorAll('input[type="number"]').length >= 3,
    { timeout: 45000 },
  ).catch(() => {})
  const corrected = await initiator.page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input[type="number"]'))
    if (inputs.length < 3) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inputs[0], '500')
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }))
    const save = Array.from(document.querySelectorAll('button'))
      .find((b) => /^(save|guardar)$/i.test((b.textContent || '').trim()))
    if (!save) return false
    save.click()
    return true
  })
  if (corrected) ok('presupuesto corregido en el panel')
  else fail('no se pudo corregir el presupuesto')
  await new Promise((r) => setTimeout(r, 3000))

  state = await stateOf(initiator.page, clusterId, wallet)
  if ((state.missing || []).includes('approvals')) ok('las aprobaciones caducaron con el cambio')
  else fail(`las aprobaciones no caducaron: ${JSON.stringify(state.missing)}`)

  // ── 5. Los pastores aprueban otra vez ───────────────────────────────
  console.log('\n── 5. Nuevas aprobaciones ──')
  for (const session of sessions) {
    await session.page.goto(`${base}/${LANG}/cluster/${clusterId}`, { waitUntil: 'domcontentloaded' })
    await session.page.waitForFunction(
      () => Array.from(document.querySelectorAll('button')).some((b) => /i know and approve|conozco y apruebo/i.test(b.textContent || '')),
      { timeout: 45000 },
    ).catch(() => {})
    if (await clickApprove(session.page)) ok(`${session.pastor.variable}: aprobó de nuevo`)
    else fail(`${session.pastor.variable}: no apareció el botón de aprobación`)
    await new Promise((r) => setTimeout(r, 2000))
  }
  state = await stateOf(initiator.page, clusterId, wallet)
  if (!(state.missing || []).includes('approvals')) ok('aprobaciones completas de nuevo')
  else fail('siguen faltando aprobaciones')

  // ── 6. El verificador aprueba y marca `sent` ────────────────────────
  console.log('\n── 6. Aprobación y envío ──')
  for (const next of ['approved', 'sent']) {
    const advanced = await openGdForm(verifierPage, base, LANG, clusterId, t.gd)
    if (!advanced) {
      fail(`no se pudo abrir el formulario para ${next}`)
      break
    }
    await new Promise((r) => setTimeout(r, 1500))
    const moved2 = await verifierPage.evaluate(({ statusLabel, saveLabel }) => {
      const dialogSelect = Array.from(document.querySelectorAll('select'))
        .find((select) => Array.from(select.options).some((option) => /returned|under_review|approved|sent/i.test(option.value)))
      if (!dialogSelect) return false
      if (!Array.from(dialogSelect.options).some((o) => o.value === statusLabel)) return false
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
      setter.call(dialogSelect, statusLabel)
      dialogSelect.dispatchEvent(new Event('change', { bubbles: true }))
      const save = Array.from(document.querySelectorAll('button'))
        .find((b) => (b.textContent || '').trim().toLowerCase() === saveLabel.toLowerCase())
      if (!save) return false
      save.click()
      return true
    }, { statusLabel: next, saveLabel: t.save })
    if (moved2) ok(`estado ${next} enviado`)
    else fail(`no se pudo mover a ${next}`)
    await new Promise((r) => setTimeout(r, 4000))
  }

  state = await stateOf(initiator.page, clusterId, wallet)
  if (state.request?.status === 'sent') ok('estado `sent` confirmado')
  else fail(`estado final: ${state.request?.status}`)

  // ── 7. Limpieza ─────────────────────────────────────────────────────
  console.log('\n── 7. Limpieza ──')
  const disband = await apiOn(verifierPage, `/api/admin/clusters/${clusterId}?wallet=${verifier.address}`, { method: 'DELETE' })
  if ([200, 204].includes(disband.status)) ok(`clúster #${clusterId} disuelto`)
  else fail(`no se pudo disolver el clúster (${disband.status})`)

  await browser.close()
  console.log(`\nDuración: ${((performance.now() - t0) / 1000).toFixed(1)}s`)
  summary()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
