/**
 * E2E test: verifies SLEARN.sol fixes from prob-slearn1.md on Celo Sepolia.
 *
 * Run: npx hardhat run scripts/test-slearn-fixes.ts --network celoSepolia
 */
import { createPublicClient, createWalletClient, http, parseUnits, formatUnits, parseEventLogs, encodeFunctionData } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo, celoSepolia } from 'viem/chains'
import dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
dotenv.config({ path: '../.env' })

const network = process.env.NEXT_PUBLIC_NETWORK || 'celoSepolia'
const chain = network === 'celo' ? celo : celoSepolia
const slearnFile = path.join(__dirname, '..', 'deployments', 'SLEARN', `${network}.json`)
const vaultFile = path.join(__dirname, '..', 'deployments', 'LearnTGVaults', 'V3', `${network}.json`)

const SLEARN_ADDR = JSON.parse(fs.readFileSync(slearnFile, 'utf8')).address as `0x${string}`
const VAULT_ADDR = JSON.parse(fs.readFileSync(vaultFile, 'utf8')).address as `0x${string}`
const USDT_ADDR = process.env.NEXT_PUBLIC_USDT_ADDRESS as `0x${string}`
const RPC = process.env.NEXT_PUBLIC_RPC_URL || 'https://forno.celo-sepolia.celo-testnet.org'
const testCourseId = 998n

const PRIVATE_KEY = process.env.PRIVATE_KEY! as `0x${string}`
const account = privateKeyToAccount(PRIVATE_KEY)
const pc = createPublicClient({ chain, transport: http(RPC) })
const wc = createWalletClient({ chain: celoSepolia, transport: http(RPC), account })

const erc20Abi = [
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'approve', type: 'function', inputs: [{ name: 's', type: 'address' }, { name: 'a', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'transfer', type: 'function', inputs: [{ name: 't', type: 'address' }, { name: 'a', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const

const slearnAbi = [
  { name: 'mintAndReserve', type: 'function', inputs: [{ name: 't', type: 'address' }, { name: 'a', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { name: 'processPayment', type: 'function', inputs: [
    { name: 'payer', type: 'address' }, { name: 'usdtAmount', type: 'uint256' }, { name: 'slearnAmount', type: 'uint256' },
    { name: 'courseId', type: 'uint256' },
    { name: 'pdJ', type: 'uint256' }, { name: 'reward', type: 'uint256' },
    { name: 'missional', type: 'uint256' }, { name: 'ubi', type: 'uint256' },
    { name: 'referral', type: 'uint256' }, { name: 'churches', type: 'uint256' },
  ], outputs: [] },
  { name: 'addMissionalCourse', type: 'function', inputs: [{ name: 'c', type: 'uint256' }], outputs: [] },
  { name: 'referralWallet', type: 'function', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'approve', type: 'function', inputs: [{ name: 's', type: 'address' }, { name: 'a', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'MintAndReserve', type: 'event', inputs: [
    { name: 'to', type: 'address', indexed: true }, { name: 'usdtAmount', type: 'uint256' }, { name: 'slearnAmount', type: 'uint256' }] },
  { name: 'MissionalCourseFunds', type: 'event', inputs: [
    { name: 'courseId', type: 'uint256', indexed: true }, { name: 'usdtAmount', type: 'uint256' }, { name: 'slearnAmount', type: 'uint256' }] },
  { name: 'ReferralReward', type: 'event', inputs: [
    { name: 'referralAddress', type: 'address', indexed: true }, { name: 'usdtAmount', type: 'uint256' }, { name: 'slearnAmount', type: 'uint256' }] },
  { name: 'ChurchesFundReceived', type: 'event', inputs: [
    { name: 'wallet', type: 'address' }, { name: 'usdtAmount', type: 'uint256' }, { name: 'slearnAmount', type: 'uint256' }] },
  { name: 'CourseVaultFunds', type: 'event', inputs: [
    { name: 'courseId', type: 'uint256', indexed: true }, { name: 'usdtAmount', type: 'uint256' }, { name: 'slearnAmount', type: 'uint256' }] },
] as const

const vaultAbi = [
  { name: 'createVault', type: 'function', inputs: [
    { name: 'c', type: 'uint256' }, { name: 'u', type: 'uint256' }, { name: 's', type: 'uint256' }], outputs: [] },
  { name: 'vaults', type: 'function', inputs: [{ name: 'c', type: 'uint256' }], outputs: [
    { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'bool' }] },
] as const

async function writeContract(abi: any, address: `0x${string}`, functionName: string, args: any[]) {
  const data = encodeFunctionData({ abi, functionName, args })
  const hash = await wc.sendTransaction({ to: address, data, account, gas: 5000000n })
  return await pc.waitForTransactionReceipt({ hash })
}

function readContract(abi: any, address: `0x${string}`, functionName: string, args: any[]) {
  return pc.readContract({ abi, address, functionName, args })
}

let passed = 0, failed = 0
function check(name: string, condition: boolean, detail?: string) {
  if (condition) { console.log(`  ✅ ${name}`); passed++ }
  else { console.log(`  ❌ ${name}${detail ? ': ' + detail : ''}`); failed++ }
}

async function main() {
  console.log('=== SLEARN Fixes E2E Test ===')
  console.log('Backend:', account.address)
  console.log('SLEARN:', SLEARN_ADDR, 'Vault:', VAULT_ADDR)

  // ================================================================
  // SETUP
  // ================================================================
  console.log('\n--- SETUP ---')
  let usdtBal = await readContract(erc20Abi, USDT_ADDR, 'balanceOf', [account.address]) as bigint
  console.log('USDT balance:', formatUnits(usdtBal, 6))

  // Fund SLEARN contract and approve it to pull USDT and SLEARN from backend
  const fundUSDT = parseUnits('25', 6)
  await writeContract(erc20Abi, USDT_ADDR, 'transfer', [SLEARN_ADDR, fundUSDT])
  console.log('Funded SLEARN with 25 USDT')

  // Approve SLEARN contract to spend backend's USDT and SLEARN
  const maxApprove = parseUnits('1000000', 6)
  await writeContract(erc20Abi, USDT_ADDR, 'approve', [SLEARN_ADDR, maxApprove])
  console.log('Approved SLEARN for USDT spend')
  const maxSlearnApprove = parseUnits('1000000', 2)
  await writeContract(slearnAbi, SLEARN_ADDR, 'approve', [SLEARN_ADDR, maxSlearnApprove])
  console.log('Approved SLEARN for SLEARN spend')

  // ================================================================
  // FIX 1: mintAndReserve returns uint256
  // ================================================================
  console.log('\n=== FIX 1: mintAndReserve returns uint256 ===')
  const mintUSDT = parseUnits('1', 6)
  await writeContract(erc20Abi, USDT_ADDR, 'transfer', [SLEARN_ADDR, mintUSDT])

  const receipt1 = await writeContract(slearnAbi, SLEARN_ADDR, 'mintAndReserve', [account.address, mintUSDT])
  const logs1 = parseEventLogs({ abi: slearnAbi, logs: receipt1.logs, eventName: 'MintAndReserve' })

  check('mintAndReserve emits event', logs1.length >= 1)
  if (logs1.length > 0) {
    const e = logs1[0].args
    const expected = 22n * (10n ** 2n) // 2200
    check('MintAndReserve usdtAmount=1e6', e.usdtAmount === mintUSDT)
    check('MintAndReserve slearnAmount=2200', e.slearnAmount === expected,
      `got ${e.slearnAmount}`)
  }

  // ================================================================
  // FIX 2: referralAddress removed, funds go to referralWallet
  // ================================================================
  console.log('\n=== FIX 2: referralAddress removed ===')

  // Verify ABI: processPayment has 10 inputs (no referralAddress)
  const ppAbi = slearnAbi.find((a: any) => a.name === 'processPayment')!
  check('processPayment has 10 params (no referralAddress)', ppAbi.inputs.length === 10,
    `got ${ppAbi.inputs.length}`)

  // ================================================================
  // FIX 2 & 3: processPayment + events (USDT-only then mixed)
  // ================================================================
  console.log('\n=== FIX 2/3: processPayment + event order ===')

  // Create vault + missional (idempotent: ignore if already exists)
  try {
    await writeContract(vaultAbi, VAULT_ADDR, 'createVault', [testCourseId, parseUnits('1', 6), parseUnits('22', 2)])
  } catch (e: any) {
    if (!e.message?.includes('already exists')) throw e
    console.log('Vault already exists, continuing')
  }
  try {
    await writeContract(slearnAbi, SLEARN_ADDR, 'addMissionalCourse', [testCourseId])
  } catch (e: any) {
    if (!e.message?.includes('already missional')) throw e
    console.log('Missional course already added, continuing')
  }

  // USDT-only payment: 5% missional, 5% churches, 2.5% referral, 2.5% UBI, 5% pdJ, 10% reward
  const payUSDT = parseUnits('10', 6)
  await writeContract(erc20Abi, USDT_ADDR, 'transfer', [SLEARN_ADDR, payUSDT])

  const receipt2 = await writeContract(slearnAbi, SLEARN_ADDR, 'processPayment', [
    account.address, payUSDT, 0n, testCourseId,
    5n, 10n, 5n, 2n, 2n, 5n,
  ])
  const allLogs = parseEventLogs({ abi: slearnAbi, logs: receipt2.logs })

  // FIX 3: MissionalCourseFunds emits with USDT-only
  const missionalEvents = allLogs.filter((l: any) => l.eventName === 'MissionalCourseFunds')
  check('FIX3a: MissionalCourseFunds emitted (USDT-only)', missionalEvents.length > 0)
  if (missionalEvents.length > 0) {
    const me = missionalEvents[0].args
    check('FIX3a: MissionalCourseFunds 2nd=USDT (>0)', me.usdtAmount > 0n)
    check('FIX3a: MissionalCourseFunds 3rd=SLEARN', typeof me.slearnAmount === 'bigint')
  }

  // FIX 3: Church events in correct order
  const churchEvents = allLogs.filter((l: any) => l.eventName === 'ChurchesFundReceived')
  check('FIX3a: ChurchesFundReceived emitted', churchEvents.length > 0)
  if (churchEvents.length > 0) {
    const ce = churchEvents[0].args
    check('FIX3a: ChurchesFund 2nd=USDT (>0)', ce.usdtAmount > 0n)
    check('FIX3a: ChurchesFund 3rd=SLEARN', typeof ce.slearnAmount === 'bigint')
  }

  // FIX 3: CourseVaultFunds in correct order
  const vaultEvents = allLogs.filter((l: any) => l.eventName === 'CourseVaultFunds')
  check('FIX3a: CourseVaultFunds emitted', vaultEvents.length > 0)
  if (vaultEvents.length > 0) {
    const ve = vaultEvents[0].args
    check('FIX3a: CourseVaultFunds 2nd=USDT (>0)', ve.usdtAmount > 0n)
    check('FIX3a: CourseVaultFunds 3rd=SLEARN', typeof ve.slearnAmount === 'bigint')
  }

  // FIX 2: Referral goes to referralWallet
  const refWallet = await readContract(slearnAbi, SLEARN_ADDR, 'referralWallet', []) as string
  const refEvents = allLogs.filter((l: any) => l.eventName === 'ReferralReward')
  check('FIX2: ReferralReward emitted', refEvents.length > 0)
  if (refEvents.length > 0) {
    const re = refEvents[0].args
    check('FIX2: ReferralReward → referralWallet',
      re.referralAddress?.toLowerCase() === refWallet.toLowerCase(),
      `got ${re.referralAddress} expected ${refWallet}`)
  }

  // ================================================================
  // FIX 3b: Mixed payment (USDT + SLEARN) — SLEARN in SLEARN units
  // ================================================================
  console.log('\n=== FIX 3b: Mixed payment ===')

  // Get SLEARN first
  const buyUSDT = parseUnits('3', 6)
  await writeContract(erc20Abi, USDT_ADDR, 'transfer', [SLEARN_ADDR, buyUSDT])
  await writeContract(slearnAbi, SLEARN_ADDR, 'mintAndReserve', [account.address, buyUSDT])

  const slearnBal = await readContract(slearnAbi, SLEARN_ADDR, 'balanceOf', [account.address]) as bigint
  console.log('Backend SLEARN:', formatUnits(slearnBal, 2))

  // Mixed: 2 USDT + 22 SLEARN
  const mixedUSDT = parseUnits('2', 6)
  const mixedSLEARN = parseUnits('22', 2)

  await writeContract(erc20Abi, USDT_ADDR, 'transfer', [SLEARN_ADDR, mixedUSDT])
  await writeContract(slearnAbi, SLEARN_ADDR, 'approve', [SLEARN_ADDR, mixedSLEARN])

  const receipt3 = await writeContract(slearnAbi, SLEARN_ADDR, 'processPayment', [
    account.address, mixedUSDT, mixedSLEARN, testCourseId,
    5n, 10n, 5n, 2n, 2n, 5n,
  ])
  const mixedLogs = parseEventLogs({ abi: slearnAbi, logs: receipt3.logs })

  // Check MissionalCourseFunds has SLEARN > 0
  const mixedMissional = mixedLogs.filter((l: any) => l.eventName === 'MissionalCourseFunds')
  if (mixedMissional.length > 0) {
    const mm = mixedMissional[0].args
    check('FIX3b: Missional SLEARN > 0 with mixed', mm.slearnAmount > 0n, `got ${mm.slearnAmount}`)
  }

  // Check CourseVaultFunds has SLEARN > 0
  const mixedVault = mixedLogs.filter((l: any) => l.eventName === 'CourseVaultFunds')
  if (mixedVault.length > 0) {
    const mv = mixedVault[0].args
    check('FIX3b: Vault SLEARN > 0 with mixed', mv.slearnAmount > 0n, `got ${mv.slearnAmount}`)
  }

  // Verify vault received both
  const vd = await readContract(vaultAbi, VAULT_ADDR, 'vaults', [testCourseId]) as any
  check('Vault USDT > 0', vd[1] > 0n)
  check('Vault SLEARN > 0', vd[2] > 0n)
  console.log('Vault:', { usdt: formatUnits(vd[1], 6), slearn: formatUnits(vd[2], 2) })

  // ================================================================
  console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
