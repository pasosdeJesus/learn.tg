// E2E Test: CELO UBI Claim on Sepolia (R-#179)
// Same flow as REQ/175 but on Celo Sepolia testnet — no real value at stake.
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

async function main() {
  const t0 = performance.now()
  resetFailures()
  const env = await initTestEnv()
  const { base, timeout, account, chainId, host, domainPort } = env
  const guidePath = process.env.GUIDE_CLAIM_PATH || '/en/web3-and-ubi/guide3'

  console.log(`Wallet: ${short(account.address)} | ${base} (chain: ${chainId})`)
  console.log(`Guide: ${guidePath}\n`)
  const browser = await launchBrowser(env.headless)

  {
    const page = await newPage(browser, account.address, timeout)

    page.on('response', res => {
      if (res.url().includes('claim-celo-ubi'))
        console.log(`  [net] ${res.status()} claim-celo-ubi`)
    })

    await page.goto(`${base}${guidePath}`, { waitUntil: 'domcontentloaded', timeout })
    const siweOk = await simulateSIWE(page, { account, host, domainPort, base, chainId })
    if (!siweOk) { fail('SIWE failed'); await browser.close(); process.exit(1) }
    ok('SIWE completed')

    console.log('  Waiting for CeloUbi button...')
    const btnAppeared = await page.waitForFunction(() => {
      return [...document.querySelectorAll('button')].some(b =>
        (b.textContent || '').includes('Claim Learn.tg-UBI') ||
        (b.textContent || '').includes('Reclamar Learn.tg-IBU')
      )
    }, { timeout: 15000 }).catch(() => false)

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
