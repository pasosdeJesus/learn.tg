#!/usr/bin/env node

/**
 * Premium courses smoke test (HTTP).
 * Verifies the premium-course endpoints and access control:
 *   1. Price endpoint is wired (deployed).
 *   2. Premium guide returns 403 for a non-purchaser.
 *   3. Access endpoint returns 403 for a non-purchaser.
 *   4. "My premium courses" lists empty for a fresh wallet.
 */

import 'dotenv/config';
import axios from 'axios';
import https from 'https';
import { SiweMessage } from 'siwe';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';

const BASE_URL = process.env.NEXT_PUBLIC_AUTH_URL || 'https://learn.tg:9001';
const CHAIN_ID = 11142220;
const PREMIUM_COURSE_ID = 10; // GD course (EN), porPagar=1

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

let failures = 0;
let passed = 0;

function ok(name) {
  passed++;
  console.log(`  ✅ ${name}`);
}

function fail(name, detail) {
  failures++;
  console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
}

// ── Cookie handling (double-submit CSRF) ──
function parseCookieHeader(cookieHeader) {
  return cookieHeader.split(';')[0].trim();
}

function updateCookies(currentCookies, setCookieHeaders) {
  const map = new Map();
  if (currentCookies) {
    currentCookies.split(';').forEach((c) => {
      const [name, ...rest] = c.trim().split('=');
      if (name && rest.length) map.set(name, `${name}=${rest.join('=')}`);
    });
  }
  if (setCookieHeaders) {
    setCookieHeaders.forEach((h) => {
      const cookie = parseCookieHeader(h);
      const [name, ...rest] = cookie.split('=');
      if (name && rest.length) map.set(name, cookie);
    });
  }
  return Array.from(map.values()).join('; ');
}

async function main() {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  console.log(`🔐 Premium smoke — wallet: ${account.address}\n`);

  let cookies = '';
  const api = axios.create({
    baseURL: BASE_URL,
    httpsAgent,
    headers: { 'User-Agent': 'Premium-E2E-Test/1.0', Accept: 'application/json' },
    maxRedirects: 0,
  });
  api.interceptors.response.use((res) => {
    const sc = res.headers['set-cookie'];
    if (sc) cookies = updateCookies(cookies, sc);
    return res;
  });
  api.interceptors.request.use((config) => {
    if (cookies) config.headers.Cookie = cookies;
    return config;
  });

  // 1. SIWE auth
  console.log('1. SIWE auth');
  const csrfRes = await api.get('/api/auth/csrf');
  const csrfToken = csrfRes.data.csrfToken;
  const siweMessage = new SiweMessage({
    domain: 'learn.tg:9001',
    address: account.address,
    statement: 'Sign in to Learn through games with DIVVI tracking.',
    uri: BASE_URL,
    version: '1',
    chainId: CHAIN_ID,
    nonce: csrfToken,
    issuedAt: new Date().toISOString(),
  });
  const message = siweMessage.prepareMessage();
  const signature = await account.signMessage({ message });

  const formData = new URLSearchParams();
  formData.append('csrfToken', csrfToken);
  formData.append('message', message);
  formData.append('signature', signature);
  formData.append('redirect', 'false');
  formData.append('callbackUrl', `${BASE_URL}/`);
  formData.append('json', 'true');

  const cb = await api.post('/api/auth/callback/credentials', formData.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (cb.status === 200) ok('SIWE auth');
  else return fail('SIWE auth', `status ${cb.status}`);

  // The nonce doubles as the API auth token (billetera_usuario.token)
  const token = csrfToken;
  const walletAddress = account.address;

  // 2. Price endpoint (fresh wallet has no country → 400, proves deployed)
  console.log('\n2. Price endpoint');
  try {
    const priceRes = await api.get(
      `/api/courses/premium/price?courseId=${PREMIUM_COURSE_ID}&walletAddress=${walletAddress}&token=${token}`,
    );
    if (priceRes.status === 200) ok('Price endpoint 200', `priceUSDT=${priceRes.data.priceUSDT}`);
    else fail('Price endpoint', `unexpected status ${priceRes.status}`);
  } catch (e) {
    const status = e.response?.status;
    if (status === 400) ok('Price endpoint wired (400 country-not-set, expected)');
    else fail('Price endpoint', `status ${status} — ${e.message}`);
  }

  // 3. Premium guide access control → 403 for non-purchaser
  console.log('\n3. Guide access control (premium, not purchased)');
  try {
    await api.get(
      `/api/guide?courseId=${PREMIUM_COURSE_ID}&lang=en&prefix=gdcluster&guide=guide1&walletAddress=${walletAddress}&token=${token}`,
    );
    fail('Guide access control', 'expected 403 but got 200');
  } catch (e) {
    const status = e.response?.status;
    if (status === 403) ok('Guide 403 for non-purchaser');
    else fail('Guide access control', `expected 403, got ${status}`);
  }

  // 4. Access endpoint → 403 for non-purchaser
  console.log('\n4. Access endpoint');
  try {
    await api.get(
      `/api/courses/${PREMIUM_COURSE_ID}/access?walletAddress=${walletAddress}&token=${token}`,
    );
    fail('Access endpoint', 'expected 403 but got 200');
  } catch (e) {
    const status = e.response?.status;
    const reason = e.response?.data?.reason || e.response?.data?.error || '(no reason)';
    console.log(`     reason: ${reason}`);
    if (status === 403) ok('Access 403 for non-purchaser');
    else fail('Access endpoint', `expected 403, got ${status}`);
  }

  // 5. "My premium courses" → empty list
  console.log('\n5. My premium courses');
  try {
    const mineRes = await api.get(
      `/api/courses/premium/mine?walletAddress=${walletAddress}&token=${token}`,
    );
    if (mineRes.status === 200 && Array.isArray(mineRes.data.courses) && mineRes.data.courses.length === 0) {
      ok('My premium courses empty');
    } else {
      fail('My premium courses', `unexpected ${JSON.stringify(mineRes.data)}`);
    }
  } catch (e) {
    fail('My premium courses', `${e.response?.status} — ${e.message}`);
  }

  console.log(`\n${failures === 0 ? '✅' : '❌'} ${passed} passed, ${failures} failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
