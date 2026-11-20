#!/usr/bin/env node
// E2E de las guías GD **ya pintadas** en el navegador (R-#297 §4): secciones,
// diagramas con su imagen descargada, un enlace hacia adelante y el texto sin el
// código de 6 caracteres retirado en R-#299.
//
// Es el complemento de `lib/__tests__/guides-content.test.ts`: aquel mira el
// Markdown del repositorio, este mira lo que el sitio sirve. Los dos fallos que
// sólo se ven aquí son la guía que se pinta a medias (renderer) y el `<img>`
// apuntando a un SVG que el servidor no tiene (`guide-diagrams` comprueba el
// archivo; aquí se comprueba que el navegador lo cargue).
//
// Las 12 guías son del curso GD (premium) y el curso se compra **por idioma**
// (curso 10 en inglés, 11 en español): hace falta una billetera del registro con
// `hasGdCourse`. Las guías del idioma que esa billetera no compró muestran la
// tarjeta "curso premium" en vez del texto; el spec lo informa como `[SKIP]` de ese
// idioma (es una compra que falta, no un fallo del producto) y exige que el resto
// se pinte completo. Sin ninguna billetera con el curso se omite entero.
//
// Ejecución:
//   make test-e2e-spec SPEC=guide-pages
//   SITE_URL=https://learn.tg:9001 node e2e/specs/guide-pages.spec.mjs

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fail, initTestEnv, launchBrowser, newPage, ok, resetFailures, resolveSiteTarget, summary } from '@pasosdejesus/m/e2e'
import { extractMermaidDiagrams } from '../../lib/remarkMermaid.mjs'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'
import { oldestFreeWallet } from '../helpers/e2e-wallets-registry.mjs'

const RESOURCES = join(process.cwd(), '..', '..', 'resources')
const COURSES = [
  { lang: 'en', prefix: 'gdcluster', suffix: (n) => `guide${n}` },
  { lang: 'es', prefix: 'redgd', suffix: (n) => `guia${n}` },
]

/** El código de 6 caracteres que R-#299 quitó; sólo queda el de referido (8). */
const STALE_CODE = /c[oó]digo de 6|6[- ]character code|six[- ]character code|c[oó]digo de seis/i
/** Cada guía dice dónde se hace lo que pide: la página del clúster o otra guía. */
const POINTS_ONWARD = /\/(?:en\/gdcluster|es\/redgd)\/(?:guide|guia)\d|(\/(?:en|es)\/cluster)/

function targets() {
  const list = []
  for (const course of COURSES) {
    for (let n = 1; n <= 6; n++) {
      const suffix = course.suffix(n)
      const file = join(RESOURCES, course.lang, course.prefix, `${suffix}.md`)
      const markdown = existsSync(file) ? readFileSync(file, 'utf8') : ''
      list.push({
        path: `/${course.lang}/${course.prefix}/${suffix}`,
        name: `${course.lang}/${suffix}`,
        diagrams: markdown ? extractMermaidDiagrams(markdown).length : 0,
      })
    }
  }
  return list
}

/** Texto pintado, tarjeta de curso premium, o nada (timeout). */
async function waitState(page, timeout) {
  try {
    const handle = await page.waitForFunction(
      () => {
        const el = document.querySelector('[aria-label="Guide text"]')
        if ((el?.textContent || '').trim().length > 200) return 'guide'
        const body = document.body.innerText || ''
        if (/premium course|curso premium|c[oó]mpralo para acceder|buy it to access/i.test(body)) return 'paywall'
        return false
      },
      { timeout: Math.min(timeout, 20000), polling: 250 },
    )
    return await handle.jsonValue()
  } catch {
    return 'unknown'
  }
}

/** Espera a que el navegador tenga cargadas las imágenes de los diagramas. */
async function waitImages(page, expected, timeout) {
  if (expected === 0) return
  try {
    await page.waitForFunction(
      (count) => {
        const images = Array.from(document.querySelectorAll('img[src*="/img/diagrams/"]'))
        return images.length >= count && images.every((img) => img.complete && img.naturalWidth > 0)
      },
      { timeout: Math.min(timeout, 15000) },
      expected,
    )
  } catch {
    // Se informa abajo, imagen por imagen.
  }
}

async function inspect(page) {
  return page.evaluate(() => {
    const container = document.querySelector('[aria-label="Guide text"]')
    const text = container?.textContent || ''
    return {
      chars: text.trim().length,
      text,
      sections: Array.from(container?.querySelectorAll('h2') || []).map((h) => (h.textContent || '').trim()),
      images: Array.from(document.querySelectorAll('img[src*="/img/diagrams/"]')).map((img) => ({
        src: img.getAttribute('src') || '',
        complete: img.complete,
        width: img.naturalWidth,
      })),
      links: Array.from(document.querySelectorAll('a[href]')).map((a) => a.getAttribute('href') || ''),
    }
  })
}

async function main() {
  const t0 = performance.now()
  resetFailures()

  if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
  if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
  if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'

  const env = await initTestEnv()
  const { timeout } = env
  const { base } = resolveSiteTarget(env)

  const buyer = oldestFreeWallet({ withGdCourse: true })
  if (!buyer?.privateKey || !buyer?.address) {
    console.log(
      '  [SKIP] no hay billetera con el curso GD en el registro: ' +
        'crea una con FUND_FRESH=1 make test-e2e-spec SPEC=premium-course-checkout',
    )
    process.exit(0)
  }

  const browser = await launchBrowser(env.headless)
  const page = await newPage(browser, buyer.address, timeout)

  try {
    await setupE2EAuth(page, buyer.address, buyer.privateKey, process.env.CHAIN_ID, base)
    ok(`sesión iniciada con ${buyer.address.slice(0, 10)}… (dueña del curso GD)`)
  } catch (error) {
    fail(`no se pudo iniciar sesión con la billetera del curso: ${error.message}`)
    await browser.close()
    summary(t0)
    process.exit(1)
  }

  let verified = 0
  const paywalled = new Set()
  for (const target of targets()) {
    await page.goto(`${base}${target.path}`, { waitUntil: 'domcontentloaded' })
    const state = await waitState(page, timeout)
    if (state === 'paywall') {
      // Compra pendiente en ese idioma: se informa una vez por idioma, no seis.
      const lang = target.name.split('/')[0]
      if (!paywalled.has(lang)) {
        paywalled.add(lang)
        console.log(
          `  [SKIP] ${lang}: la billetera no compró el curso en este idioma ` +
            `(compra el curso ${target.name} para cubrir sus guías)`,
        )
      }
      continue
    }
    if (state !== 'guide') {
      fail(`${target.name}: la guía no se pintó (ni texto ni tarjeta de curso premium)`)
      continue
    }
    verified++
    await waitImages(page, target.diagrams, timeout)
    const info = await inspect(page)

    if (info.sections.length === 0) {
      fail(`${target.name}: la guía no tiene secciones (h2)`)
    } else {
      ok(`${target.name}: ${info.sections.length} secciones, ${info.chars} caracteres`)
    }

    if (target.diagrams > 0) {
      const broken = info.images.filter((img) => !img.complete || img.width === 0)
      if (info.images.length < target.diagrams) {
        fail(
          `${target.name}: ${info.images.length} de ${target.diagrams} diagramas en la página ` +
            '(el Markdown tiene bloques ```mermaid que el renderer no pintó)',
        )
      } else if (broken.length > 0) {
        for (const img of broken) fail(`${target.name}: la imagen no cargó → ${img.src}`)
      } else {
        ok(`${target.name}: ${info.images.length} diagrama(s) cargados (naturalWidth > 0)`)
      }
    }

    const onward = info.links.filter((href) => POINTS_ONWARD.test(href))
    if (onward.length === 0) {
      fail(`${target.name}: no enlaza a la página del clúster ni a otra guía`)
    } else {
      ok(`${target.name}: ${onward.length} enlace(s) hacia adelante`)
    }

    const stale = STALE_CODE.exec(info.text)
    if (stale) {
      fail(`${target.name}: el texto todavía enseña "${stale[0]}" (R-#299 lo retiró)`)
    }
  }

  await browser.close()

  if (verified === 0) {
    console.log(
      '  [SKIP] ninguna guía se pintó: la billetera no tiene ningún curso GD comprado ' +
        '(premium-course-checkout compra el curso en inglés)',
    )
    process.exit(0)
  }

  const seconds = ((performance.now() - t0) / 1000).toFixed(1)
  console.log(`\nDuración: ${seconds}s`)
  const failures = summary(t0)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
