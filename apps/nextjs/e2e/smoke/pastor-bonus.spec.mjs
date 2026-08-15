#!/usr/bin/env node

/**
 * Pastor bonus smoke test (HTTP).
 *
 * Verifies the churches-fund surface for the 44 SLEARN pastor bonus (REQ #192):
 *   1. GET /api/churches/fund returns the fund balance (SLEARN + USDT).
 *   2. The SLEARN balance is > 0 (churches wallet funded on Sepolia).
 *   3. The pastor landing page renders (EN + ES).
 *
 * Run after deploying and funding the churches wallet on Sepolia.
 */

import 'dotenv/config'
import axios from 'axios'
import https from 'https'

const BASE_URL = process.env.NEXT_PUBLIC_AUTH_URL || 'https://learn.tg:9001'

const httpsAgent = new https.Agent({ rejectUnauthorized: false })

let failures = 0
let passed = 0

function ok(name) {
  passed++
  console.log(`  ✅ ${name}`)
}

function fail(name, detail) {
  failures++
  console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`)
}

const isAddress = (v) => typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v)

async function main() {
  const api = axios.create({
    baseURL: BASE_URL,
    httpsAgent,
    headers: { 'User-Agent': 'PastorBonus-E2E-Test/1.0', Accept: 'application/json' },
    maxRedirects: 0,
  })

  // 1. Churches fund balance (public)
  console.log('1. GET /api/churches/fund')
  try {
    const res = await api.get('/api/churches/fund')
    const { address, slearnBalance, usdtBalance } = res.data
    if (res.status === 200 && isAddress(address)) {
      ok(`fund endpoint 200 (address=${address.slice(0, 10)}…)`)
    } else {
      fail('fund endpoint', `status ${res.status}, address=${address}`)
    }

    const slearn = Number(slearnBalance)
    const usdt = Number(usdtBalance)
    if (Number.isFinite(slearn)) {
      ok(`slearnBalance=${slearnBalance} SLEARN`)
      if (slearn > 0) ok('churches fund has SLEARN (> 0)')
      else fail('churches fund has SLEARN', `slearnBalance=${slearnBalance} (expected > 0)`)
    } else {
      fail('slearnBalance not a number', String(slearnBalance))
    }
    if (Number.isFinite(usdt)) {
      ok(`usdtBalance=${usdtBalance} USDT`)
    } else {
      fail('usdtBalance not a number', String(usdtBalance))
    }
  } catch (e) {
    fail('GET /api/churches/fund', `${e.response?.status || e.message}`)
  }

  // 2. Pastor landing page (public)
  console.log('\n2. Pastor landing page')
  for (const path of ['/en/gdcluster/pastors', '/es/redgd/pastores']) {
    try {
      const res = await axios.get(`${BASE_URL}${path}`, {
        httpsAgent,
        headers: { 'User-Agent': 'PastorBonus-E2E-Test/1.0' },
        maxRedirects: 0,
      })
      const text = String(res.data || '')
      const needle = path.startsWith('/es') ? 'SLEARN para pastores' : 'SLEARN for non-Zionist pastors'
      if (res.status === 200 && text.includes(needle)) ok(`landing ${path} 200 + title`)
      else fail(`landing ${path}`, `status ${res.status}, title=${text.includes(needle)}`)
    } catch (e) {
      fail(`landing ${path}`, `${e.response?.status || e.message}`)
    }
  }

  console.log(`\n${failures === 0 ? '✅' : '❌'} ${passed} passed, ${failures} failed`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('FATAL:', e.message)
  process.exit(1)
})
