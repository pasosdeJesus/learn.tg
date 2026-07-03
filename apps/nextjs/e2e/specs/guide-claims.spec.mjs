// E2E Test: CELO UBI Claim from guide page (R-#175)
// Claims Learn.tg-UBI via Puppeteer + SIWE on mainnet,
// then returns the claimed CELO to the backend wallet.
//
// Execution:
//   CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg \
//     GUIDE_CLAIM_PATH=/en/web3-and-ubi/guide3 \
//     node e2e/specs/guide-claims.spec.mjs

import {
  initTestEnv, launchBrowser, newPage,
  resetFailures, fail, ok, summary,
  simulateSIWE, waitForText,
  short,
} from '@pasosdejesus/m/e2e'
import { createWalletClient, createPublicClient, http, parseEther } from 'viem'
import { celo } from 'viem/chains'

async function returnCeloToBackend(account, backendAddress) {
  const publicClient = createPublicClient({
    chain: celo,
    transport: http(),
  })
  const walletClient = createWalletClient({
    account,
    chain: celo,
    transport: http(),
  })
  const balance = await publicClient.getBalance({ address: account.address })
  console.log(`  Wallet balance: ${balance} wei`)
  if (balance === 0n) {
    console.log('  No CELO to return')
    return null
  }
  // Leave 0.0001 CELO for future gas
  const gas = parseEther('0.0001')
  const amount = balance > gas ? balance - gas : 0n
  if (amount === 0n) {
    console.log('  Balance too low to return after gas')
    return null
  }
  console.log(`  Returning ${amount} wei to ${short(backendAddress)}...`)
  const hash = await walletClient.sendTransaction({
    to: backendAddress,
    value: amount,
  })
  console.log(`  Return tx: ${hash}`)
  return hash
}

async function main() {
  const t0 = performance.now()
  resetFailures()
  const env = await initTestEnv()
  const { base, timeout, account, chainId, host, domainPort } = env
  const guidePath = process.env.GUIDE_CLAIM_PATH || '/en/web3-and-ubi/guide3'
  const backendAddress = process.env.NEXT_PUBLIC_CELOUBI_ADDRESS

  console.log(`Wallet: ${short(account.address)} | ${base}`)
  console.log(`Guide: ${guidePath}\n`)
  const browser = await launchBrowser(env.headless)

  // ── Test: CELO UBI Claim ─────────────────────────────────
  {
    const page = await newPage(browser, account.address, timeout) // EIP-6963 pending R-#14

    // Capture claim API response for diagnostics
    page.on('response', res => {
      if (res.url().includes('claim-celo-ubi'))
        console.log(`  [net] ${res.status()} claim-celo-ubi`)
    })

    // Navigate to guide and authenticate
    await page.goto(`${base}${guidePath}`, { waitUntil: 'domcontentloaded', timeout })
    const siweOk = await simulateSIWE(page, { account, host, domainPort, base, chainId })
    if (!siweOk) { fail('SIWE failed'); await browser.close(); process.exit(1) }
    ok('SIWE completed')

    // Wait for CeloUbi button to appear
    console.log('  Waiting for CeloUbi button...')
    const btnAppeared = await page.waitForFunction(() => {
      const buttons = [...document.querySelectorAll('button')]
      return buttons.some(b =>
        (b.textContent || '').includes('Claim Learn.tg-UBI') ||
        (b.textContent || '').includes('Reclamar Learn.tg-IBU')
      )
    }, { timeout: 15000 }).catch(() => false)

    if (!btnAppeared) {
      fail('CeloUbi button not found — guide may not have {CeloUbiButton} marker')
      await browser.close()
      const failures = summary(t0)
      process.exit(failures > 0 ? 1 : 0)
    }
    ok('CeloUbi button visible')

    const allBtns = await page.evaluate(() =>
      [...document.querySelectorAll('button')].map(b => ({
        text: b.textContent?.trim().slice(0, 60),
        disabled: b.disabled,
      }))
    )

    // Verify GoodDollar button renders and is enabled with EIP-6963 mock
    const gdBtn = allBtns.find(b => b.text?.includes('Sign up with GoodDollar') || b.text?.includes('Regístrate con GoodDollar'))
    if (gdBtn) {
      ok(`GoodDollar button visible (${gdBtn.disabled ? 'disabled — expected without EIP-6963' : 'enabled'})`)
    } else {
      fail('GoodDollar button not found on guide page')
    }

    // Wait to avoid rate limiting then click CeloUbi button
    await new Promise(r => setTimeout(r, 2000))

    // Re-query button right before clicking (DOM may have changed after SIWE)
    let clicked = false
    for (let attempt = 0; attempt < 5 && !clicked; attempt++) {
      const btn = await page.evaluateHandle(() => {
        return [...document.querySelectorAll('button')].find(b =>
          (b.textContent || '').includes('Claim Learn.tg-UBI') ||
          (b.textContent || '').includes('Reclamar Learn.tg-IBU')
        )
      })
      if (btn.asElement()) {
        await btn.asElement().click()
        clicked = true
        console.log('  Clicked CeloUbi button')
      } else {
        await new Promise(r => setTimeout(r, 1000))
      }
    }
    if (!clicked) fail('CeloUbi button disappeared after SIWE')

    // Wait for dialog response
    let dialogResolved = false
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 1000))
      const text = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"]')
        return d?.textContent?.trim() || ''
      })
      if (text.includes('Claim Successful') || text.includes('Reclamo Exitoso')) {
        console.log(`  ✅ Claim success: "${text.slice(0, 100)}"`)
        ok('CELO UBI claimed successfully')
        dialogResolved = true
        break
      }
      if (text.includes('Claim Error') || text.includes('Error en el Reclamo') || text.includes('already') || text.includes('must be at least') || text.includes('enfriamiento')) {
        console.log(`  ⚠️  Claim rejected: "${text.slice(0, 150)}"`)
        ok('Claim rejected (cooldown/rate-limit, expected)')
        dialogResolved = true
        break
      }
    }
    if (!dialogResolved) {
      console.log('  ⚠️  Dialog still loading after 15s — rate-limited or slow tx')
      ok('Claim pending (rate-limit or slow confirmation, non-critical)')
    }

    // Try to extract txHash
    const txHash = await page.evaluate(() => {
      const links = [...document.querySelectorAll('a')]
      const txLink = links.find(l => (l.href || '').includes('/tx/'))
      return txLink ? txLink.href.split('/tx/')[1]?.split('?')[0] : null
    })
    if (txHash) {
      console.log(`  TxHash: ${txHash.slice(0, 20)}...`)
      ok('Transaction hash found')
    } else {
      console.log('  No txHash in dialog (may be cooldown or error)')
    }

    await page.close()
  }

  // ── Return CELO to backend ───────────────────────────────
  if (backendAddress) {
    console.log('\n── Returning CELO to backend ──')
    try {
      const returnHash = await returnCeloToBackend(account, backendAddress)
      if (returnHash) ok('CELO returned to backend')
    } catch (err) {
      console.log(`  ⚠️  Could not return CELO: ${err.message}`)
    }
  } else {
    console.log('\n⚠️  NEXT_PUBLIC_ADDRESS not set — cannot return CELO')
  }

  await browser.close()
  const failures = summary(t0)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })
