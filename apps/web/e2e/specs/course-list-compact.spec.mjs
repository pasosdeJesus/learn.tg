#!/usr/bin/env node
// E2E: la lista de cursos (`/en`, `/es`) muestra tarjetas compactas — imagen, título,
// descripción, el botón "Ir al curso" y los tres círculos de estado sobre el borde —
// sin el párrafo de estadísticas ni la fila de donación
// (https://github.com/pasosdeJesus/learn.tg/issues/272).
//
// Los círculos solo existen cuando la tarjeta tiene avance (`/api/scholarship`), así que
// el spec inicia sesión con una billetera nueva y espera a que aparezcan.
//
// Ejecución:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 CHAIN_ID=11142220 \
//     bin/m test:e2e course-list-compact

import { fail, gotoWithRetry, initTestEnv, launchBrowser, ok, resetFailures, resolveSiteTarget, retry, summary } from '@pasosdejesus/m/e2e'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11142220', 10)

async function waitForCards(page, timeout) {
  await page.waitForFunction(
    () => document.querySelectorAll('article').length > 0,
    { timeout },
  )
  for (let i = 0; i < 30; i++) {
    const ready = await page.evaluate(() =>
      [...document.querySelectorAll('article')].some(
        (a) => a.querySelector('[data-testid^="progress-circle-"]') !== null,
      ),
    )
    if (ready) break
    await new Promise((r) => setTimeout(r, 2000))
  }
}

async function readCards(page) {
  return page.evaluate(() => {
    return [...document.querySelectorAll('article')].map((a) => ({
      text: (a.textContent || '').replace(/\s+/g, ' ').trim(),
      href: a.querySelector('a')?.getAttribute('href') || '',
      circles: [...a.querySelectorAll('[data-testid^="progress-circle-"]')].map((c) => ({
        key: c.getAttribute('data-testid'),
        state: c.getAttribute('data-state'),
      })),
    }))
  })
}

async function checkLang(page, base, { lang, countRe, button, timeout }) {
  await gotoWithRetry(page, `${base}/${lang}`, { waitUntil: 'domcontentloaded', timeout })
  await waitForCards(page, timeout)
  const body = (await page.evaluate(() => document.body?.innerText || '')).replace(/\s+/g, ' ')
  const cards = await readCards(page)

  if (!countRe.test(body)) fail(`[${lang}] falta la línea con el número de cursos ("6 courses" / "6 cursos")`)
  else ok(`[${lang}] línea con el número de cursos presente`)

  if (cards.length === 0) {
    fail(`[${lang}] no se renderizó ninguna tarjeta de curso`)
    return
  }

  const statsLeak = cards.filter((c) => /Scholarship of|Beca de/i.test(c.text))
  if (statsLeak.length > 0) fail(`[${lang}] ${statsLeak.length} tarjeta(s) todavía muestran el párrafo de estadísticas`)
  else ok(`[${lang}] ninguna tarjeta muestra el párrafo de estadísticas`)

  const noButton = cards.filter((c) => !c.text.includes(button))
  if (noButton.length > 0) fail(`[${lang}] ${noButton.length} tarjeta(s) sin el botón "${button}"`)
  else ok(`[${lang}] todas las tarjetas conservan el botón "${button}"`)

  const withCircles = cards.filter((c) => c.circles.length === 3)
  if (withCircles.length === 0) {
    fail(`[${lang}] ninguna tarjeta muestra los tres círculos de estado`)
  } else {
    const expected = ['check', 'usdt', 'slearn']
    const bad = withCircles.filter((c) =>
      !expected.every((k) => c.circles.some((x) => x.key === `progress-circle-${k}`)),
    )
    if (bad.length > 0) fail(`[${lang}] ${bad.length} tarjeta(s) sin los tres círculos esperados`)
    else ok(`[${lang}] ${withCircles.length} tarjeta(s) con los tres círculos (guías, USDT, SLEARN)`)

    const badState = withCircles.flatMap((c) => c.circles.filter((x) => !['done', 'available', 'blocked'].includes(x.state || '')))
    if (badState.length > 0) fail(`[${lang}] ${badState.length} círculo(s) con estado inválido`)
    else ok(`[${lang}] los círculos tienen un estado válido (done/available/blocked)`)
  }

  const noNav = cards.filter((c) => !c.href.includes(`/${lang}/`))
  if (noNav.length > 0) fail(`[${lang}] ${noNav.length} tarjeta(s) no navegan a un curso`)
  else ok(`[${lang}] todas las tarjetas siguen enlazando al curso`)
}

async function main() {
  const t0 = performance.now()
  resetFailures()
  const env = await initTestEnv()
  const { timeout } = env
  const { base } = resolveSiteTarget(env)

  const pk = generatePrivateKey()
  const account = privateKeyToAccount(pk)
  console.log(`Billetera nueva: ${account.address} | ${base} (chain ${CHAIN_ID})\n`)

  const browser = await launchBrowser()
  const page = await retry(async () => {
    const p = await browser.newPage()
    p.on('pageerror', (e) => console.log(`  [PAGEERR] ${e.message}`))
    await setupE2EAuth(p, account.address, pk, CHAIN_ID, base)
    return p
  }, { label: 'setupE2EAuth' })
  ok('billetera autenticada (SIWE)')

  await page.screenshot({ path: '/tmp/course-list-compact-en.png' }).catch(() => {})
  await checkLang(page, base, { lang: 'en', countRe: /\d+ courses?/, button: 'Go to course', timeout })
  await checkLang(page, base, { lang: 'es', countRe: /\d+ cursos?/, button: 'Ir al curso', timeout })
  await page.screenshot({ path: '/tmp/course-list-compact-es.png' }).catch(() => {})

  await browser.close()
  const failures = summary(t0)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
