import { initTestEnv, launchBrowser, newPage, resolveSiteTarget } from '@pasosdejesus/m/e2e'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'
import { loadWalletCredentials } from '../helpers/e2e-wallet.mjs'
import { completeGuide } from '../helpers/guides.mjs'
import { apiOn } from '../helpers/e2e-fixture.mjs'
if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '11142220'
const creds = loadWalletCredentials({ variable: process.env.WALLET || 'TEST_PASTOR1' })
const env = await initTestEnv()
const { base } = resolveSiteTarget(env)
const browser = await launchBrowser(env.headless)
const page = await newPage(browser, creds.address, env.timeout)
await setupE2EAuth(page, creds.address, creds.pk, process.env.CHAIN_ID, base)
const suffix = process.argv[2] || 'guide2'
const result = await completeGuide(page, base, { lang: 'en', prefix: 'gdcluster', suffix })
console.log(JSON.stringify(result, null, 1))
await browser.close()
