
import { NextRequest, NextResponse } from 'next/server'
import { type Address, formatUnits } from 'viem'
import type { RewardsDeps } from '../index'
import SLEARNAbi from '../abis/SLEARN.json'
import { getSlearnAddress } from '../lib/deployments'
import { SLEARN_DISCOUNT, calculatePremiumPriceUsdt } from '../lib/premium-pricing'
import { verifyTransfer } from '../lib/verify-transfer'
import { checkReplayAttack } from '../lib/replay-protection'

const PREMIUM_PCT = {
  pdJ: 55, reward: 10, missional: 10, ubi: 5, referral: 5, churches: 5,
}

/**
 * Clean distribution computed from the percentages actually passed to
 * SLEARN.processPayment (REQ/128). For GD courses, 10% is routed to the
 * country/cluster fund first (ClusterFundsV2, 100% net) and processPayment
 * receives the remaining 90%. Sums to 100% of the payment.
 */
function computePremiumDistribution(usdtValue: number, slearnValue: number, courseId: number, isGd: boolean, slearnRate: number) {
  const r2 = (v: number) => Math.round(v * 100) / 100
  const distribution: { destination: string; amount: number; crypto: string }[] = []
  const push = (destination: string, amount: number, crypto: 'usdt' | 'slearn') => {
    const a = r2(amount)
    if (a > 0) distribution.push({ destination, amount: a, crypto })
  }

  if (isGd) {
    // 10% to the buyer's country/cluster fund (100% net in ClusterFundsV2)
    push('country_fund', usdtValue * 0.1, 'usdt')
    push('country_fund', slearnValue * 0.1, 'slearn')
  }

  const pu = isGd ? usdtValue * 0.9 : usdtValue
  const ps = isGd ? slearnValue * 0.9 : slearnValue
  const pdJPct = isGd ? 40 : PREMIUM_PCT.pdJ

  push('pdJ', (pu * pdJPct) / 100, 'usdt')
  push('pdJ', (ps * pdJPct) / 100, 'slearn')
  // Reward/cashback is delivered in SLEARN (USDT part is minted as SLEARN)
  push('cashback', (pu * PREMIUM_PCT.reward * slearnRate) / 100 + (ps * PREMIUM_PCT.reward) / 100, 'slearn')
  push('missional', (pu * PREMIUM_PCT.missional) / 100, 'usdt')
  push('missional', (ps * PREMIUM_PCT.missional) / 100, 'slearn')
  push('ubi', (pu * PREMIUM_PCT.ubi) / 100, 'usdt')
  push('ubi', (ps * PREMIUM_PCT.ubi) / 100, 'slearn')
  push('referral', (pu * PREMIUM_PCT.referral) / 100, 'usdt')
  push('referral', (ps * PREMIUM_PCT.referral) / 100, 'slearn')
  push('churches', (pu * PREMIUM_PCT.churches) / 100, 'usdt')
  push('churches', (ps * PREMIUM_PCT.churches) / 100, 'slearn')
  // Vault = remainder of the processed amount
  push('course_vault', pu - (pu * (pdJPct + PREMIUM_PCT.reward + PREMIUM_PCT.missional + PREMIUM_PCT.ubi + PREMIUM_PCT.referral + PREMIUM_PCT.churches)) / 100, 'usdt')
  push('course_vault', ps - (ps * (pdJPct + PREMIUM_PCT.reward + PREMIUM_PCT.missional + PREMIUM_PCT.ubi + PREMIUM_PCT.referral + PREMIUM_PCT.churches)) / 100, 'slearn')
  return distribution
}

export async function premiumPurchase(deps: RewardsDeps, req: NextRequest) {
  const db = deps.db()

  try {
    const body = await req.json()
    const { walletAddress, token, courseId, usdtHash, slearnHash, referralAddress } = body

    if (!walletAddress || !token || !courseId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }
    if (!usdtHash && !slearnHash) {
      return NextResponse.json({ error: 'At least one payment transaction hash required' }, { status: 400 })
    }

    const courseIdNum = Number(courseId)
    const auth = await deps.authenticateUser(db, walletAddress, token)
    if (!auth) return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    const { usuario } = auth

    const replayError = await checkReplayAttack(db, [usdtHash, slearnHash])
    if (replayError) return replayError

    // A course is paid once: refuse a second payment (the enrollment row is
    // unique per usuario+course). Checked BEFORE any on-chain action.
    const alreadyOwned = await db
      .selectFrom('premium_course_usuario')
      .select('id')
      .where('usuario_id', '=', usuario.id)
      .where('course_id', '=', courseIdNum)
      .executeTakeFirst()
    if (alreadyOwned) {
      return NextResponse.json({ error: 'Course already purchased' }, { status: 400 })
    }

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
        const { amount } = await verifyTransfer(deps.backend.fetchTxWithReceipt, publicClient, usdtHash, 'usdt', walletAddress, backendWallet, usdtAddress, deps.backend.MAX_TX_AGE)
        onChainUsdtAmount = amount
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 })
      }
    }
    if (slearnHash && slearnAddress) {
      try {
        const { amount } = await verifyTransfer(deps.backend.fetchTxWithReceipt, publicClient, slearnHash, 'slearn', walletAddress, backendWallet, slearnAddress, deps.backend.MAX_TX_AGE)
        onChainSlearnAmount = amount
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 })
      }
    }

    // Read current SLEARN rate
    let rate = 22
    try {
      const r = (await publicClient.readContract({
        address: slearnAddress, abi: SLEARNAbi as any, functionName: 'usdtToSlearnRate',
      })) as bigint
      rate = Number(r)
    } catch {}

    const usdtValue = Number(formatUnits(onChainUsdtAmount, usdtDecimals))
    const slearnValue = Number(formatUnits(onChainSlearnAmount, deps.backend.SLEARN_DECIMALS))
    const totalValueUSDT = usdtValue + slearnValue / (rate * (1 - SLEARN_DISCOUNT))

    const userCountry = await db.selectFrom('usuario').select('pais_id').where('id', '=', usuario.id).executeTakeFirst()
    let expectedPriceUSDT = 2
    if (userCountry?.pais_id) {
      const hdiRow = await db.selectFrom('m_hdi').select('hdi').where('pais_id', '=', userCountry.pais_id).orderBy('year', 'desc').executeTakeFirst()
      if (hdiRow) expectedPriceUSDT = calculatePremiumPriceUsdt(Number(hdiRow.hdi))
    }

    // Eligibility gate for every paid course: the price depends on the
    // country, so the verifier-confirmed worship city is required; GD adds
    // the pilot gates (Christian, pilot country, non-Zionist).
    if (totalValueUSDT < expectedPriceUSDT - 0.01) {
      return NextResponse.json({ error: `Insufficient payment: ${totalValueUSDT} < ${expectedPriceUSDT} USDT` }, { status: 400 })
    }

    const eligibility = await deps.canPurchasePremiumCourse(db, usuario.id, courseIdNum)
    if (!eligibility.access) {
      return NextResponse.json({ error: eligibility.reason || 'not_eligible' }, { status: 403 })
    }

    const walletClient = deps.backend.getWalletClient()
    const chain = deps.backend.getChain()

    let processUsdtAmount = onChainUsdtAmount
    let processSlearnAmount = onChainSlearnAmount
    // Hook §5.4: resuelve si el curso es GD y el split (10%) al cluster fund.
    const gdCtx: any = {
      db,
      usuarioId: usuario.id,
      courseId: courseIdNum,
      usdtAmount: onChainUsdtAmount,
      slearnAmount: onChainSlearnAmount,
    }
    await deps.routeReward(gdCtx)
    const isGd = !!gdCtx.destino
    const pdJPct = isGd ? 40 : PREMIUM_PCT.pdJ

    if (isGd) {
      const clusterUSDT = gdCtx.gdUsdtAmount ?? 0n
      const clusterSlearn = gdCtx.gdSlearnAmount ?? 0n
      if (clusterUSDT > 0n || clusterSlearn > 0n) {
        const destino = gdCtx.destino
        const replayTx = ((usdtHash || slearnHash) as string) as Address
        await deps.routeToClusterFunds(publicClient, walletClient, walletClient.account, replayTx, destino, clusterUSDT, clusterSlearn, usdtAddress, slearnAddress)
        processUsdtAmount = onChainUsdtAmount - clusterUSDT
        processSlearnAmount = onChainSlearnAmount - clusterSlearn
      }
    }

    // Ensure allowances
    let nonce = await publicClient.getTransactionCount({ address: walletClient.account.address, blockTag: 'pending' })
    const maxUint256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935n

    if (processUsdtAmount > 0n) {
      const usdtAllowance = await publicClient.readContract({
        address: usdtAddress, abi: [
          { name: 'allowance', type: 'function', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
        ], functionName: 'allowance', args: [walletClient.account.address, slearnAddress],
      })
      if ((usdtAllowance as bigint) < processUsdtAmount) {
        await deps.backend.sendTxAndWait(walletClient, publicClient, {
          address: usdtAddress, abi: [
            { name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
          ], functionName: 'approve', args: [slearnAddress, maxUint256], chain, nonce: nonce++,
        })
      }
    }

    if (processSlearnAmount > 0n) {
      const slearnAllowance = await publicClient.readContract({
        address: slearnAddress, abi: [
          { name: 'allowance', type: 'function', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
        ], functionName: 'allowance', args: [walletClient.account.address, slearnAddress],
      })
      if ((slearnAllowance as bigint) < processSlearnAmount) {
        await deps.backend.sendTxAndWait(walletClient, publicClient, {
          address: slearnAddress, abi: [
            { name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
          ], functionName: 'approve', args: [slearnAddress, maxUint256], chain, nonce: nonce++,
        })
      }
    }

    const processPaymentHash = await deps.backend.sendTxAndWait(walletClient, publicClient, {
      address: slearnAddress, abi: SLEARNAbi as any, functionName: 'processPayment',
      args: [walletAddress as Address, processUsdtAmount, processSlearnAmount, BigInt(courseIdNum), BigInt(pdJPct), BigInt(PREMIUM_PCT.reward), BigInt(PREMIUM_PCT.missional), BigInt(PREMIUM_PCT.ubi), BigInt(PREMIUM_PCT.referral), BigInt(PREMIUM_PCT.churches)],
      chain, nonce,
    })

    const usdtPaid = Number(formatUnits(onChainUsdtAmount, usdtDecimals))
    const slearnPaid = Math.round(Number(formatUnits(onChainSlearnAmount, deps.backend.SLEARN_DECIMALS)) * 100)

    // Clean distribution computed from the percentages actually passed to
    // SLEARN.processPayment (REQ/128) — what the success dialog should show.
    const distribution = computePremiumDistribution(usdtPaid, Number(formatUnits(onChainSlearnAmount, deps.backend.SLEARN_DECIMALS)), courseIdNum, isGd, deps.backend.SLEARN_RATE)
    const breakdownText = distribution
      .map(d => `${d.destination}: ${d.amount.toFixed(2)} ${d.crypto.toUpperCase()}`)
      .join('\n')
    const slearnReward = distribution.find(d => d.destination === 'cashback')?.amount || 0

    // Record: one row per crypto the user sent, with the distribution breakdown.
    if (onChainUsdtAmount > 0n && usdtHash) {
      await db.insertInto('transaction').values({
        usuario_id: usuario.id, date: new Date(), type: 'pay-course', crypto: 'usdt',
        amount: usdtPaid, balance_impact: -usdtPaid, hash: usdtHash, wallet: walletAddress,
        categoria: 'payment', subcategoria: 'course_purchase',
        descripcion: `paid: ${usdtPaid.toFixed(2)} USDT\n${breakdownText}`,
        metadata: { courseId: courseIdNum, processPaymentHash, referralAddress, distribution },
      }).execute()
    }
    if (onChainSlearnAmount > 0n && slearnHash) {
      const slearnPaidAmt = Number(formatUnits(onChainSlearnAmount, deps.backend.SLEARN_DECIMALS))
      await db.insertInto('transaction').values({
        usuario_id: usuario.id, date: new Date(), type: 'pay-course', crypto: 'slearn',
        amount: slearnPaidAmt, balance_impact: -slearnPaidAmt, hash: slearnHash, wallet: walletAddress,
        categoria: 'payment', subcategoria: 'course_purchase',
        descripcion: `paid: ${slearnPaidAmt.toFixed(2)} SLEARN\n${breakdownText}`,
        metadata: { courseId: courseIdNum, processPaymentHash, referralAddress, distribution },
      }).execute()
    }

    // Record the reward/cashback the buyer receives (minted on-chain by
    // processPayment) so the transaction history shows the full flow.
    if (slearnReward > 0) {
      await db.insertInto('transaction').values({
        usuario_id: usuario.id, date: new Date(), type: 'donation_reward', crypto: 'slearn',
        amount: slearnReward, balance_impact: slearnReward, hash: null, wallet: walletAddress,
        categoria: 'cashback', subcategoria: 'course_purchase',
        descripcion: `course reward: ${slearnReward.toFixed(2)} SLEARN (10% of the processed payment)`,
        metadata: { courseId: courseIdNum, processPaymentHash, distribution },
      }).execute()
    }

    // Idempotent: the user may already own the course (UNIQUE(usuario_id, course_id)).
    // The payment is still recorded in `transaction`; the enrollment is kept.
    await db.insertInto('premium_course_usuario').values({
      usuario_id: usuario.id, course_id: courseIdNum,
      usdt_amount_paid: usdtPaid, slearn_amount_paid: slearnPaid,
      transaction_hash: processPaymentHash,
    }).onConflict((oc) => oc.columns(['usuario_id', 'course_id']).doNothing()).execute()

    return NextResponse.json({
      message: 'Course purchased',
      processPaymentHash,
      access: true,
      distribution,
    }, { status: 200 })
  } catch (error) {
    // Log only the message (not the error object) to avoid the dev-mode
    // SWC code-frame renderer crashing (OpenBSD WASM build).
    console.error('Exception in premium purchase:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: String((error as any)?.message || error) }, { status: 500 })
  }
}