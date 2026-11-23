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
  const registered = walletSelector() ? null : oldestFreeWallet({ withGdCourse: true })
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
    const failures = summary(t0)
    await browser.close()
    process.exit(failures > 0 ? 1 : 0)
  }

  // Sin el curso pagado no se puede crear el clúster; se avisa en vez de fallar con un
  // 403 genérico (el curso lo compra `premium-course-checkout`).
  if (fixture && !fixture.ownsGdCourse) {
    console.log('  [SKIP] la billetera no tiene el curso GD: corre antes FUND_FRESH=1 make test-e2e-spec SPEC=premium-course-checkout')
    await browser.close()
    process.exit(0)
  }

  const status = await api(`/api/cluster/status?${qa}`)
  let clusterId = null
  if (status.body?.hasCluster) {
    const list = await admin('/api/admin/clusters')
    const mine = (list.body?.clusters || []).find((row) => row.initiator_church_id === fixture.churchId)
    if (mine && mine.status !== 'disbanded') {
      // Sólo sirve reutilizarlo si sigue en `forming` y sin la billetera aprobada: desde
      // la aprobación del iniciador (REQ/161 §4.7) la billetera es fija y las tarjetas de
      // datos ya se ven, así que las comprobaciones de esta spec no aplican.
      const detail = await api(`/api/cluster/${mine.id}?walletAddress=${wallet}`)
      const fresh = String(detail.body?.gd_status ?? 'forming') === 'forming'
        && !(detail.body?.cluster_wallet)
      if (fresh) {
        clusterId = mine.id
        ok(`reutiliza el clúster #${clusterId}`)
      } else {
        const left = await api(`/api/cluster/${mine.id}/leave`, {
          method: 'POST',
          body: JSON.stringify({ walletAddress: wallet }),
        })
        if (left.status !== 200) {
          const disbanded = await admin(`/api/admin/clusters/${mine.id}`, { method: 'DELETE' })
          if ([200, 204].includes(disbanded.status)) ok(`clúster #${mine.id} disuelto para empezar de cero`)
          else fail(`no se pudo liberar el clúster #${mine.id} (${left.status}/${disbanded.status})`)
        } else {
          ok(`libera la iglesia del clúster #${mine.id}`)
        }
      }
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
    await browser.close()
    const failures = summary(t0)
    process.exit(failures > 0 ? 1 : 0)
  }

  // ── 2. Página del clúster en formación ─────────────────────────────
  // R-#299: hay una sola página privada, /{lang}/cluster, y mientras el clúster se
  // forma muestra sólo nombre/alias, iglesias, invitaciones, balances/donaciones e
  // historial; presupuesto, director, aprobación y presentación aparecen con 3 iglesias.
  console.log('\n── 2. Página del clúster (formación) ──')
  const clusterUrl = `${base}/${LANG}/cluster`
  const loadPage = async () => {
    await page.goto(clusterUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () => /Member Churches|Iglesias Miembros|Cluster fund balance|Balance del fondo del clúster/
        .test(document.body?.innerText || ''),
      { timeout },
    ).catch(() => {})
    await new Promise((r) => setTimeout(r, 800))
    return page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
  }

  let text = await loadPage()
  if (/Connection Error/.test(text)) fail('la página muestra "Connection Error"')
  else ok('la página no muestra "Connection Error"')

  const shows = (en, es) => text.includes(en) || text.includes(es)
  for (const [en, es] of [
    ['Member Churches', 'Iglesias Miembros'],
    ['Invitations', 'Invitaciones'],
    ['Cluster fund balance', 'Balance del fondo del clúster'],
    ['Country fund balance', 'Balance del fondo del país'],
    ['Donations to the cluster fund', 'Donaciones al fondo del clúster'],
    ['History', 'Historial'],
  ]) {
    if (shows(en, es)) ok(`tarjeta presente: ${en}`)
    else fail(`falta la tarjeta ${en} | página: ${text.slice(0, 240)}`)
  }
  // La fase de la billetera ya se ve mientras el clúster se forma (REQ/161 §4.7): su
  // subtítulo es "Pastors approval for the cluster wallet", distinto de la tarjeta de
  // aprobación de los datos, que sigue oculta hasta tener las tres iglesias.
  for (const [en, es] of [
    ['Fourth year budget', 'Presupuesto del cuarto año'],
    ['Program Director', 'Director del programa'],
    ['Present to Global Disciples', 'Presentar el clúster a Global Disciples'],
  ]) {
    if (shows(en, es)) fail(`un clúster en formación no debería mostrar ${en}`)
    else ok(`oculta mientras se forma: ${en}`)
  }
  const headings = await page.evaluate(() =>
    Array.from(document.querySelectorAll('h2')).map((h) => h.textContent.replace(/\s+/g, ' ').trim()),
  )
  if (headings.some((h) => /^Pastors approval$|^Aprobación de los pastores$/.test(h))) {
    fail(`un clúster en formación no debería mostrar la tarjeta de aprobación de datos (${headings.join(' | ')})`)
  } else {
    ok('la aprobación de los datos está oculta mientras se forma')
  }
  if (shows('Pastors approval for the cluster wallet', 'Aprobación de los pastores de la billetera del clúster')) {
    ok('la fase de aprobación de la billetera sí se ve mientras se forma')
  } else {
    fail('falta la fase de aprobación de la billetera en la tarjeta de la billetera')
  }
  if (/members in learn\.tg|miembros en learn\.tg/.test(text)) ok('la iglesia muestra sus miembros en learn.tg')
  else fail('la fila de la iglesia no muestra el número de miembros')
  if (/referrals|referidos/.test(text)) ok('la fila de la iglesia muestra los referidos del pastor')
  else fail('la fila de la iglesia no muestra los referidos')

  // ── 3. Alias público ───────────────────────────────────────────────
  console.log('\n── 3. Alias público ──')
  const alias = `e2e-${Date.now().toString(36)}`
  const aliasRes = await api(`/api/cluster/${clusterId}`, {
    method: 'PATCH',
    body: JSON.stringify({ walletAddress: wallet, slug: alias }),
  })
  if (aliasRes.status === 200) ok(`PATCH alias → 200 (${alias})`)
  else fail(`PATCH alias → ${aliasRes.status} ${JSON.stringify(aliasRes.body).slice(0, 160)}`)
  text = await loadPage()
  if (text.includes(alias)) ok('la página muestra el alias nuevo')
  else fail('la página no muestra el alias nuevo')

  const rename = await api(`/api/cluster/${clusterId}`, {
    method: 'PATCH',
    body: JSON.stringify({ walletAddress: wallet, name: 'Otro nombre' }),
  })
  if (rename.status === 400 && rename.body?.code === 'name_not_editable') {
    ok('el nombre interno no se edita desde aquí (400 name_not_editable)')
  } else {
    fail(`PATCH name → ${rename.status} ${JSON.stringify(rename.body).slice(0, 160)}`)
  }

  const invalidAlias = await api(`/api/cluster/${clusterId}`, {
    method: 'PATCH',
    body: JSON.stringify({ walletAddress: wallet, slug: 'mal alias' }),
  })
  if (invalidAlias.status === 400 && invalidAlias.body?.code === 'slug_invalid') ok('alias inválido → 400 slug_invalid')
  else fail(`alias inválido → ${invalidAlias.status}`)

  // ── 4. Billetera del clúster (validación) ──────────────────────────
  console.log('\n── 4. Billetera del clúster (validación) ──')
  // La billetera puede estar ya **fija** (aprobación del iniciador, REQ/161 §4.7) o
  // **con fondos** en ClusterFundsV2 (R-#220 §4): en los dos casos la API contesta 409
  // antes de validar la dirección nueva, y eso también es negar el cambio. Se nombra el
  // código observado para no dar por buena una validación que no llegó a correr.
  const walletRefusal = (response) => {
    if (response.status === 400) return null
    const code = response.body?.code
    if (response.status === 409 && (code === 'gd_fields_locked' || code === 'cluster_wallet_has_funds')) return code
    return undefined
  }
  const invalid = await api(`/api/cluster/${clusterId}`, {
    method: 'PATCH',
    body: JSON.stringify({ walletAddress: wallet, clusterWallet: 'no-es-una-direccion' }),
  })
  if (invalid.status === 400) ok('billetera inválida → 400')
  else if (walletRefusal(invalid)) ok(`la billetera no se puede cambiar (409 ${walletRefusal(invalid)})`)
  else fail(`billetera inválida → ${invalid.status}`)

  const zero = await api(`/api/cluster/${clusterId}`, {
    method: 'PATCH',
    body: JSON.stringify({ walletAddress: wallet, clusterWallet: '0x0000000000000000000000000000000000000000' }),
  })
  if (zero.status === 400) ok('dirección cero → 400')
  else if (walletRefusal(zero)) ok(`la billetera no se puede cambiar (409 ${walletRefusal(zero)})`)
  else fail(`dirección cero → ${zero.status}`)

  const foreign = await api(`/api/cluster/${clusterId}`, {
    method: 'PATCH',
    body: JSON.stringify({ walletAddress: wallet, clusterWallet: '0x1111111111111111111111111111111111111111' }),
  })
  if (foreign.status === 400) ok('una billetera ajena → 400')
  else if (walletRefusal(foreign)) ok(`la billetera no se puede cambiar (409 ${walletRefusal(foreign)})`)
  else fail(`una billetera ajena → ${foreign.status} ${JSON.stringify(foreign.body).slice(0, 120)}`)

  // ── 4b. Presupuesto del cuarto año (API) ───────────────────────────
  // Verifica el renombre `first_year_budget` → `fourth_year_budget` en el motor y en
  // la base del sitio (la migración tiene que estar aplicada).
  console.log('\n── 4b. Presupuesto del cuarto año ──')
  const budget = await api(`/api/cluster/${clusterId}/budget`, {
    method: 'PUT',
    body: JSON.stringify({ walletAddress: wallet, fourthYearBudget: 400 }),
  })
  if (budget.status === 200) ok('PUT budget (fourthYearBudget) → 200')
  else fail(`PUT budget → ${budget.status} ${JSON.stringify(budget.body).slice(0, 160)}`)

  const withBudget = await api(`/api/cluster/${clusterId}/gd-presentation?${qa}`)
  const savedBudget = withBudget.body?.request?.fourth_year_budget
  if (Number(savedBudget) === 400) ok(`la presentación devuelve fourth_year_budget=${savedBudget}`)
  else fail(`fourth_year_budget inesperado (${JSON.stringify(savedBudget)}, ${withBudget.status})`)

  // ── 5. Invitaciones ────────────────────────────────────────────────
  console.log('\n── 5. Invitaciones ──')
  const candidates = await api(`/api/cluster/candidates?${qa}`)
  if (candidates.status === 200) ok(`GET candidates → 200 (${candidates.body?.candidates?.length ?? 0})`)
  else fail(`GET candidates → ${candidates.status}`)

  // La respuesta es uniforme a propósito (no deja enumerar cuentas): se comprueba la
  // forma, no el motivo exacto (la iglesia del fixture puede no estar verificada aún).
  const self = await api('/api/cluster/invitation/wallet', {
    method: 'POST',
    body: JSON.stringify({ walletAddress: wallet, invitedWallet: wallet }),
  })
  if (self.status === 422 && self.body?.code === 'not_invitable' && self.body?.reason) {
    ok(`invitación no procedente → 422 not_invitable (${self.body.reason})`)
  } else {
    fail(`invitación no procedente → ${self.status} ${JSON.stringify(self.body).slice(0, 160)}`)
  }

  // ── 6. Fuera de alcance ────────────────────────────────────────────
  console.log('\n── 6. Fuera de alcance ──')
  skip('presupuesto, director, aprobación y presentación: los cubre cluster-ready con 3 pastores')
  skip('estado `sent` y `answered` con liberación del fondo: necesitan el contrato y la firma del operador')

  // ── 7. Limpieza ────────────────────────────────────────────────────
  console.log('\n── 7. Limpieza ──')
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
  const failures = summary(t0)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
