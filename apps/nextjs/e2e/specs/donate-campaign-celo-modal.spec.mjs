// E2E Test: Donation modal — donate NATIVE CELO to the Lensenia campaign
// (REQ/223). Uses the real dev wallet + real RPC bridge for eth_sendTransaction
// (the standard E2E mock returns a fake hash, which would fail the on-chain
// verify). Validates:
//   1. Donation page → Donate now opens the modal
//   2. Token selector shows CELO (dev/testnet) and it is selectable
//   3. "Donatable (max, minus gas)" hint appears after choosing CELO
//   4. Donation with cashback OFF → success dialog with CELO distribution
//   5. Campaign wallet CELO balance on Sepolia increased ≈ donated amount
//
// Execution:
//   cd apps/nextjs && node e2e/specs/donate-campaign-celo-modal.spec.mjs

import * as fs from 'fs'
import * as path from 'path'
import {
  initTestEnv, launchBrowser, resetFailures, fail, ok, summary,
} from '@pasosdejesus/m/e2e'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'
import { createPublicClient, createWalletClient, http, parseUnits, formatEther } from 'viem'
import { celoSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11142220', 10)
const DONATE_CELO = parseUnits(process.env.DONATE_CELO || '0.2', 18)
const CAMPAIGN_WALLET = '0x9c7218a253d1565fc5f2149ba51f0f55f0f27f07'

function loadEnvCredentials() {
  for (const p of [path.join(process.cwd(), '..', '.env'), path.join(process.cwd(), '.env')]) {
    if (fs.existsSync(p)) {
      const c = fs.readFileSync(p, 'utf8')
      const pk = c.match(/PRIVATE_KEY="([^"]+)"/)?.[1] || c.match(/PRIVATE_KEY=(\S+)/)?.[1]
      const addr = c.match(/NEXT_PUBLIC_ADDRESS="([^"]+)"/)?.[1] || c.match(/NEXT_PUBLIC_ADDRESS=(\S+)/)?.[1]
      if (pk && addr) return { pk, addr }
    }
  }
  return null
}

async function navAndWait(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const n = await page.evaluate(() => document.body?.textContent?.length || 0)
    if (n > 100) return true
  }
  return false
}

async function main() {
  const t0 = performance.now()
  resetFailures()
  const creds = loadEnvCredentials()
  if (!creds) { console.error('No credentials found'); process.exit(1) }
  const account = privateKeyToAccount(creds.pk)

  const rpcList = [
    process.env.NEXT_PUBLIC_RPC_URL,
    'https://forno.celo-sepolia.celo-testnet.org',
    'https://celo-sepolia.drpc.org',
  ].filter(Boolean)
  let publicClient = null
  let walletClient = null
  for (const url of rpcList) {
    try {
      const c = createPublicClient({ chain: celoSepolia, transport: http(url, { timeout: 20000 }) })
      await c.getBalance({ address: account.address })
      publicClient = c
      walletClient = createWalletClient({ account, chain: celoSepolia, transport: http(url, { timeout: 20000 }) })
      console.log(`  RPC: ${url}`)
      break
    } catch { /* next */ }
  }
  if (!publicClient) { console.error('No working RPC'); process.exit(1) }

  const env = await initTestEnv()
  const { base } = env
  console.log(`Wallet: ${account.address.slice(0, 10)}... | ${base} (chain: ${CHAIN_ID})`)

  // Campaign wallet CELO BEFORE (Sepolia)
  const before = await publicClient.getBalance({ address: CAMPAIGN_WALLET })
  const donorBefore = await publicClient.getBalance({ address: account.address })
  if (donorBefore < DONATE_CELO + parseUnits('0.1', 18)) { fail('Not enough CELO in the test wallet'); process.exit(1) }

  const browser = await launchBrowser()
  const page = await browser.newPage()
  await setupE2EAuth(page, account.address, creds.pk, CHAIN_ID, base)

  // Real RPC bridge (replaces the mock's fake sendTransaction/balances).
  await page.exposeFunction('__rpcReal', async (method, params) => {
    switch (method) {
      case 'eth_sendTransaction': {
        const tx = params[0]
        return walletClient.sendTransaction({ to: tx.to, value: BigInt(tx.value || '0x0') })
      }
      case 'eth_call':
      case 'eth_getBalance':
      case 'eth_estimateGas':
      case 'eth_gasPrice':
      case 'eth_blockNumber':
      case 'eth_getTransactionReceipt':
      case 'eth_getTransactionCount':
      case 'eth_getCode':
      case 'eth_feeHistory':
        return publicClient.request({ method, params })
      default:
        return null
    }
  })
  await page.evaluateOnNewDocument((addr, cid) => {
    window.ethereum = {
      isMetaMask: true,
      selectedAddress: addr,
      request: async ({ method, params }) => {
        if (method === 'eth_chainId') return cid
        if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [addr]
        if (method === 'personal_sign') return window.__signSiwe(params[0])
        if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') return null
        return window.__rpcReal(method, params || [])
      },
      on: () => {},
      removeListener: () => {},
    }
  }, account.address, '0x' + CHAIN_ID.toString(16))

  if (!await navAndWait(page, `${base}/en/donations/lensenia`)) { fail('Donation page did not load'); process.exit(1) }

  // Wait until the session is hydrated (header shows the wallet address)
  let pageText = ''
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1000))
    pageText = await page.evaluate(() => document.body?.textContent || '')
    if (/0x8427|Disconnect/i.test(pageText)) break
  }
  if (!/0x8427/i.test(pageText)) { fail('Wallet session not hydrated on the donation page'); process.exit(1) }
  ok('Wallet session hydrated')

  // Open modal
  console.log('\n── Open DonateModal ──')
  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /Donate now/i.test(x.textContent || ''))
    if (!b) return false
    b.click(); return true
  })
  if (!clicked) { fail('Donate now button not found'); process.exit(1) }

  // Wait for the modal to render (options panel is client-rendered)
  let modalText = ''
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 1000))
    modalText = await page.evaluate(() => document.body?.textContent || '')
    if (/Donation options|Opciones de la donación|Pay with|Pagar con/.test(modalText)) break
  }
  if (!/Pay with|Pagar con/.test(modalText)) {
    fail('DonateModal options did not render')
    console.log(`  Modal text: ${modalText.slice(-400).replace(/\s+/g, ' ')}`)
    process.exit(1)
  }
  ok('DonateModal rendered with donation options')

  // Token selector: expect at least USDT + CELO in dev/testnet
  const tokButtons = await page.evaluate(() =>
    [...document.querySelectorAll('button')].map(b => b.textContent?.trim() || '').filter(t => /^(USDT|USDC|XAUt0|G\$|CELO)$/.test(t)))
  console.log(`  Token buttons: ${tokButtons.join(', ')}`)
  if (!tokButtons.includes('USDT')) fail('USDT option missing')
  else ok('USDT option present')
  if (!tokButtons.includes('CELO')) fail('CELO option missing')
  else ok('CELO option present')

  // Select CELO
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent?.trim() === 'CELO')
    if (b) b.click()
  })
  await new Promise(r => setTimeout(r, 3000))

  // "Donatable (max, minus gas)" hint appears
  const body = await page.evaluate(() => document.body?.textContent || '')
  if (/Donatable \(max, minus gas\)/.test(body)) ok('Donatable (max minus gas) hint shown for CELO')
  else fail('Missing "Donatable (max, minus gas)" hint')

  // Uncheck cashback so the backend does not need MINTER_ROLE on dev
  await page.evaluate(() => {
    const labels = [...document.querySelectorAll('label')].filter(l => /SLEARN cashback/i.test(l.textContent || ''))
    for (const l of labels) {
      const cb = l.querySelector('input[type="checkbox"]')
      if (cb && cb.checked) cb.click()
    }
  })
  await new Promise(r => setTimeout(r, 800))

  // Fill amount (0.2 CELO) using the React-compatible input setter
  await page.evaluate((val) => {
    const el = document.getElementById('donate-amount')
    if (!el) return
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, val)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, formatEther(DONATE_CELO))
  await new Promise(r => setTimeout(r, 1500))

  // Click Donate (modal button)
  const donated = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent?.trim() === 'Donate')
    if (!b || b.disabled) return false
    b.click(); return true
  })
  if (!donated) { fail('Donate button not clickable'); process.exit(1) }

  // Wait for the success dialog
  let success = false
  let txt = ''
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 2000))
    txt = await page.evaluate(() => document.body?.textContent || '')
    if (/Donation completed/i.test(txt)) { success = true; break }
    if (/Error/i.test(txt) && i > 10) break
  }
  if (!success) { fail(`Success dialog not shown (last text… ${txt.slice(-300).replace(/\s+/g, ' ')})`); process.exit(1) }
  ok('Success dialog shown')

  // Distribution should mention campaign + CELO
  if (/campaign/i.test(txt) && /CELO/i.test(txt)) ok('Distribution shows campaign + CELO')
  else fail('Distribution text missing campaign/CELO')

  // Campaign wallet AFTER: increased ≈ DONATE_CELO
  let after = 0n
  for (let i = 0; i < 10; i++) {
    after = await publicClient.getBalance({ address: CAMPAIGN_WALLET })
    if (after - before >= DONATE_CELO * 99n / 100n) break
    await new Promise(r => setTimeout(r, 3000))
  }
  const delta = after - before
  if (delta >= DONATE_CELO * 99n / 100n) ok(`Campaign wallet +${formatEther(delta)} CELO (≈ 0.2 donated)`)
  else fail(`Campaign wallet +${formatEther(delta)} CELO, expected ≈ ${formatEther(DONATE_CELO)}`)

  console.log(`\nDone (${((performance.now() - t0) / 1000).toFixed(1)}s)`)
  await browser.close()
  const failures = summary(t0)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
