import { initTestEnv, launchBrowser, newPage, resolveSiteTarget } from '@pasosdejesus/m/e2e'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'
import { loadWalletCredentials } from '../helpers/e2e-wallet.mjs'
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
const p = (await apiOn(page, `/api/profile?walletAddress=${creds.address}`)).body || {}
const fields = ['nombre','passport_name','pais_id','passport_nationality','email','verified_email','whatsapp','telegram','verified_whatsapp','verified_telegram','city_id','verified_city_id','place_of_worship_location','verified_place_of_worship_location','religion_id','church_id','church_relationship','verified_church_relationship','place_of_worship','verified_place_of_worship','proposed_date_of_interview','conducted_date_of_interview','lastgooddollarverification','profilescore']
console.log(JSON.stringify(Object.fromEntries(fields.map((f) => [f, p[f]])), null, 1))
await browser.close()
