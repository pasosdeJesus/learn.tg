import 'dotenv/config'
import axios from 'axios'
import { privateKeyToAccount } from 'viem/accounts'
import https from 'https'
import { SiweMessage } from 'siwe'
import fs from 'fs'

const SITE = process.env.SITE_URL || 'https://learn.tg:9001'
const RAILS = process.env.RAILS_URL || 'https://learn.tg:3500/learntg-admin'
const PRIVATE_KEY = process.env.PRIVATE_KEY
if (!PRIVATE_KEY) { console.error('PRIVATE_KEY not set'); process.exit(1) }

const account = privateKeyToAccount(PRIVATE_KEY)
const wallet = account.address

const agent = new https.Agent({ rejectUnauthorized: false })
const api = axios.create({ httpsAgent: agent, maxRedirects: 5 })

function parseCookie(h) { return h.split(';')[0].trim() }
function updateCookies(current, headers) {
  const map = new Map()
  if (current) current.split(';').forEach(c => { const [n,...v] = c.trim().split('='); if (n&&v.length) map.set(n,`${n}=${v.join('=')}`) })
  if (headers) headers.forEach(h => { const c = parseCookie(h); const [n,...v] = c.split('='); if (n&&v.length) map.set(n,c) })
  return Array.from(map.values()).join('; ')
}

async function main() {
  let cookies = ''
  console.log(`🔑 Wallet: ${wallet}`)

  // ── PASO 1: Autenticación SIWE ──
  console.log('\n── PASO 1: SIWE Auth ──')

  const csrfRes = await api.get(`${SITE}/api/auth/csrf`)
  const csrfToken = csrfRes.data.csrfToken
  console.log(`1.1 CSRF: ${csrfToken.slice(0,10)}...`)

  const msg = new SiweMessage({
    domain: new URL(SITE).host,
    address: wallet,
    statement: 'Sign in to Learn through games.',
    uri: SITE,
    version: '1',
    chainId: 11142220,
    nonce: csrfToken,
  })
  const signature = await account.signMessage({ message: msg.prepareMessage() })
  console.log('1.2 Signed')

  const authRes = await api.post(`${SITE}/api/auth/callback/credentials`, {
    message: msg.prepareMessage(),
    signature,
    redirect: false,
    csrfToken,
    json: true,
  })
  cookies = updateCookies(cookies, authRes.headers['set-cookie'])
  console.log(`1.3 Auth: ${authRes.status}`)

  const sessRes = await api.get(`${SITE}/api/auth/session`, { headers: { Cookie: cookies } })
  console.log(`1.4 Session: ${sessRes.status}`)
  console.log(`    Raw data: ${JSON.stringify(sessRes.data)}`)
  console.log(`    address: ${sessRes.data?.address || 'N/A'}`)
  console.log(`    user.name: ${sessRes.data?.user?.name || 'N/A'}`)

  // ── PASO 2: Usar el mismo CSRF que se usó en auth (no uno nuevo) ──
  // El token almacenado en billetera_usuario es result.data.nonce = csrfToken original
  console.log('\n── PASO 2: Using auth CSRF token for Rails API ──')
  const apiToken = csrfToken
  console.log(`2.1 API token (same as auth CSRF): ${apiToken.slice(0,10)}...`)

  // ── PASO 3: Llamada a Rails con wallet minúscula ──
  console.log('\n── PASO 3: Rails API calls ──')

  const langs = ['en', 'es']
  for (const lang of langs) {
    const walletLower = wallet.toLowerCase()

    // Con billetera (autenticado)
    const urlAuth = `${RAILS}/proyectosfinancieros.json?filtro[busidioma]=${lang}&filtro[busconBilletera]=true&walletAddress=${walletLower}&token=${apiToken}`
    console.log(`\n3.${lang} Con billetera:`)
    try {
      const r = await api.get(urlAuth, { headers: { Cookie: cookies } })
      console.log(`  Status: ${r.status} ${Array.isArray(r.data) ? '(' + r.data.length + ' courses)' : ''}`)
      if (Array.isArray(r.data)) {
        r.data.forEach(c => console.log(`    - [${c.id}] ${c.titulo} (${c.prefijoRuta})`))
      }
    } catch (e) {
      console.log(`  Status: ${e.response?.status} ❌ ${JSON.stringify(e.response?.data).slice(0, 200)}`)
      console.log(`  URL: ${urlAuth}`)
    }

    // Sin billetera (público)
    const urlPublic = `${RAILS}/proyectosfinancieros.json?filtro[busidioma]=${lang}`
    console.log(`3.${lang} Sin billetera:`)
    try {
      const r = await api.get(urlPublic)
      console.log(`  Status: ${r.status} ${Array.isArray(r.data) ? '(' + r.data.length + ' courses)' : ''}`)
      if (Array.isArray(r.data)) {
        r.data.forEach(c => console.log(`    - [${c.id}] ${c.titulo} (${c.prefijoRuta})`))
      }
    } catch (e) {
      console.log(`  Status: ${e.response?.status} ❌`)
    }
  }

  // ── PASO 4: Página /en con cookies y extraer cursos visibles ──
  console.log('\n── PASO 4: /en page with auth cookies ──')
  const pageRes = await api.get(`${SITE}/en`, { headers: { Cookie: cookies } })
  console.log(`Status: ${pageRes.status}, Size: ${pageRes.data.length} bytes`)
  fs.writeFileSync('/tmp/e2e-rails-auth-en.html', pageRes.data)
  console.log('Saved: /tmp/e2e-rails-auth-en.html')
}

main().catch(e => {
  console.error('\n❌ FATAL:', e.message)
  if (e.response) console.error('Response:', e.response.status, JSON.stringify(e.response.data).slice(0, 300))
  process.exit(1)
})
