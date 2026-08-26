
import { NextRequest, NextResponse } from 'next/server'
import { type Address, formatUnits } from 'viem'
import type { RewardsDeps } from '../index'
import SLEARNAbi from '../abis/SLEARN.json'
import { getSlearnAddress } from '../lib/deployments'
import { verifyTransfer } from '../lib/verify-transfer'
import { checkReplayAttack } from '../lib/replay-protection'

const DONATION_PCT = {
  pdJ: 5, reward: 10, missional: 5, ubi: 2, referral: 3, churches: 5,
}

/**
 * Distribution breakdown computed from the known percentages (DONATION_PCT)
 * passed to SLEARN.processPayment. This is the intended split and sums to 100%.
 * Separates pdJ from community funds (UBI+referrals, churches, missional).
 */
function computeDistribution(usdtValue: number, slearnValue: number, courseId: number, slearnRate: number) {
  const vaultUsdt = usdtValue * 0.35
  const vaultSlearn = Math.round(usdtValue * 0.35 * slearnRate * 100) / 100 + slearnValue * 0.35
  const pdJUsdt = usdtValue * 0.05
  const missionalUsdt = usdtValue * 0.05
  const ubiReferralUsdt = usdtValue * (0.02 + 0.03)
  const churchesUsdt = usdtValue * 0.05
  const cashback = Math.round((usdtValue + slearnValue / slearnRate) * 0.10 * slearnRate * 100) / 100

  const distribution = []
  if (vaultUsdt > 0) distribution.push({ destination: 'course_vault', amount: vaultUsdt, crypto: 'usdt' })
  if (vaultSlearn > 0) distribution.push({ destination: 'course_vault', amount: vaultSlearn, crypto: 'slearn' })
  if (pdJUsdt > 0) distribution.push({ destination: 'pdJ', amount: pdJUsdt, crypto: 'usdt' })
  if (missionalUsdt > 0) distribution.push({ destination: 'missional', amount: missionalUsdt, crypto: 'usdt' })
  if (ubiReferralUsdt > 0) distribution.push({ destination: 'ubi_referrals', amount: ubiReferralUsdt, crypto: 'usdt' })
  if (churchesUsdt > 0) distribution.push({ destination: 'churches', amount: churchesUsdt, crypto: 'usdt' })
  if (cashback > 0) distribution.push({ destination: 'cashback', amount: cashback, crypto: 'slearn' })
  return distribution
}

export async function addDonation(deps: RewardsDeps, req: NextRequest) {
  console.log('** API POST /api/add-donation')

  const db = deps.db()

  try {
    const requestJson = await req.json()
    const { walletAddress, token, donationAmountUSD, slearnDonationAmount, usdtHash, slearnHash, courseId } = requestJson

    if (!walletAddress || !token || !courseId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }
    if (!usdtHash && !slearnHash) {
      return NextResponse.json({ error: 'At least one transaction hash required' }, { status: 400 })
    }

    const auth = await deps.authenticateUser(db, walletAddress, token)
    if (!auth) return NextResponse.json({ error: "Authentication failed." }, { status: 401 })
    const { usuario } = auth

    const replayError = await checkReplayAttack(db, [usdtHash, slearnHash])
    if (replayError) return replayError

    const publicClient = deps.backend.getPublicClient()
    const backendWallet = deps.backend.getBackendWallet()
    const usdtAddress = await deps.backend.getUsdtAddress()
    const slearnAddress = await getSlearnAddress()

    if (!backendWallet || !usdtAddress) {
      return NextResponse.json({ error: 'Backend wallet or USDT address not configured' }, { status: 500 })
    }

    const usdtDecimals = deps.backend.getUsdtDecimals()

    let onChainUsdtAmount = 0n
    let onChainSlearnAmount = 0n

    if (usdtHash) {
      try {
        console.log('[DonationDiag] verifying usdt', usdtHash)
        const { amount } = await verifyTransfer(deps.backend.fetchTxWithReceipt, publicClient, usdtHash, 'usdt', walletAddress, backendWallet, usdtAddress, deps.backend.MAX_TX_AGE)
        onChainUsdtAmount = amount
        console.log('[DonationDiag] usdt verified', amount.toString())
      } catch (e: any) {
        console.log('[DonationDiag] usdt verify FAILED', { hash: usdtHash, name: e?.constructor?.name, message: e?.message })
        return NextResponse.json({ error: e.message }, { status: 400 })
      }
    }
    if (slearnHash && slearnAddress) {
      try {
        console.log('[DonationDiag] verifying slearn', slearnHash)
        const { amount } = await verifyTransfer(deps.backend.fetchTxWithReceipt, publicClient, slearnHash, 'slearn', walletAddress, backendWallet, slearnAddress, deps.backend.MAX_TX_AGE)
        onChainSlearnAmount = amount
        console.log('[DonationDiag] slearn verified', amount.toString())
      } catch (e: any) {
        console.log('[DonationDiag] slearn verify FAILED', { hash: slearnHash, name: e?.constructor?.name, message: e?.message })
        return NextResponse.json({ error: e.message }, { status: 400 })
      }
    }

    // Read vault addresses from SLEARN contract for log parsing
    console.log('[DonationDiag] reading vault addresses')
    const vaultUsdt = await publicClient.readContract({
      address: slearnAddress, abi: SLEARNAbi as any, functionName: 'learnTGVault',
    }) as Address
    const vaultSlearn = await publicClient.readContract({
      address: slearnAddress, abi: SLEARNAbi as any, functionName: 'learnTGVaultSLEARN',
    }) as Address
    console.log('[DonationDiag] vaults', { vaultUsdt, vaultSlearn })

    // Call SLEARN.processPayment
    const walletClient = deps.backend.getWalletClient()
    const chain = deps.backend.getChain()

    console.log('[DonationDiag] calling processPayment', {
      usdt: onChainUsdtAmount.toString(), slearn: onChainSlearnAmount.toString(), courseId,
    })
    const processPaymentHash = await deps.backend.sendTxAndWait(walletClient, publicClient, {
      address: slearnAddress, abi: SLEARNAbi as any, functionName: 'processPayment',
      args: [
        walletAddress as Address, onChainUsdtAmount, onChainSlearnAmount, BigInt(courseId),
        BigInt(DONATION_PCT.pdJ), BigInt(DONATION_PCT.reward), BigInt(DONATION_PCT.missional),
        BigInt(DONATION_PCT.ubi), BigInt(DONATION_PCT.referral), BigInt(DONATION_PCT.churches),
      ],
      chain,
    })
    console.log("OJO processPaymentHash=", processPaymentHash)

    // Record: one row per crypto the user sent, plus one reward row.
    // Distribution computed from the known percentages (DONATION_PCT).
    const actualUSDTValue = onChainUsdtAmount > 0n
      ? Number(formatUnits(onChainUsdtAmount, usdtDecimals)) : 0
    const actualSlearnValue = onChainSlearnAmount > 0n
      ? Number(formatUnits(onChainSlearnAmount, deps.backend.SLEARN_DECIMALS)) : 0

    const distribution = computeDistribution(actualUSDTValue, actualSlearnValue, Number(courseId), deps.backend.SLEARN_RATE)
    const breakdownText = distribution
      .map(d => `${d.destination}: ${d.amount.toFixed(2)} ${d.crypto.toUpperCase()}`)
      .join('\n')
    const slearnReward = distribution.find(d => d.destination === 'cashback')?.amount || 0

    if (onChainUsdtAmount > 0n && usdtHash) {
      await db.insertInto('transaction').values({
        usuario_id: usuario.id, date: new Date(), type: 'donation', crypto: 'usdt',
        amount: actualUSDTValue, balance_impact: -actualUSDTValue, hash: usdtHash,
        wallet: walletAddress, categoria: 'donation', subcategoria: 'course_vault',
        descripcion: `donated: ${actualUSDTValue.toFixed(2)} USDT\n${breakdownText}`,
        metadata: { courseId, processPaymentHash, distribution },
      }).execute()
    }
    if (onChainSlearnAmount > 0n && slearnHash) {
      await db.insertInto('transaction').values({
        usuario_id: usuario.id, date: new Date(), type: 'donation', crypto: 'slearn',
        amount: actualSlearnValue, balance_impact: -actualSlearnValue, hash: slearnHash,
        wallet: walletAddress, categoria: 'donation', subcategoria: 'course_vault',
        descripcion: `donated: ${actualSlearnValue.toFixed(2)} SLEARN\n${breakdownText}`,
        metadata: { courseId, processPaymentHash, distribution },
      }).execute()
    }
    if (slearnReward > 0) {
      await db.insertInto('transaction').values({
        usuario_id: usuario.id, date: new Date(), type: 'donation_reward', crypto: 'slearn',
        amount: slearnReward, balance_impact: slearnReward, wallet: walletAddress, hash: null,
        descripcion: `cashback: ${slearnReward.toFixed(2)} SLEARN (10%)`,
        metadata: { courseId, processPaymentHash, usdtHash, slearnHash },
      }).execute()
    }

    console.log(`Donation processed: ${actualUSDTValue} USDT + ${actualSlearnValue} SLEARN. SLEARN reward: +${slearnReward}. processPayment tx: ${processPaymentHash}`)

    return NextResponse.json({
      message: 'Donation processed and SLEARN reward added',
      increment: slearnReward,
      processPaymentHash,
      distribution,
    }, { status: 200 })
  } catch (error) {
    console.error('[DonationDiag] EXCEPTION in add-donation:', {
      name: (error as any)?.constructor?.name,
      shortMessage: (error as any)?.shortMessage,
      message: (error as any)?.message || String(error),
    })
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}