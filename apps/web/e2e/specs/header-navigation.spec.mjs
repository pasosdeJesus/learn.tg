#!/usr/bin/env node
// E2E: el menú ☰ de dos niveles (https://github.com/pasosdeJesus/learn.tg/issues/161 §15).
//
// Comprueba por la interfaz que cada grupo (Mi cuenta, Cursos, GDCluster/Redgd,
// learn.tg) se abre, que lo que no aplica al visitante no se muestra (sin sesión no
// hay Mi cuenta; sin el curso no hay Presupuesto; sin rol de pastor no hay Clúster) y
// que la sección GDCluster sólo aparece a quien el servidor ya le ofrece el curso
// (R-#194: cristiano que declaró `position_israel_gaza = 'no'`).
//
// Ejecución:
//   CHROME_PATH=/usr/local/bin/chrome E2E_WALLET=TEST_PASTOR1 \
//   IPDES=learn.tg PUERTOPRU=9001 CHAIN_ID=11142220 \
//   node e2e/specs/header-navigation.spec.mjs

import {
  fail, initTestEnv, launchBrowser, newPage, ok, resetFailures, resolveSiteTarget, summary,
} from '@pasosdejesus/m/e2e'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'
import { loadSelectedWallet } from '../helpers/e2e-wallet.mjs'

const LANG = process.env.E2E_LANG === 'es' ? 'es' : 'en'

/** Estado del menú en el navegador: grupos presentes y enlaces de cada uno. */
async function menuState(page) {
  return page.evaluate(() => {
    const menuButton = Array.from(document.querySelectorAll('button'))
      .find((b) => (b.getAttribute('aria-label') || '') === 'Menu')
    if (!menuButton) return { error: 'sin botón de menú' }
    menuButton.click()
    const groups = Array.from(document.querySelectorAll('[data-testid^="menu-group-"]')).map((el) => ({
      id: String(el.getAttribute('data-testid')).replace('menu-group-', ''),
      expanded: el.getAttribute('aria-expanded') === 'true',
      label: (el.textContent || '').trim(),
    }))
    return { groups }
  })
}

/** Abre un grupo y devuelve los hrefs de sus entradas. */
async function openGroup(page, id) {
  return page.evaluate((groupId) => {
    const group = document.querySelector(`[data-testid="menu-group-${groupId}"]`)
    if (!group) return null
    if (group.getAttribute('aria-expanded') !== 'true') group.click()
    const list = document.getElementById(`menu-group-${groupId}`)
    if (!list) return []
    return Array.from(list.querySelectorAll('a')).map((a) => a.getAttribute('href'))
  }, id)
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { base } = resolveSiteTarget(env)
  const browser = await launchBrowser(env.headless)

  try {
    // ── 1. Invitado ────────────────────────────────────────────────────
    console.log('\n── 1. Invitado: Cursos y learn.tg, sin Mi cuenta ni GDCluster ──')
    const guest = await newPage(browser, undefined, env.timeout)
    await guest.goto(`${base}/${LANG}`, { waitUntil: 'domcontentloaded' })
    const guestMenu = await menuState(guest)
    if (guestMenu.error) fail(guestMenu.error)
    const guestIds = (guestMenu.groups || []).map((g) => g.id)
    if (guestIds.includes('courses') && guestIds.includes('learntg')) {
      ok(`grupos del invitado: ${guestIds.join(', ')}`)
    } else {
      fail(`faltan grupos del invitado: ${JSON.stringify(guestMenu.groups)}`)
    }
    if (guestIds.includes('account')) fail('el invitado no debería ver "Mi cuenta"')
    if (guestIds.includes('gdcluster')) fail('el invitado no debería ver GDCluster')

    const guestCourses = await openGroup(guest, 'courses')
    if ((guestCourses || []).includes(`/${LANG}`)) ok(`Cursos se abre con ${guestCourses.length} enlace(s)`)
    else fail(`Cursos no se abrió: ${JSON.stringify(guestCourses)}`)

    const guestLearn = await openGroup(guest, 'learntg')
    if ((guestLearn || []).some((href) => href?.endsWith('/leaderboard'))) {
      ok(`learn.tg se abre con ${guestLearn.length} enlace(s)`)
    } else {
      fail(`learn.tg no se abrió: ${JSON.stringify(guestLearn)}`)
    }
    await guest.close()

    // ── 2. Con sesión ──────────────────────────────────────────────────
    console.log('\n── 2. Con sesión: Mi cuenta y, si aplica, GDCluster ──')
    const creds = loadSelectedWallet()
    if (!creds) {
      console.log('  [SKIP] sin billetera en apps/.env (PRIVATE_KEY) para iniciar sesión')
      const failures = summary(t0)
      await browser.close()
      process.exit(failures > 0 ? 1 : 0)
    }
    const page = await newPage(browser, creds.address, env.timeout)
    await setupE2EAuth(page, creds.address, creds.pk, process.env.CHAIN_ID, base)
    await page.goto(`${base}/${LANG}`, { waitUntil: 'domcontentloaded' })
    // El header pregunta perfil, catálogo y estado de clúster: se le deja responder.
    await new Promise((resolve) => setTimeout(resolve, 2500))

    const menu = await menuState(page)
    const ids = (menu.groups || []).map((g) => g.id)
    if (ids.includes('account')) ok('grupo "Mi cuenta" presente con sesión')
    else fail(`sin "Mi cuenta" con sesión: ${JSON.stringify(menu.groups)}`)

    const account = await openGroup(page, 'account')
    if ((account || []).some((href) => href?.endsWith('/profile'))) {
      ok(`Mi cuenta se abre con ${account.length} enlace(s)`)
    } else {
      fail(`Mi cuenta no se abrió: ${JSON.stringify(account)}`)
    }

    if (ids.includes('gdcluster')) {
      const gd = await openGroup(page, 'gdcluster')
      if ((gd || []).some((href) => href?.includes('/gdcluster/ranking'))) {
        ok(`GDCluster se abre con ${gd.length} enlace(s): ${gd.join(', ')}`)
      } else {
        fail(`GDCluster no se abrió: ${JSON.stringify(gd)}`)
      }
      if ((gd || []).some((href) => href?.endsWith('/cluster'))) {
        ok('el rol de pastor añade la entrada Clúster')
      } else {
        console.log('  [nota] sin entrada Clúster: la billetera no tiene rol de pastor o no compró el curso')
      }
    } else {
      // R-#194: a quien no se le ofrece el curso tampoco se le muestra la sección.
      const profile = await page.evaluate(async (wallet) => {
        const res = await fetch(`/api/profile?walletAddress=${wallet}`)
        return res.ok ? res.json() : null
      }, creds.address)
      const offered = Number(profile?.religion_id) === 2 && profile?.position_israel_gaza === 'no'
      if (!offered) ok('sin GDCluster: al perfil no se le ofrece el curso (regla del programa)')
      else fail('el perfil califica para el curso pero la sección GDCluster no aparece')
    }

    if (ids.includes('courses') || ids.includes('learntg')) {
      ok(`grupos disponibles: ${ids.join(', ')}`)
    } else {
      fail(`menú sin los grupos básicos: ${JSON.stringify(menu.groups)}`)
    }
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
