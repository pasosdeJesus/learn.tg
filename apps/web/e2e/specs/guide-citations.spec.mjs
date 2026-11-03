#!/usr/bin/env node
// E2E: las citas bíblicas de las guías conservan el "capítulo:versículo".
//
// `remark-directive` interpretaba `4:12` como una directiva de texto y el
// navegador mostraba solo "Ecclesiastes 4": el versículo desaparecía en todas
// las guías con citas. Este spec abre las guías de los cursos gratuitos y exige
// la cita completa; las guías premium se omiten si no se pintan.
//
// Ejecución:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 \
//   CHAIN_ID=11142220 node e2e/specs/guide-citations.spec.mjs

import * as fs from 'fs'
import * as path from 'path'
import { fail, initTestEnv, launchBrowser, newPage, ok, resetFailures, resolveSiteTarget, summary } from '@pasosdejesus/m/e2e'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'

function loadEnvCredentials() {
  const paths = [path.join(process.cwd(), '..', '.env'), path.join(process.cwd(), 'apps', '.env'), path.join(process.cwd(), '.env')]
  for (const envPath of paths) {
    if (!fs.existsSync(envPath)) continue
    const content = fs.readFileSync(envPath, 'utf8')
    const pk = content.match(/PRIVATE_KEY="([^"]+)"/)?.[1] || content.match(/PRIVATE_KEY=(\S+)/)?.[1]
    const addr = content.match(/NEXT_PUBLIC_ADDRESS="([^"]+)"/)?.[1] || content.match(/NEXT_PUBLIC_ADDRESS=(\S+)/)?.[1]
    if (pk && addr) return { pk, addr }
  }
  return null
}

const TARGETS = [
  { path: '/en/a-relationship-with-Jesus/guide1', citation: 'Mark 6:50' },
  { path: '/en/a-relationship-with-Jesus/guide2', citation: 'John 4:14' },
  { path: '/en/a-relationship-with-Jesus/guide3', citation: 'John 11:25' },
  { path: '/en/a-relationship-with-Jesus/guide4', citation: 'Acts 8:37' },
  { path: '/es/una-relacion-con-Jesus/guia1', citation: 'Marcos 6:50' },
  { path: '/es/una-relacion-con-Jesus/guia2', citation: 'Juan 4:14' },
  { path: '/es/una-relacion-con-Jesus/guia3', citation: 'Juan 11:25' },
  { path: '/es/una-relacion-con-Jesus/guia4', citation: 'Hechos 8:37' },
  { path: '/en/gdcluster/guide2', citation: 'Ecclesiastes 4:12', premium: true },
  { path: '/es/redgd/guia2', citation: 'Eclesiastés 4:12', premium: true },
]

async function waitGuideText(page, timeout) {
  try {
    await page.waitForFunction(
      () => (document.querySelector('[aria-label="Guide text"]')?.textContent || '').trim().length > 200,
      { timeout },
    )
    return true
  } catch {
    return false
  }
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

  const creds = loadEnvCredentials()
  if (creds) process.env.TEST_PRIVATE_KEY = creds.pk

  const browser = await launchBrowser(env.headless)
  const page = await newPage(browser, creds?.addr, timeout)

  let authed = false
  if (creds) {
    try {
      await setupE2EAuth(page, creds.addr, creds.pk, process.env.CHAIN_ID, base)
      authed = true
      console.log(`  Sesión iniciada con ${creds.addr.slice(0, 10)}...`)
    } catch (error) {
      console.log(`  [!] sin sesión: ${error.message}`)
    }
  }

  for (const target of TARGETS) {
    await page.goto(`${base}${target.path}`, { waitUntil: 'domcontentloaded' })
    const painted = await waitGuideText(page, timeout)
    if (!painted) {
      if (target.premium) {
        console.log(`  [SKIP] ${target.path}: guía premium sin pintar (${authed ? 'la billetera no tiene acceso' : 'sin sesión'})`)
      } else {
        fail(`${target.path}: la guía no se pintó`)
      }
      continue
    }
    const text = await page.evaluate(
      () => document.querySelector('[aria-label="Guide text"]')?.textContent || '',
    )
    if (text.includes(target.citation)) {
      ok(`${target.path}: "${target.citation}"`)
    } else {
      const bare = target.citation.split(':')[0]
      fail(`${target.path}: falta "${target.citation}"${text.includes(bare) ? ' (la cita se corta en el ":")' : ''}`)
    }
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
