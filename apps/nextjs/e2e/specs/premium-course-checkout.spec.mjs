// E2E Test: Premium course checkout UI
// Verifies that a premium course (GD) shows a "Buy this course" button and
// opens the CheckoutModal with the price.
//
// Execution:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=9001 CHAIN_ID=11142220 \
//     node e2e/specs/premium-course-checkout.spec.mjs

import {
  initTestEnv, launchBrowser, newPage,
  resetFailures, fail, ok, summary,
  simulateSIWE, waitForText, short,
} from '@pasosdejesus/m/e2e'

async function main() {
  const t0 = performance.now()
  resetFailures()
  const env = await initTestEnv()
  const { base, timeout, account, chainId, host, domainPort } = env

  console.log(`Wallet: ${short(account.address)} | ${base}\n`)
  const browser = await launchBrowser(env.headless)
  const page = await newPage(browser, account.address, timeout)

  // ── Authenticate via SIWE ──
  await page.goto(`${base}/en/gdcluster`, { waitUntil: 'domcontentloaded', timeout })
  const siweOk = await simulateSIWE(page, { account, host, domainPort, base, chainId })
  if (!siweOk) { fail('SIWE failed'); await browser.close(); process.exit(1) }
  ok('SIWE completed')

  // ── Reload course page with fresh session ──
  await page.goto(`${base}/en/gdcluster`, { waitUntil: 'domcontentloaded', timeout })

  // ── Buy button visible ──
  const buyVisible = await waitForText(page, 'Buy this course', 20)
  if (buyVisible) ok('Buy button visible')
  else fail('Buy button not visible on premium course page')

  // ── Click Buy button ──
  const clicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    const btn = buttons.find((b) => (b.textContent || '').includes('Buy this course'))
    if (btn) { btn.click(); return true }
    return false
  })
  if (clicked) ok('Buy button clicked')
  else fail('Buy button not found/clickable')

  // ── Checkout modal opened ──
  const modalVisible = await waitForText(page, 'Purchase course', 12)
  if (modalVisible) ok('Checkout modal opened')
  else fail('Checkout modal did not open')

  summary(t0)
  await browser.close()
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
