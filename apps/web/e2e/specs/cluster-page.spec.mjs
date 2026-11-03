#!/usr/bin/env node
// E2E de /{lang}/cluster/[id] — la página del clúster (R-#161, R-#220).
//
// La billetera que **actúa** es la elegida con `E2E_WALLET` / `--wallet`
// (`TEST_PASTOR1..3`); la **verificadora** (`E2E_VERIFIER_WALLET`, por defecto
// `PRIVATE_KEY`) siembra iglesia, rol, ciudad de culto y curso GD, y nunca es
// pastor. Así los mismos pastores se reutilizan en cada corrida.
//
// Cubre: bloque de datos faltantes (el que reventaba la página), presupuesto y
// oferta del director, validación de la billetera, aprobación, solicitud
// bloqueada mientras faltan condiciones, renombrar y limpieza.
//
// Fuera de alcance (necesita 3 pastores, invitaciones, puntaje y la firma del
// operador): `sent`, `answered` y la liberación del fondo del país.
//
// Ejecución:
//   E2E_WALLET=TEST_PASTOR1 CHROME_PATH=/usr/local/bin/chrome \
//   IPDES=learn.tg PUERTOPRU=9001 CHAIN_ID=11142220 \
//   node e2e/specs/cluster-page.spec.mjs

import { fail, initTestEnv, launchBrowser, newIncognitoContext, newIncognitoPage, newPage, ok, resetFailures, resolveSiteTarget, summary } from '@pasosdejesus/m/e2e'
import { SiweMessage } from 'siwe'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'
import { loadSelectedWallet, loadVerifierWallet, walletSelector } from '../helpers/e2e-wallet.mjs'
import { oldestFreeWallet, rememberWallet } from '../helpers/e2e-wallets-registry.mjs'
import { apiOn, ensurePastorFixture } from '../helpers/e2e-fixture.mjs'

const LANG = process.env.E2E_LANG === 'es' ? 'es' : 'en'

function skip(message) {
  console.log(`  [NOTE] ${message}`)
}

/** Segunda billetera de la cuenta (la del iniciador es la del backend y no sirve). */
async function ensureSecondWallet(page, base, primary, chainId) {
  const listed = await page.evaluate(async (wallet) => {
    const res = await fetch(`/api/wallet?walletAddress=${wallet}`)
    return res.ok ? res.json() : { wallets: [] }
  }, primary)
  const known = (listed.wallets || []).map((row) => row.billetera)
    .find((address) => address && address.toLowerCase() !== primary.toLowerCase())
  if (known) return known

  const account = privateKeyToAccount(generatePrivateKey())
  const nonce = await page.evaluate(async () => {
    const res = await fetch('/api/auth/csrf')
    return (await res.json()).csrfToken
  })
  const message = new SiweMessage({
    domain: new URL(base).host,
    address: account.address,
    statement: 'Sign in to Learn through games.',
    uri: base,
    version: '1',
    chainId,
    nonce,
  }).prepareMessage()
  const signature = await account.signMessage({ message })
  const linked = await page.evaluate(async (payload) => {
    const res = await fetch('/api/wallet/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return { status: res.status, body: await res.json().catch(() => null) }
  }, { walletAddress: primary, message, signature })
  if (linked.status !== 200) throw new Error(`wallet/link → ${linked.status} ${JSON.stringify(linked.body)}`)
  return account.address
}


/** Escribe en los tres campos numéricos del panel (total, pago y horas). */
async function fillPanelNumbers(page, values) {
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

/** Pulsa el botón de guardar de una sección (0 presupuesto, 1 director). */
async function clickSave(page, index) {
  return page.evaluate((position) => {
    const buttons = Array.from(document.querySelectorAll('button'))
      .filter((b) => /^(save|guardar)$/i.test((b.textContent || '').trim()))
    const button = buttons[position]
    if (!button) return false
    button.click()
    return true
  }, index)
}

/** Pulsa el botón de aprobación del pastor. */
async function clickApprove(page) {
  return page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    const button = buttons.find((b) => /i know and approve|conozco y apruebo/i.test(b.textContent || ''))
    if (!button) return false
    button.click()
    return true
  })
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  // Sin selector: reutiliza la billetera más antigua del registro local (creada
  // por otra prueba) en vez de exigir una nueva.
  const registered = walletSelector() ? null : oldestFreeWallet()
  const creds = registered
    ? { variable: 'registro local', pk: registered.privateKey, address: registered.address }
    : loadSelectedWallet()
  const verifier = loadVerifierWallet()
  if (!creds || !verifier) {
    console.error('Faltan credenciales (apps/.env): PRIVATE_KEY y/o la billetera elegida')
    process.exit(1)
  }
  if (!walletSelector() && !registered) {
    console.error('No hay billetera de pastor: usa E2E_WALLET=TEST_PASTORn o corre antes premium-course-checkout (registra una)')
    process.exit(1)
  }
  if (verifier && creds.address.toLowerCase() === verifier.address.toLowerCase()) {
    console.error('La billetera verificadora no puede ser la del pastor: elige otra con E2E_WALLET')
    process.exit(1)
  }
  process.env.TEST_PRIVATE_KEY = creds.pk

  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { timeout } = env
  const { base } = resolveSiteTarget(env)
  console.log(`Pastor: ${creds.variable} ${creds.address.slice(0, 10)}... | verificador: ${verifier.address.slice(0, 10)}... | ${base}`)

  const browser = await launchBrowser(env.headless)
  const page = await newPage(browser, creds.address, timeout)
  await page.setDefaultNavigationTimeout(180000)
  await setupE2EAuth(page, creds.address, creds.pk, process.env.CHAIN_ID, base)

  // Contexto aparte: si compartiera cookies, el segundo inicio de sesión
  // reemplazaría al del pastor y las llamadas admin dejarían de ser suyas.
  const verifierContext = await newIncognitoContext(browser)
  const verifierPage = await newIncognitoPage(verifierContext, verifier.address, timeout)
  await verifierPage.setDefaultNavigationTimeout(180000)
  await setupE2EAuth(verifierPage, verifier.address, verifier.pk, process.env.CHAIN_ID, base)

  const api = (url, init) => apiOn(page, url, init)
  const admin = (url, init) => {
    const separator = url.includes('?') ? '&' : '?'
    return apiOn(verifierPage, `${url}${separator}wallet=${verifier.address}`, init)
  }
  const wallet = creds.address
  const qa = `walletAddress=${wallet}`

  // ── 1. Siembra (verificadora) del pastor ───────────────────────────
  console.log('\n── 1. Fixture del pastor (lo siembra la verificadora) ──')
  let fixture
  try {
    fixture = await ensurePastorFixture({
      verifierPage,
      verifierAddress: verifier.address,
      pastorPage: page,
      pastor: creds,
      churchName: `E2E ${creds.variable} Church`,
    })
    rememberWallet({ privateKey: creds.pk, address: creds.address, role: 'pastor', note: 'cluster-page' })
    const steps = fixture.steps.length ? ` · ${fixture.steps.join(' · ')}` : ' (ya estaba)'
    ok(`pastor listo: perfil #${fixture.userId}, iglesia #${fixture.churchId}${steps}`)
  } catch (error) {
    fail(`no se pudo sembrar el pastor: ${error.message}`)
    summary()
    await browser.close()
    return
  }

  const status = await api(`/api/cluster/status?${qa}`)
  let clusterId = null
  if (status.body?.hasCluster) {
    const list = await admin('/api/admin/clusters')
    const mine = (list.body?.clusters || []).find((row) => row.initiator_church_id === fixture.churchId)
    if (mine && mine.status !== 'disbanded') {
      clusterId = mine.id
      ok(`reutiliza el clúster #${clusterId}`)
    } else if (mine) {
      await api(`/api/cluster/${mine.id}/leave`, { method: 'POST', body: JSON.stringify({ walletAddress: wallet }) })
      ok(`libera la iglesia del clúster disuelto #${mine.id}`)
    }
  }
  if (!clusterId) {
    const name = `E2E Cluster ${Date.now().toString(36)}`
    const created = await api('/api/cluster', { method: 'POST', body: JSON.stringify({ walletAddress: wallet, name }) })
    clusterId = created.body?.id ?? created.body?.cluster?.id ?? null
    if (clusterId) ok(`clúster creado (#${clusterId})`)
    else fail(`POST /api/cluster → ${created.status} ${JSON.stringify(created.body).slice(0, 160)}`)
  }
  if (!clusterId) {
    summary()
    await browser.close()
    return
  }

  const clusterUrl = `${base}/${LANG}/cluster/${clusterId}`
  const loadClusterPage = async () => {
    await page.goto(clusterUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () => (document.body?.innerText || '').includes('Cluster wallet') ||
        (document.body?.innerText || '').includes('Billetera del clúster'),
      { timeout },
    )
    await page.waitForFunction(
      () => document.querySelectorAll('input[type="number"]').length >= 3 ||
        (document.body?.innerText || '').includes('Connection Error'),
      { timeout: 45000 },
    ).catch(() => {})
    await new Promise((r) => setTimeout(r, 500))
    return page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
  }

  // ── 2. Página como iniciador ───────────────────────────────────────
  console.log('\n── 2. Página del clúster (iniciador) ──')
  let text = await loadClusterPage()
  if (!/Connection Error/.test(text)) ok('la página no muestra "Connection Error"')
  else fail('la página muestra "Connection Error"')

  const presentation = await api(`/api/cluster/${clusterId}/gd-presentation?${qa}`)
  if (presentation.status === 200 && presentation.body?.isInitiator) ok('GET gd-presentation → 200 (isInitiator)')
  else fail(`GET gd-presentation → ${presentation.status}`)
  const before = presentation.body?.missing_data || []

  const missingLabel = LANG === 'es'
    ? 'Antes de solicitar la presentación debes completar:'
    : 'Before requesting the presentation you must complete:'
  if (text.includes(missingLabel)) ok('bloque de datos faltantes visible')
  else fail(`no aparece el bloque de datos faltantes | página: ${text.slice(0, 160)}`)

  const walletHint = LANG === 'es' ? 'no está configurada' : 'Not configured'
  if (presentation.body?.wallet) ok('la billetera del clúster ya estaba configurada')
  else if (text.includes(walletHint)) ok('la billetera del clúster aparece sin configurar')
  else fail('la billetera no aparece como "sin configurar"')

  // ── 3. Presupuesto y oferta del director ───────────────────────────
  console.log('\n── 3. Presupuesto y oferta del director ──')
  // Por la UI: se escriben los tres campos y se pulsan los botones de guardar.
  // Si el panel aún no está desplegado, se cae a la API y se avisa.
  const filled = await fillPanelNumbers(page, [400, 180, 40])
  if (filled) {
    if (await clickSave(page, 0)) ok('guardar presupuesto (botón)')
    else fail('no se encontró el botón de guardar del presupuesto')
    await new Promise((r) => setTimeout(r, 2500))
    // El panel recarga tras guardar: se repiten los valores del director antes de su botón.
    await fillPanelNumbers(page, [400, 180, 40])
    if (await clickSave(page, 1)) ok('guardar oferta del director (botón)')
    else fail('no se encontró el botón de guardar del director')
    await new Promise((r) => setTimeout(r, 2500))
  } else {
    console.log('  [!] el panel no está en la página: se usan los endpoints (pendiente el despliegue)')
    const budget = await api(`/api/cluster/${clusterId}/budget`, {
      method: 'PUT',
      body: JSON.stringify({ walletAddress: wallet, firstYearBudget: 400 }),
    })
    if (budget.status === 200) ok('PUT budget → 200')
    else fail(`PUT budget → ${budget.status} ${JSON.stringify(budget.body).slice(0, 120)}`)

    const director = await api(`/api/cluster/${clusterId}/director`, {
      method: 'PUT',
      body: JSON.stringify({ walletAddress: wallet, directorFirstYearPay: 180, directorFirstYearHours: 40 }),
    })
    if (director.status === 200) ok('PUT director → 200')
    else fail(`PUT director → ${director.status} ${JSON.stringify(director.body).slice(0, 120)}`)
  }

  const after = (await api(`/api/cluster/${clusterId}/gd-presentation?${qa}`)).body?.missing_data || []
  if (!after.includes('budget_total') && !after.includes('director_pay') && !after.includes('director_hours')) {
    ok('los tres datos numéricos ya no faltan')
  } else {
    fail(`siguen faltando: ${after.join(', ')} (antes: ${before.join(', ')})`)
  }
  if (after.includes('budget_pdf') && after.includes('director_offer_pdf')) ok('los dos PDF siguen pendientes')

  await loadClusterPage()
  const numbers = await page.evaluate(() =>
    Array.from(document.querySelectorAll('input[type="number"]')).map((input) => input.value))
  if (numbers[0] === '400' && numbers[1] === '180' && numbers[2] === '40') {
    ok(`la página muestra los valores guardados (${numbers.join(' / ')})`)
  } else {
    fail(`la página muestra otros valores: ${JSON.stringify(numbers)}`)
  }

  // ── 4. Billetera del clúster ───────────────────────────────────────
  console.log('\n── 4. Billetera del clúster ──')
  const invalid = await api(`/api/cluster/${clusterId}`, {
    method: 'PATCH',
    body: JSON.stringify({ walletAddress: wallet, clusterWallet: 'no-es-una-direccion' }),
  })
  if (invalid.status === 400) ok('billetera inválida → 400')
  else fail(`billetera inválida → ${invalid.status}`)

  const zero = await api(`/api/cluster/${clusterId}`, {
    method: 'PATCH',
    body: JSON.stringify({ walletAddress: wallet, clusterWallet: '0x0000000000000000000000000000000000000000' }),
  })
  if (zero.status === 400) ok('dirección cero → 400')
  else fail(`dirección cero → ${zero.status}`)

  const foreign = await api(`/api/cluster/${clusterId}`, {
    method: 'PATCH',
    body: JSON.stringify({ walletAddress: wallet, clusterWallet: '0x1111111111111111111111111111111111111111' }),
  })
  if (foreign.status === 400) ok('billetera no registrada → 400')
  else fail(`billetera no registrada → ${foreign.status}`)

  const selfWallet = await api(`/api/cluster/${clusterId}`, {
    method: 'PATCH',
    body: JSON.stringify({ walletAddress: wallet, clusterWallet: wallet }),
  })
  const selfBody = JSON.stringify(selfWallet.body)
  if (selfWallet.status === 200 || /platform or to the contract/.test(selfBody)) {
    ok(`la billetera del iniciador → ${selfWallet.status}`)
  } else {
    fail(`billetera del iniciador → ${selfWallet.status} ${selfBody.slice(0, 120)}`)
  }

  let secondWallet = null
  try {
    secondWallet = await ensureSecondWallet(page, base, wallet, process.env.CHAIN_ID)
    ok(`segunda billetera de la cuenta: ${secondWallet.slice(0, 10)}...`)
  } catch (error) {
    fail(`no se pudo enlazar una segunda billetera: ${error.message}`)
  }
  if (secondWallet) {
    const own = await api(`/api/cluster/${clusterId}`, {
      method: 'PATCH',
      body: JSON.stringify({ walletAddress: wallet, clusterWallet: secondWallet }),
    })
    if (own.status === 200) ok('billetera registrada de la cuenta → 200')
    else fail(`billetera registrada → ${own.status} ${JSON.stringify(own.body).slice(0, 160)}`)
  }

  const missingWallet = (await api(`/api/cluster/${clusterId}/gd-presentation?${qa}`)).body?.missing || []
  if (!missingWallet.includes('cluster_wallet')) ok('la billetera ya no aparece como faltante')
  else fail('la billetera sigue faltando')

  text = await loadClusterPage()
  const shownWallet = secondWallet || wallet
  if (text.toLowerCase().includes(shownWallet.toLowerCase())) ok('la página muestra la billetera configurada')
  else fail('la página no muestra la billetera guardada')

  // ── 5. Aprobación de pastores ──────────────────────────────────────
  console.log('\n── 5. Aprobación de pastores ──')
  await loadClusterPage()
  if (await clickApprove(page)) {
    ok('aprobación pulsada en la interfaz')
    await new Promise((r) => setTimeout(r, 2000))
  } else {
    console.log('  [!] botón de aprobación ausente: se usa el endpoint (pendiente el despliegue)')
    const approval = await api(`/api/cluster/${clusterId}/approval`, {
      method: 'POST',
      body: JSON.stringify({ walletAddress: wallet }),
    })
    if (approval.status === 200) ok('POST approval → 200')
    else fail(`POST approval → ${approval.status} ${JSON.stringify(approval.body).slice(0, 160)}`)
  }

  const ready = (await api(`/api/cluster/${clusterId}/gd-presentation?${qa}`)).body || {}
  if (ready.approvals?.approved >= 1 && !(ready.missing || []).includes('approvals')) {
    ok(`aprobaciones ${ready.approvals.approved}/${ready.approvals.pastors}`)
  } else {
    fail(`aprobaciones inesperadas: ${JSON.stringify(ready.approvals)}`)
  }

  text = await loadClusterPage()
  const approvedLabel = LANG === 'es' ? 'Todos los pastores aprobaron' : 'All the pastors approved'
  if (text.includes(approvedLabel)) ok('la página muestra la aprobación completa')
  else fail('la página no muestra la aprobación completa')

  // ── 6. Solicitud bloqueada mientras falten condiciones ─────────────
  console.log('\n── 6. Solicitud bloqueada ──')
  const request = await api(`/api/cluster/${clusterId}/gd-presentation`, {
    method: 'POST',
    body: JSON.stringify({ walletAddress: wallet }),
  })
  if (request.status >= 400) ok(`POST gd-presentation → ${request.status} (faltan condiciones)`)
  else fail(`POST gd-presentation → ${request.status} (se esperaba rechazo)`)
  if ((ready.missing || []).some((key) => ['cluster_active', 'cluster_members'].includes(key))) {
    ok(`condiciones pendientes: ${ready.missing.join(', ')}`)
  }

  // ── 7. Renombrar ───────────────────────────────────────────────────
  console.log('\n── 7. Renombrar ──')
  const newName = `E2E Cluster ${Date.now().toString(36)}`
  const renamed = await api(`/api/cluster/${clusterId}`, {
    method: 'PATCH',
    body: JSON.stringify({ walletAddress: wallet, name: newName }),
  })
  if (renamed.status === 200) ok('PATCH nombre → 200')
  else fail(`PATCH nombre → ${renamed.status}`)
  text = await loadClusterPage()
  if (text.includes(newName)) ok('la página muestra el nombre nuevo')
  else fail('la página no muestra el nombre nuevo')

  // ── 8. Fuera de alcance ────────────────────────────────────────────
  console.log('\n── 8. Fuera de alcance ──')
  skip('estado `sent`: exige los 3 pastores listos (curso completo, invitaciones, puntaje > 90) y escribe en el contrato')
  skip('estado `answered` y liberación del fondo: exige el fondo del país en ClusterFundsV2 y la firma del operador')

  // ── 9. Limpieza ────────────────────────────────────────────────────
  console.log('\n── 9. Limpieza ──')
  const left = await api(`/api/cluster/${clusterId}/leave`, {
    method: 'POST',
    body: JSON.stringify({ walletAddress: wallet }),
  })
  if (left.status === 200) ok(`la iglesia sale del clúster #${clusterId}`)
  else {
    const disband = await admin(`/api/admin/clusters/${clusterId}`, { method: 'DELETE' })
    if ([200, 204].includes(disband.status)) ok(`clúster #${clusterId} disuelto`)
    else fail(`no se pudo limpiar el clúster #${clusterId} (${left.status}/${disband.status})`)
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
