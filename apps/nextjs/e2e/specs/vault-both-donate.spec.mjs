#!/usr/bin/env node
// Diagnose: vault donation with BOTH USDT + SLEARN through /api/add-donation
// (dev server). Transfers both tokens to the backend, then posts both hashes.
import * as fs from 'fs'
import * as path from 'path'
import https from 'https'
import axios from 'axios'
import { SiweMessage } from 'siwe'
import { privateKeyToAddress, privateKeyToAccount } from 'viem/accounts'
import { createPublicClient, createWalletClient, http } from 'viem'
import { celoSepolia } from 'viem/chains'

const SITE = process.env.SITE_URL || 'https://learn.tg:9001'
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11142220', 10)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const httpsAgent = new https.Agent({ rejectUnauthorized: false })

function loadEnv() {
  const env = fs.readFileSync(path.join(process.cwd(), '..', '.env'), 'utf8')
  const g = (k) => env.match(new RegExp(`${k}=\"?([^\"\\n]+)\"?`))?.[1]
  return {
    pk: g('PRIVATE_KEY'), addr: g('NEXT_PUBLIC_ADDRESS'),
    usdt: g('NEXT_PUBLIC_USDT_ADDRESS'), slearn: g('NEXT_PUBLIC_SLEARN_ADDRESS'),
    backend: g('NEXT_PUBLIC_ADDRESS'), rpc: g('NEXT_PUBLIC_RPC_URL'),
  }
}

function updateCookies(cur, sc) {
  const m = new Map()
  if (cur) cur.split(';').forEach(c => { const [n, ...r] = c.trim().split('='); if (n && r.length) m.set(n, `${n}=${r.join('=')}`) })
  if (sc) sc.forEach(h => { const c = h.split(';')[0].trim(); const [n, ...r] = c.split('='); if (n && r.length) m.set(n, c) })
  return Array.from(m.values()).join('; ')
}

async function main() {
  const env = loadEnv()
  if (!env.pk || !env.usdt || !env.slearn) { console.error('Missing env'); process.exit(1) }
  const account = privateKeyToAccount(env.pk)

  // Real dev-server backend wallet (dev SLEARN admin/MINTER, from fund API)
  const backend = '0x01a72816110a88883F79026C0199827fCF9184c8'
  console.log('Wallet:', account.address, '| dev backend:', backend)
  console.log('USDT:', env.usdt, '| SLEARN:', env.slearn)

  const rpc = env.rpc || 'https://forno.celo-sepolia.celo-testnet.org'
  const client = createPublicClient({ chain: celoSepolia, transport: http(rpc) })
  const wallet = createWalletClient({ account, chain: celoSepolia, transport: http(rpc) })

  const erc20 = [{ name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] }]

  const usdtBal = await client.readContract({ address: env.usdt, abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }], functionName: 'balanceOf', args: [account.address] })
  const slearnBal = await client.readContract({ address: env.slearn, abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }], functionName: 'balanceOf', args: [account.address] })
  console.log('Balances — USDT:', Number(usdtBal) / 1e6, 'SLEARN:', Number(slearnBal) / 1e2)

  // 1. Transfer 1 USDT + 10 SLEARN to the backend
  console.log('\nTransferring 1 USDT + 10 SLEARN to backend...')
  const usdtHash = await wallet.writeContract({ address: env.usdt, abi: erc20, functionName: 'transfer', args: [backend, 1000000n] })
  console.log('USDT tx:', usdtHash)
  const slearnHash = await wallet.writeContract({ address: env.slearn, abi: erc20, functionName: 'transfer', args: [backend, 1000n] })
  console.log('SLEARN tx:', slearnHash)
  await client.waitForTransactionReceipt({ hash: usdtHash, timeout: 120_000 })
  await client.waitForTransactionReceipt({ hash: slearnHash, timeout: 120_000 })
  console.log('Both receipts confirmed')

  // 2. SIWE sign-in
  const csrfRes = await axios.get(`${SITE}/api/auth/csrf`, { httpsAgent })
  const csrfToken = csrfRes.data.csrfToken
  let cookies = ''
  if (csrfRes.headers['set-cookie']) cookies = updateCookies(cookies, csrfRes.headers['set-cookie'])
  const msg = new SiweMessage({ domain: new URL(SITE).host, address: account.address, statement: 'Sign in to Learn through games with DIVVI tracking.', uri: SITE, version: '1', chainId: CHAIN_ID, nonce: csrfToken, issuedAt: new Date().toISOString() })
  const message = msg.prepareMessage()
  const signature = await account.signMessage({ message })
  const fd = new URLSearchParams({ csrfToken, message, signature, redirect: 'false', callbackUrl: `${SITE}/`, json: 'true' })
  const res = await axios.post(`${SITE}/api/auth/callback/credentials`, fd.toString(), { httpsAgent, headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookies }, maxRedirects: 0, validateStatus: s => s < 400 })
  if (res.headers['set-cookie']) cookies = updateCookies(cookies, res.headers['set-cookie'])

  // 3. POST /api/add-donation with BOTH hashes
  console.log('\nPOST /api/add-donation (both) courseId=1...')
  const payload = {
    walletAddress: account.address, token: csrfToken,
    donationAmountUSD: 1, slearnDonationAmount: 10,
    usdtHash, slearnHash, courseId: 1,
  }
  const d = await axios.post(`${SITE}/api/add-donation`, payload, { httpsAgent, headers: { 'Content-Type': 'application/json', Cookie: cookies }, validateStatus: s => s < 500 })
  console.log('add-donation status:', d.status)
  console.log('response:', JSON.stringify(d.data).slice(0, 500))
}

main().catch(e => { console.error('FATAL', e?.response?.data || e.message); process.exit(1) })
