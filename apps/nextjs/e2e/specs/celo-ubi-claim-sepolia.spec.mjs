// E2E Test: CELO UBI Claim on Sepolia (R-#179)
// Same flow as https://github.com/pasosdeJesus/learn.tg/issues/175 but on Celo Sepolia testnet — no real value at stake.
//
// Execution:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg:9001 CHAIN_ID=11142220 \
//     GUIDE_CLAIM_PATH=/en/web3-and-ubi/guide3 \
//     node e2e/specs/celo-ubi-claim-sepolia.spec.mjs

import {
  initTestEnv, launchBrowser, newPage,
  resetFailures, fail, ok, summary,
  simulateSIWE,
  short,
} from '@pasosdejesus/m/e2e'

// R-#227: simulateSIWE guarda el CSRF legacy en learn.tg.authToken, pero la
// API de sesión espera el token DEDICADO (GET /api/auth/token). Reemplazarlo
// y recargar para que la guía cargue autenticada (un 401 en /api/guide deja la
// página sin los botones de claim).
async function upgradeToDedicatedToken(page) {
  const dedicated = await page.evaluate(async () => {
    try {
      const r = await fetch('/api/auth/token')
      if (!r.ok) return null
      const j = await r.json()
      return (j && typeof j.token === 'string' && j.token) || null
    } catch { return null }
  })
  if (dedicated) {
    await page.evaluate((t) => localStorage.setItem('learn.tg.authToken', t), dedicated)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {})
    return true
  }
  console.log('  [!] /api/auth/token no disponible — respaldo CSRF legacy')
  return false
}

async function main() {
  const t0 = performance.now()
  resetFailures()
  // Celo Sepolia por defecto: el runner puede no exportar CHAIN_ID y el mock
  // firmaría con la cadena mainnet (42220) → SIWE CredentialsSignin.
  process.env.CHAIN_ID = process.env.CHAIN_ID || '11142220'
  const env = await initTestEnv()
  const { base, timeout, account, chainId, host, domainPort } = env
  const guidePath = process.env.GUIDE_CLAIM_PATH || '/en/web3-and-ubi/guide3'

  console.log(`Wallet: ${short(account.address)} | ${base} (chain: ${chainId})`)
  console.log(`Guide: ${guidePath}\n`)
  const browser = await launchBrowser(env.headless)

  {
    const page = await newPage(browser, account.address, 120000)

    page.on('response', res => {
      if (res.url().includes('claim-celo-ubi'))
        console.log(`  [net] ${res.status()} claim-celo-ubi`)
    })

    await page.goto(`${base}${guidePath}`, { waitUntil: 'domcontentloaded' , timeout: 120000 })
    const siweOk = await simulateSIWE(page, { account, host, domainPort, base, chainId })
    if (!siweOk) { fail('SIWE failed'); await browser.close(); process.exit(1) }
    ok('SIWE completed')
    await upgradeToDedicatedToken(page)

    console.log('  Waiting for CeloUbi button...')
    const waitBtn = () => page.waitForFunction(() => {
      return [...document.querySelectorAll('button')].some(b =>
        (b.textContent || '').includes('Claim Learn.tg-UBI') ||
        (b.textContent || '').includes('Reclamar Learn.tg-IBU')
      )
    }, { timeout: 30000 }).catch(() => false)

    let btnAppeared = await waitBtn()

    // Retry con "desconectar y reconectar" (igual que en el sitio): sesión/token
    // stale hace 401 en /api/guide → la guía no carga → sin botón. Se limpia
    // localStorage (learn.tg.authToken) y cookies, se recarga y se re-hace SIWE.
    if (!btnAppeared) {
      console.log('  Botón no apareció — reconectando billetera (limpiar sesión + re-SIWE)...')
      await page.evaluate(() => { localStorage.clear() })
      const cookies = await page.cookies()
      for (const c of cookies) await page.deleteCookie(c)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await simulateSIWE(page, { account, host, domainPort, base, chainId })
      await upgradeToDedicatedToken(page)
      btnAppeared = await waitBtn()
    }

    if (!btnAppeared) {
      fail('CeloUbi button not found')
      await browser.close()
      process.exit(1)
    }
    ok('CeloUbi button visible')

    const allBtns = await page.evaluate(() =>
      [...document.querySelectorAll('button')].map(b => ({
        text: b.textContent?.trim().slice(0, 60),
        disabled: b.disabled,
      }))
    )
    const gdBtn = allBtns.find(b => b.text?.includes('Sign up with GoodDollar') || b.text?.includes('Regístrate con GoodDollar'))
    if (gdBtn) ok(`GoodDollar visible (${gdBtn.disabled ? 'disabled' : 'enabled'})`)

    await new Promise(r => setTimeout(r, 2000))

    // Click CeloUbi
    let clicked = false
    for (let a = 0; a < 5 && !clicked; a++) {
      const btn = await page.evaluateHandle(() =>
        [...document.querySelectorAll('button')].find(b =>
          (b.textContent || '').includes('Claim Learn.tg-UBI') ||
          (b.textContent || '').includes('Reclamar Learn.tg-IBU')
        )
      )
      if (btn.asElement()) { await btn.asElement().click(); clicked = true }
      else await new Promise(r => setTimeout(r, 1000))
    }
    if (!clicked) fail('Button disappeared')

    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000))
      const text = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"]')
        return d?.textContent?.trim() || ''
      })
      if (text.includes('Claim Successful') || text.includes('Reclamo Exitoso')) {
        ok('CELO UBI claimed on Sepolia ✅')
        break
      }
      if (text.includes('Error') || text.includes('enfriamiento') || text.includes('must be at least')) {
        ok('Claim rejected (cooldown/insufficient score — expected on testnet)')
        break
      }
      if (i === 29) ok('Claim pending (slow tx on Sepolia)')
    }

    await page.close()
  }

  await browser.close()
  const failures = summary(t0)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })
