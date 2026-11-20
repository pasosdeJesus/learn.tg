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
    gd: 'GD',
    save: 'Save',
  },
  es: {
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

  // ── 2. La solicitud ya la hizo el iniciador al aprobar los datos ────
  console.log('\n── 2. Solicitud del iniciador ──')
  // Desde REQ/161 §4.7 la solicitud a pdJ **es** la tercera aprobación de datos de los
  // pastores (`cluster-ready-fixture` la marca), así que el panel del iniciador ya no
  // muestra la casilla "Solicitar la presentación": muestra "Presentación solicitada".
  // El spec comprobaba la casilla y el botón de envío, que sólo existen en un clúster
  // listo y sin solicitud: fallaba siempre desde que el fixture hace la solicitud.
  await initiator.page.goto(`${base}/${LANG}/cluster`, { waitUntil: 'domcontentloaded' })
  const alreadyRequested = await initiator.page.waitForFunction(
    (label) => (document.body?.innerText || '').includes(label),
    { timeout: 90000 },
    LANG === 'es' ? 'Presentación solicitada' : 'Presentation requested',
  ).then(() => true).catch(() => false)
  if (alreadyRequested) ok('el panel muestra la presentación solicitada')
  else fail('el panel del iniciador no muestra la presentación como solicitada')

  let state = await stateOf(initiator.page, clusterId, wallet)
  if (state.request?.status === 'requested') ok('estado `requested`')
  else fail(`estado tras la solicitud: ${state.request?.status}`)
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
  await initiator.page.goto(`${base}/${LANG}/cluster`, { waitUntil: 'domcontentloaded' })
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
    await session.page.goto(`${base}/${LANG}/cluster`, { waitUntil: 'domcontentloaded' })
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
  // Las transiciones reales del verificador (`app/[lang]/admin/clusters/page.tsx`):
  // `requested → under_review → returned | sent`, y `returned → under_review → sent`.
  // `approved` desapareció del flujo: no existe como estado del formulario.
  for (const next of ['under_review', 'sent']) {
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
  const failures = summary(t0)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
