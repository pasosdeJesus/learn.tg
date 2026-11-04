import { initTestEnv, launchBrowser, newIncognitoContext, newIncognitoPage, resolveSiteTarget } from '@pasosdejesus/m/e2e'
import { setupE2EAuth } from '../helpers/e2e-auth.mjs'
import { loadVerifierWallet } from '../helpers/e2e-wallet.mjs'
if (!process.env.IPDES) process.env.IPDES = 'learn.tg'
if (!process.env.PUERTOPRU) process.env.PUERTOPRU = '9001'
const verifier = loadVerifierWallet()
const env = await initTestEnv()
const { base } = resolveSiteTarget(env)
const browser = await launchBrowser(env.headless)
for (const chainId of ['11142220', '42220', '44787']) {
  const ctx = await newIncognitoContext(browser)
  const page = await newIncognitoPage(ctx, verifier.address, env.timeout)
  try {
    await setupE2EAuth(page, verifier.address, verifier.pk, chainId, base)
    const r = await page.evaluate(async (w) => {
      const res = await fetch(`/api/profile?walletAddress=${w}`)
      return { status: res.status, id: res.ok ? (await res.json()).id : null }
    }, verifier.address)
    console.log(`chain ${chainId}: perfil ${r.status} id=${r.id}`)
  } catch (e) {
    console.log(`chain ${chainId}: error ${e.message}`)
  }
  await ctx.close()
}
await browser.close()
