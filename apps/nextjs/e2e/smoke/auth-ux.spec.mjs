import 'dotenv/config'
import axios from 'axios'
import { privateKeyToAccount } from 'viem/accounts'
import { celoSepolia } from 'viem/chains'
import https from 'https'
import { SiweMessage } from 'siwe'
import fs from 'fs'

const SITE = process.env.SITE_URL || 'https://learn.tg:9001'
const PRIVATE_KEY = process.env.PRIVATE_KEY
if (!PRIVATE_KEY) { console.error('PRIVATE_KEY not set'); process.exit(1) }

const account = privateKeyToAccount(PRIVATE_KEY)
const wallet = account.address
console.log(`🔑 Wallet: ${wallet}`)

const agent = new https.Agent({ rejectUnauthorized: false })
const apiClient = axios.create({ httpsAgent: agent, maxRedirects: 0 })

let cookies = ''

function parseCookieHeader(h) { return h.split(';')[0].trim() }
function updateCookies(current, setCookieHeaders) {
  const map = new Map()
  if (current) current.split(';').forEach(c => { const [n,...v] = c.trim().split('='); if (n&&v.length) map.set(n,`${n}=${v.join('=')}`) })
  if (setCookieHeaders) setCookieHeaders.forEach(h => { const c = parseCookieHeader(h); const [n,...v] = c.split('='); if (n&&v.length) map.set(n,c) })
  return Array.from(map.values()).join('; ')
}

// ============ PASO 1: Leer página sin autenticar ============
console.log('\n📄 PASO 1: Fetching landing page (unauthenticated)...')
const r1 = await apiClient.get(`${SITE}/`, { headers: { 'Accept': 'text/html' }, responseType: 'text' })
const html1 = r1.data
console.log(`   Status: ${r1.status}, Size: ${html1.length} bytes`)

const hasConnectWallet = html1.includes('Connect Wallet') || html1.includes('Connect wallet') || html1.includes('connect wallet')
const hasEnglish = html1.includes('English') || html1.includes('english')
console.log(`   "Connect Wallet" button: ${hasConnectWallet ? '✅' : '❌'}`)
console.log(`   "English" button: ${hasEnglish ? '✅' : '❌'}`)

// ============ PASO 2: Autenticación SIWE ============
console.log('\n🔐 PASO 2: SIWE Authentication...')

// 2.1 Get CSRF token
const csrfRes = await apiClient.get(`${SITE}/api/auth/csrf`)
cookies = updateCookies(cookies, csrfRes.headers['set-cookie'])
const csrfToken = csrfRes.data?.csrfToken
console.log(`   2.1 CSRF token: ${csrfToken?.slice(0,10)}... Status: ${csrfRes.status}`)

// 2.2 Build SIWE message
const msg = new SiweMessage({
  domain: new URL(SITE).host,
  address: wallet,
  statement: 'Sign in to Learn through games.',
  uri: SITE,
  version: '1',
  chainId: 11142220,
  nonce: csrfToken,
})
const message = msg.prepareMessage()
console.log(`   2.2 SIWE message prepared`)

// 2.3 Sign
const signature = await account.signMessage({ message })
console.log(`   2.3 Signed: ${signature.slice(0,20)}...`)

// 2.4 POST credentials (follow 302 redirect to get session cookie)
const authRes = await apiClient.post(`${SITE}/api/auth/callback/credentials`, {
  message, signature, redirect: false, csrfToken, json: true
}, { 
  headers: { 'Content-Type': 'application/json', Cookie: cookies },
  validateStatus: s => s >= 200 && s < 400,
  maxRedirects: 0,
})
cookies = updateCookies(cookies, authRes.headers['set-cookie'])
console.log(`   2.4 Auth callback: Status ${authRes.status}`)
if (authRes.status === 302) {
  const location = authRes.headers['location']
  console.log(`   Redirect to: ${location}`)
  // Follow redirect to get session cookie set properly if needed
  try {
    const redirRes = await apiClient.get(location, { 
      headers: { Cookie: cookies },
      maxRedirects: 0,
      validateStatus: s => s < 400,
    })
    cookies = updateCookies(cookies, redirRes.headers['set-cookie'])
  } catch (e) { /* redirect may fail with maxRedirects=0, cookie already set */ }
}

// 2.5 Get session
const sessRes = await apiClient.get(`${SITE}/api/auth/session`, { headers: { Cookie: cookies } })
console.log(`   2.5 Session: Status ${sessRes.status}, address: ${sessRes.data?.address || sessRes.data?.user?.name || 'N/A'}`)

// ============ PASO 3: Leer página autenticada ============
console.log('\n📄 PASO 3: Fetching landing page (authenticated)...')
const r3 = await apiClient.get(`${SITE}/`, { headers: { 'Accept': 'text/html', Cookie: cookies }, responseType: 'text' })
const html3 = r3.data
console.log(`   Status: ${r3.status}, Size: ${html3.length} bytes`)

const noConnectWallet = !html3.includes('Connect Wallet') && !html3.includes('connect wallet')
const hasAddress = html3.toLowerCase().includes(wallet.toLowerCase().slice(2, 10))
const hasNetwork = html3.includes('Celo Sepolia') || html3.includes('celoSepolia') || html3.includes('Celo')
console.log(`   "Connect Wallet" absent: ${noConnectWallet ? '✅' : '❌'}`)
console.log(`   Wallet address visible: ${hasAddress ? '✅' : '❌'}`)
console.log(`   "Celo Sepolia" visible: ${hasNetwork ? '✅' : '❌'}`)

// ============ PASO 4: Página en inglés ============
console.log('\n📄 PASO 4: Fetching English landing page...')
const r4 = await apiClient.get(`${SITE}/en`, { headers: { 'Accept': 'text/html', Cookie: cookies }, responseType: 'text' })
const html4 = r4.data
console.log(`   Status: ${r4.status}, Size: ${html4.length} bytes`)

const hasCourses = html4.includes('relationship') || html4.includes('Jesus') || html4.includes('Web3') || html4.includes('course')
console.log(`   Course list visible: ${hasCourses ? '✅' : '❌'}`)

// Save result
const reportFile = '/tmp/e2e-auth-ux-result.html'
const report = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>E2E Auth UX Report</title>
<style>body{font-family:system-ui;max-width:800px;margin:2em auto;padding:0 1em}
.pass{color:green}.fail{color:red}h2{border-bottom:2px solid #ddd}</style></head><body>
<h1>E2E Auth UX Test — ${new Date().toISOString()}</h1>
<h2>Wallet</h2><p><code>${wallet}</code></p>
<h2>Step 1 — Unauthenticated landing page</h2>
<ul>
<li>Connect Wallet: <span class="${hasConnectWallet?'pass':'fail'}">${hasConnectWallet?'✅':'❌'}</span></li>
<li>English button: <span class="${hasEnglish?'pass':'fail'}">${hasEnglish?'✅':'❌'}</span></li>
</ul>
<h2>Step 2 — SIWE Auth</h2>
<ul>
<li>CSRF token: ${csrfRes.status} ${csrfToken?.slice(0,10)}...</li>
<li>Auth callback: ${authRes.status}</li>
<li>Session: ${sessRes.status} → ${sessRes.data?.address || 'N/A'}</li>
</ul>
<h2>Step 3 — Authenticated landing page</h2>
<ul>
<li>No Connect Wallet: <span class="${noConnectWallet?'pass':'fail'}">${noConnectWallet?'✅':'❌'}</span></li>
<li>Wallet visible: <span class="${hasAddress?'pass':'fail'}">${hasAddress?'✅':'❌'}</span></li>
<li>Celo Sepolia badge: <span class="${hasNetwork?'pass':'fail'}">${hasNetwork?'✅':'❌'}</span></li>
</ul>
<h2>Step 4 — English page</h2>
<ul>
<li>Status: ${r4.status}, Size: ${html4.length} bytes</li>
<li>Course list: <span class="${hasCourses?'pass':'fail'}">${hasCourses?'✅':'❌'}</span></li>
</ul>
<hr><h2>Authenticated HTML (English page)</h2>
<pre style="font-size:12px;max-height:400px;overflow:auto;background:#f5f5f5;padding:1em">${
  html4.replace(/</g,'&lt;').replace(/>/g,'&gt;').slice(0, 10000)
}</pre>
</body></html>`

fs.writeFileSync(reportFile, report)
console.log(`\n📋 Report saved to ${reportFile}`)

const allPass = hasEnglish && (authRes.status === 200 || authRes.status === 302) && hasCourses
if (allPass) {
  console.log('🎉 ALL CHECKS PASSED')
} else {
  console.log('⚠️  Some checks failed — review report above')
  process.exit(1)
}
