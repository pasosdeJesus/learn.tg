// Deja un clúster **listo** para presentarse a Global Disciples, todo por la interfaz
// (https://github.com/pasosdeJesus/learn.tg/issues/161).
//
// Lo usan `cluster-ready.spec.mjs` (solo comprueba el resultado) y
// `cluster-flow.spec.mjs` (sigue con el verificador). Nada se escribe a mano en la
// base: tres pastores forman el clúster, se fija la billetera, se registran
// presupuesto y oferta con sus PDF, cada pastor resuelve las seis guías, el
// verificador confirma sus datos (puntaje > 90) y fija las invitaciones, y cada
// pastor aprueba.

import * as fs from 'node:fs'
import { newIncognitoContext, newIncognitoPage } from '@pasosdejesus/m/e2e'
import { SiweMessage } from 'siwe'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { setupE2EAuth } from './e2e-auth.mjs'
import { apiOn } from './e2e-fixture.mjs'
import { completeGuides } from './guides.mjs'
import { rememberWallet } from './e2e-wallets-registry.mjs'

import { ensureCourseVault } from './course-vault.mjs'

export const PDF_PATH = '/tmp/e2e-cluster-budget.pdf'

const LABELS = {
  en: { create: 'Create a cluster', name: 'Cluster name', code: '6-char code', join: 'Join', save: ['Save'], approve: /i know and approve/i },
  es: { create: 'Crear un clúster', name: 'Nombre del clúster', code: 'Código de 6 caracteres', join: 'Unirse', save: ['Guardar'], approve: /conozco y apruebo/i },
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

export async function clickApprove(page) {
  return page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('button'))
      .find((b) => /i know and approve|conozco y apruebo/i.test(b.textContent || ''))
    if (!button) return false
    button.click()
    return true
  })
}

/** Abre una sesión con reintentos, cada intento con contexto y página nuevos. */
export async function openSession(browser, creds, base, timeout, chainId, attempts = 3) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const context = await newIncognitoContext(browser)
    const page = await newIncognitoPage(context, creds.address, timeout)
    await page.setDefaultNavigationTimeout(180000)
    try {
      await setupE2EAuth(page, creds.address, creds.pk, chainId, base)
      const profile = await apiOn(page, `/api/profile?walletAddress=${creds.address}`)
      if (profile.status === 200 && profile.body?.id) return { page, context, profile: profile.body }
      console.log(`  [retry] sesión sin perfil (${profile.status})`)
    } catch (error) {
      console.log(`  [retry] sesión falló: ${error.message}`)
    }
    await new Promise((r) => setTimeout(r, 5000))
  }
  throw new Error(`no se pudo iniciar sesión como ${creds.address.slice(0, 10)}`)
}

/**
 * Prepara el clúster listo. Con `solveGuides: false` se detiene antes de los
 * crucigramas (el fondo queda vacío: sirve para probar la validación de la solicitud).
 * @returns {{clusterId:number, sessions:any[], verifierPage:any, ready:any}}
 */
export async function prepareReadyCluster({
  browser,
  base,
  timeout,
  chainId,
  lang,
  pastors,
  verifier,
  log = () => {},
  fail = () => {},
  ok = () => {},
  solveGuides = true,
}) {
  const t = LABELS[lang === 'es' ? 'es' : 'en']
  const course = lang === 'es' ? { prefix: 'redgd', suffix: (n) => `guia${n}` } : { prefix: 'gdcluster', suffix: (n) => `guide${n}` }
  writeTinyPdf(PDF_PATH)

  const verifierSession = await openSession(browser, verifier, base, timeout, chainId)
  const verifierPage = verifierSession.page
  const verifierApi = (path, init) =>
    apiOn(verifierPage, path.includes('?') ? `${path}&wallet=${verifier.address}` : `${path}?wallet=${verifier.address}`, init)

  const sessions = []
  for (const pastor of pastors) {
    const session = await openSession(browser, pastor, base, timeout, chainId)
    sessions.push({ pastor, page: session.page })
  }
  const initiator = sessions[0]

  // 1. Fixture y limpieza
  for (const session of sessions) {
    const fixture = await (async () => {
      const { ensurePastorFixture } = await import('./e2e-fixture.mjs')
      return ensurePastorFixture({
        verifierPage,
        verifierAddress: verifier.address,
        pastorPage: session.page,
        pastor: session.pastor,
        churchName: `E2E ${session.pastor.variable} Church`,
      })
    })()
    const status = await apiOn(session.page, `/api/cluster/status?walletAddress=${session.pastor.address}`)
    if (status.body?.hasCluster) {
      await apiOn(session.page, `/api/cluster/${status.body.clusterId}/leave`, {
        method: 'POST',
        body: JSON.stringify({ walletAddress: session.pastor.address }),
      })
    }
    session.fixture = fixture
    ok(`${session.pastor.variable}: perfil #${fixture.userId}, iglesia #${fixture.churchId}`)
  }

  // 2. Clúster activo con tres iglesias
  const name = `E2E Listo ${Date.now().toString(36)}`
  let clusterId = null
  let code = null
  for (let attempt = 0; attempt < 2 && !clusterId; attempt++) {
    await initiator.page.goto(`${base}/${lang}/cluster`, { waitUntil: 'domcontentloaded' })
    await initiator.page.waitForFunction((label) => (document.body?.innerText || '').includes(label), { timeout: 60000 }, t.create).catch(() => {})
    await clickButton(initiator.page, [t.create])
    await initiator.page.waitForFunction((label) => (document.body?.innerText || '').includes(label), { timeout: 20000 }, t.name).catch(() => {})
    await fillByLabel(initiator.page, t.name, name)
    await clickButton(initiator.page, [t.create], true)
    await new Promise((r) => setTimeout(r, 5000))
    const status = await apiOn(initiator.page, `/api/cluster/status?walletAddress=${initiator.pastor.address}`)
    clusterId = status.body?.clusterId || null
    code = status.body?.cluster?.code || null
  }
  if (!clusterId) throw new Error('la interfaz no creó el clúster')
  ok(`clúster #${clusterId} (${code})`)

  for (const session of sessions.slice(1)) {
    let filled = false
    for (let attempt = 0; attempt < 2 && !filled; attempt++) {
      await session.page.goto(`${base}/${lang}/cluster/${clusterId}`, { waitUntil: 'domcontentloaded' })
      await session.page.waitForFunction(
        (placeholder) => !!Array.from(document.querySelectorAll('input')).find((i) => (i.placeholder || '') === placeholder),
        { timeout: 60000 },
        t.code,
      ).catch(() => {})
      filled = await fillByLabel(session.page, t.code, code)
    }
    if (filled) await clickButton(session.page, [t.join])
    await new Promise((r) => setTimeout(r, 3000))
  }
  const cluster = await apiOn(initiator.page, `/api/cluster/${clusterId}?walletAddress=${initiator.pastor.address}`)
  if (cluster.body?.members?.length === 3 && cluster.body?.status === 'active') ok('clúster activo con 3 iglesias')
  else fail(`clúster: ${cluster.body?.status} / ${cluster.body?.members?.length} iglesias`)

  // 3. Billetera, presupuesto y oferta
  const existing = await apiOn(initiator.page, `/api/cluster/${clusterId}?walletAddress=${initiator.pastor.address}`)
  if (existing.body?.cluster_wallet) {
    ok('billetera del clúster ya configurada')
  } else {
    const linked = privateKeyToAccount(generatePrivateKey())
    const nonce = await initiator.page.evaluate(async () => {
      const res = await fetch('/api/auth/csrf')
      return (await res.json()).csrfToken
    })
    const message = new SiweMessage({
      domain: new URL(base).host, address: linked.address, statement: 'Sign in to Learn through games.',
      uri: base, version: '1', chainId, nonce,
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
    else fail(`billetera del clúster → ${walletSet.status}`)
  }

  await initiator.page.goto(`${base}/${lang}/cluster/${clusterId}`, { waitUntil: 'domcontentloaded' })
  await initiator.page.waitForFunction(() => document.querySelectorAll('input[type="number"]').length >= 3, { timeout: 45000 }).catch(() => {})
  if (await fillNumbers(initiator.page, [400, 180, 40])) ok('valores del presupuesto y del director escritos')
  else fail('no aparecieron los campos numéricos del panel')
  await clickButton(initiator.page, t.save)
  await new Promise((r) => setTimeout(r, 2500))
  await fillNumbers(initiator.page, [400, 180, 40])
  await clickButton(initiator.page, t.save, true)
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

  // La beca sale de la bóveda del curso y el 10% del clúster solo se mueve si hay
  // beca: con la bóveda vacía la guía se acredita pero el fondo del clúster nunca se
  // registra en ClusterFundsV2 y la presentación no se puede verificar. Se asegura
  // antes de resolver los crucigramas, con el clúster y su billetera YA creados.
  const vault = await ensureCourseVault({ page: verifierPage, wallet: verifier.address, pk: verifier.pk })
  if (vault.ok) ok(`bóveda del curso con ${vault.balance.usdt.toFixed(2)} USDT / ${vault.balance.slearn.toFixed(2)} SLEARN`)
  else console.log(`  [WARN] bóveda del curso sin fondos suficientes: ${vault.reason || 'saldo bajo'}`)

  // 4. Puntaje verificado e invitaciones (antes de las guías: la beca necesita el puntaje)
  for (const session of sessions) {
    const profile = await apiOn(session.page, `/api/profile?walletAddress=${session.pastor.address}`)
    const user = profile.body || {}
    const phone = user.whatsapp || `+23276${String(session.fixture.userId).slice(-6).padStart(6, '0')}`
    const patch = await verifierApi(`/api/admin/user/${session.fixture.userId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        passport_name: user.nombre,
        passport_nationality: user.pais_id,
        whatsapp: phone,
        verified_email: user.email,
        verified_whatsapp: phone,
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

  for (let i = 0; i < sessions.length; i++) {
    const referred = sessions[(i + 1) % sessions.length]
    await verifierApi(`/api/admin/user/${referred.fixture.userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ referrer: String(sessions[i].fixture.userId) }),
    })
  }
  ok('invitaciones entre pastores (invite_pastor)')

  let members = 0
  for (const session of sessions) {
    const memberKey = generatePrivateKey()
    const member = privateKeyToAccount(memberKey)
    const memberSession = await openSession(browser, { pk: memberKey, address: member.address, variable: 'miembro' }, base, timeout, chainId)
    const profile = await apiOn(memberSession.page, `/api/profile?walletAddress=${member.address}`)
    const assigned = await verifierApi(`/api/admin/user/${profile.body?.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ pais_id: 694, religion_id: 2, church_id: session.fixture.churchId, church_relationship: 'member' }),
    })
    const referred = await verifierApi(`/api/admin/user/${profile.body?.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ referrer: String(session.fixture.userId) }),
    })
    if (assigned.status === 200 && referred.status === 200) members++
    rememberWallet({ privateKey: memberKey, address: member.address, role: 'member', note: 'cluster-ready' })
    await memberSession.page.goto('about:blank').catch(() => {})
    await memberSession.context.close().catch(() => {})
  }
  if (members === 3) ok('un miembro de la iglesia de cada pastor (invite_member)')
  else fail(`miembros preparados: ${members}/3`)

  // 5. Guías (después del puntaje y las invitaciones: con la beca pagándose, el
  // 10% del iniciador llega al fondo del clúster y lo registra en el contrato).
  if (solveGuides) {
    const suffixes = [1, 2, 3, 4, 5, 6].map((n) => course.suffix(n))
    for (const session of sessions) {
      const results = await completeGuides(session.page, base, { lang, prefix: course.prefix, suffixes })
      const done = results.filter((r) => r.accepted).length
      if (done === suffixes.length) ok(`${session.pastor.variable}: 6/6 guías`)
      else {
        const failed = results.filter((result) => !result.accepted)
          .map((result) => `${result.suffix}: ${result.status ?? 'sin respuesta'} points=${result.points ?? '-'} ${result.scholarship ?? ''} ${result.error ?? ''}`)
        console.log(`  [WARN] ${session.pastor.variable}: ${done}/6 guías · ${failed.join(' | ')}`)
      }
      await session.page.goto('about:blank').catch(() => {})
    }
    for (const session of sessions) {
      await session.page.goto(`${base}/${lang}`, { waitUntil: 'domcontentloaded' }).catch(() => {})
    }

  }

  // 6. Aprobaciones
  for (const session of sessions) {
    await session.page.goto(`${base}/${lang}/cluster/${clusterId}`, { waitUntil: 'domcontentloaded' })
    await session.page.waitForFunction(
      () => Array.from(document.querySelectorAll('button')).some((b) => /i know and approve|conozco y apruebo/i.test(b.textContent || '')),
      { timeout: 45000 },
    ).catch(() => {})
    const clicked = await clickApprove(session.page)
    if (!clicked) fail(`${session.pastor.variable}: sin botón de aprobación`)
    await new Promise((r) => setTimeout(r, 2500))
  }

  const presentation = await apiOn(initiator.page, `/api/cluster/${clusterId}/gd-presentation?walletAddress=${initiator.pastor.address}`)
  const ready = presentation.body || {}
  log(`ready=${ready.ready} missing=${JSON.stringify(ready.missing)}`)
  if (ready.ready !== true || (ready.missing || []).length > 0) {
    // `missing` vacío con `ready=false` significa que falta algo **por pastor**
    // (guides, puntaje, invitaciones): se imprime, y `reasons` lo dice en palabras
    // (2026-11-05, antes el fallo no decía qué pastor ni qué le faltaba).
    const blocking = (ready.pastors || [])
      .filter((pastor) => (pastor.missing || []).length > 0)
      .map((pastor) => ({ church: pastor.church_name, missing: pastor.missing, reasons: pastor.reasons }))
    fail(`todavía no está listo: ${JSON.stringify({ missing: ready.missing, missing_data: ready.missing_data, reasons: ready.reasons, pastors: blocking })}`)
  }

  return { clusterId, sessions, verifierPage, verifierApi, ready }
}
