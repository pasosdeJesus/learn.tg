import { NextRequest, NextResponse } from 'next/server'
import { type Address } from 'viem'
import { PILOT_COUNTRIES } from '../lib/gd-utils'
import { getClusterFundsAddress } from '../lib/gd-cluster-routing'
import ClusterFundsV2Abi from '../abis/ClusterFundsV2.json'
import SLEARNAbi from '../abis/SLEARN.json'
import { erc20Abi } from '@learn-tg/rewards/lib/donate-utils'
import { verifyTransfer } from '@learn-tg/rewards/lib/verify-transfer'
import {
  getCampaignConfig,
  getCampaignDonationToken,
  getCampaignDonationTokenKeys,
  campaignDonorSplit,
  splitRawAmount,
  getPdJTreasuryAddress,
} from '../lib/donation-target'
import { getTokenUsdPrice, round2 } from '../lib/token-prices'
import type { GdclusterDeps } from '../index'

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

async function extractAmountsFromReceipt(deps: GdclusterDeps, txHash: string, backendWallet: string) {
  // Poll across several RPCs: forno can lag indexing freshly-mined receipts
  // while mirrors (ankr/drpc/publicnode) return them immediately.
  const { receipt } = await deps.backend.fetchTxWithReceipt(txHash as `0x${string}`)
  if (!receipt || receipt.status !== 'success') {
    throw new Error('Transaction not found or failed')
  }

  const usdtAddr = (process.env.NEXT_PUBLIC_USDT_ADDRESS || '').toLowerCase()
  const slearnAddr = (process.env.NEXT_PUBLIC_SLEARN_ADDRESS || '').toLowerCase()

  let usdtAmount = 0n
  let slearnAmount = 0n

  for (const log of receipt.logs) {
    if (log.topics[0] !== TRANSFER_TOPIC) continue
    const logAddr = log.address.toLowerCase()
    const to = `0x${log.topics[2]!.slice(26)}`
    if (to.toLowerCase() !== backendWallet) continue
    const value = BigInt(log.data)
    if (logAddr === usdtAddr) usdtAmount += value
    else if (logAddr === slearnAddr) slearnAmount += value
  }

  if (usdtAmount === 0n && slearnAmount === 0n) {
    throw new Error('No USDT or SLEARN transfer to backend wallet found')
  }

  return { usdtAmount, slearnAmount }
}

export async function verifyDonation(deps: GdclusterDeps, req: NextRequest) {
  try {
    const body = await req.json()
    const { walletAddress, token, clusterWallet, countryCode, usdtHash, slearnHash } = body

    if (!walletAddress || !token) {
      return NextResponse.json({ error: 'Missing auth fields' }, { status: 400 })
    }
    if (!clusterWallet && !countryCode) {
      return NextResponse.json({ error: 'clusterWallet or countryCode required' }, { status: 400 })
    }

    const db = deps.db()
    const auth = await deps.authenticateUser(db, walletAddress, token)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (countryCode) {
      const country = await db.selectFrom('msip_pais').select('id').where('alfa2', '=', countryCode).executeTakeFirst()
      if (!country || !PILOT_COUNTRIES.includes(country.id)) {
        return NextResponse.json({ error: 'Donations are only available in Colombia and Sierra Leona during the pilot phase' }, { status: 403 })
      }
    }

    const pub = deps.backend.getPublicClient()
    const backendWallet = deps.backend.getBackendWalletLower()

    const txHash = (usdtHash || slearnHash) as string
    if (!txHash) {
      return NextResponse.json({ error: 'No transaction hash provided' }, { status: 400 })
    }

    const { usdtAmount, slearnAmount } = await extractAmountsFromReceipt(deps, txHash, backendWallet)

    const cfAddress = await getClusterFundsAddress()
    const wallet = deps.backend.getWalletClient()
    const chain = (wallet as any).chain || pub.chain

    let nonce = await pub.getTransactionCount({
      address: (await wallet.getAddresses())[0],
      blockTag: 'pending',
    })

    const sendWithNonce = async (args: any) => {
      return deps.backend.sendTxAndWait(wallet, pub, { ...args, chain, nonce: nonce++ })
    }

    const usdtAddr = (process.env.NEXT_PUBLIC_USDT_ADDRESS || '') as Address
    const slearnAddr = (process.env.NEXT_PUBLIC_SLEARN_ADDRESS || '') as Address

    if (usdtAmount > 0n) {
      await sendWithNonce({
        address: usdtAddr, abi: erc20Abi, functionName: 'transfer',
        args: [cfAddress, usdtAmount],
      })
    }
    if (slearnAmount > 0n && slearnAddr) {
      await sendWithNonce({
        address: slearnAddr, abi: erc20Abi, functionName: 'transfer',
        args: [cfAddress, slearnAmount],
      })
    }

    if (clusterWallet) {
      await sendWithNonce({
        address: cfAddress, abi: ClusterFundsV2Abi, functionName: 'processDonation',
        args: [txHash, clusterWallet as Address, walletAddress as Address, usdtAmount, slearnAmount],
      })
    } else if (countryCode) {
      await sendWithNonce({
        address: cfAddress, abi: ClusterFundsV2Abi, functionName: 'processCountryDonation',
        args: [txHash, countryCode, walletAddress as Address, usdtAmount, slearnAmount],
      })
    }

    // Record: one row per crypto, plus reward row. Distribution in metadata.
    const usdtValue = Number(usdtAmount) / 1e6
    const slearnValue = Number(slearnAmount) / 1e2
    const totalValue = usdtValue + (slearnValue / deps.backend.SLEARN_RATE)
    const slearnCashback = Math.round(totalValue * 0.10 * deps.backend.SLEARN_RATE * 100) / 100

    const dest = countryCode ? `country:${countryCode}` : `cluster:${clusterWallet}`

    // Distribution: 80% fund, 10% pdJ, 10% cashback (SLEARN)
    const distribution = []
    if (usdtValue > 0) distribution.push({ destination: 'fund', amount: usdtValue * 0.8, crypto: 'usdt' })
    if (slearnValue > 0) distribution.push({ destination: 'fund', amount: slearnValue * 0.8, crypto: 'slearn' })
    if (usdtValue > 0) distribution.push({ destination: 'pdJ', amount: usdtValue * 0.1, crypto: 'usdt' })
    if (slearnValue > 0) distribution.push({ destination: 'pdJ', amount: slearnValue * 0.1, crypto: 'slearn' })
    if (slearnCashback > 0) distribution.push({ destination: 'cashback', amount: slearnCashback, crypto: 'slearn' })

    const breakdownText = distribution
      .map(d => `${d.destination}: ${d.amount.toFixed(2)} ${d.crypto.toUpperCase()}`)
      .join('\n')

    if (usdtAmount > 0n) {
      await db.insertInto('transaction').values({
        usuario_id: auth.usuario.id, wallet: walletAddress, crypto: 'usdt',
        type: 'donation', amount: usdtValue, balance_impact: -usdtValue,
        date: new Date(), hash: usdtHash as string, categoria: 'donation',
        subcategoria: countryCode ? 'country' : 'cluster',
        descripcion: `donated: ${usdtValue.toFixed(2)} USDT\n${breakdownText}`,
        metadata: { destination: dest, clusterWallet, countryCode, distribution },
        created_at: new Date(), updated_at: new Date(),
      } as any).execute()
    }
    if (slearnAmount > 0n) {
      await db.insertInto('transaction').values({
        usuario_id: auth.usuario.id, wallet: walletAddress, crypto: 'slearn',
        type: 'donation', amount: slearnValue, balance_impact: -slearnValue,
        date: new Date(), hash: slearnHash as string, categoria: 'donation',
        subcategoria: countryCode ? 'country' : 'cluster',
        descripcion: `donated: ${slearnValue.toFixed(2)} SLEARN\n${breakdownText}`,
        metadata: { destination: dest, clusterWallet, countryCode, distribution },
        created_at: new Date(), updated_at: new Date(),
      } as any).execute()
    }
    if (slearnCashback > 0) {
      await db.insertInto('transaction').values({
        usuario_id: auth.usuario.id, wallet: walletAddress, crypto: 'slearn',
        type: 'donation_reward', amount: slearnCashback, balance_impact: slearnCashback,
        date: new Date(), hash: null, categoria: 'cashback',
        subcategoria: countryCode ? 'country' : 'cluster',
        descripcion: `${dest} cashback: ${slearnCashback.toFixed(2)} SLEARN (10%)`,
        metadata: { destination: 'cashback', clusterWallet, countryCode },
        created_at: new Date(), updated_at: new Date(),
      } as any).execute()
    }

    return NextResponse.json({
      success: true, txHash,
      usdtAmount: String(usdtAmount), slearnAmount: String(slearnAmount),
      increment: slearnCashback,
      distribution,
    })
  } catch (error) {
    console.error('Error verifying donation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function donationHistory(deps: GdclusterDeps, req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('walletAddress') || ''
  const token = req.nextUrl.searchParams.get('token') || ''

  try {
    const db = deps.db()
    const auth = await deps.authenticateUser(db, wallet, token)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const donations = await db
      .selectFrom('transaction')
      .select(['id', 'crypto', 'amount', 'hash', 'date', 'subcategoria', 'metadata'])
      .where('usuario_id', '=', auth.usuario.id)
      .where('type', '=', 'donation' as any)
      .orderBy('date', 'desc')
      .limit(50)
      .execute()

    return NextResponse.json({ donations })
  } catch (error) {
    console.error('Error fetching donation history:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Verifica una donación a una campaña (REQ/223 §4.1) — Celo mainnet only.
 *
 * Flujo: el donante envió el token a la billetera del backend (vía DonateModal
 * / useContractPayment). Aquí se verifica el transfer on-chain y se:
 *  1. Reenvía AUTOMÁTICA e INMEDIATAMENTE la parte de la campaña
 *     ((100 − pdjSharePct)%) a la billetera destino de la campaña.
 *  2. Reenvía la parte pdJ (pdjSharePct%) a NEXT_PUBLIC_PDJ_TREASURY_ADDRESS
 *     cuando el donante la eligió.
 *  3. Si `receiveCashback` → mintea el cashback SLEARN (10% del valor) al
 *     donante (requiere MINTER_ROLE en la billetera del backend).
 *  4. Registra en `transaction` (una fila por pago + una fila `donation_reward`
 *     cuando hay cashback) con el split denormalizado en metadata.
 *
 * La restricción `(crypto, hash)` UNIQUE impide duplicar filas (replay).
 *
 * Consciente de red (REQ/223 + testnet): en mainnet (42220) se aceptan los
 * tokens de `cfg.donationTokens` (USDT/USDC/XAUt0; USDC/XAUt0 registran filas
 * `transaction.crypto` = 'usdc'/'xaut0', migración 20260903120000); en Celo
 * Sepolia (11142220) solo los de `cfg.testnet` (hoy USDT Mock). El valor USD
 * usa precio de mercado (pegados = 1; XAUt0 = CoinGecko). CELO nativo y G$
 * quedan pendientes (verify ERC-20 actual).
 */
export async function verifyCampaignDonation(deps: GdclusterDeps, req: NextRequest, params?: Record<string, string>) {
  try {
    const slug = params?.slug || ''
    const cfg = getCampaignConfig(slug)
    if (!cfg) {
      return NextResponse.json({ error: `Unknown campaign: ${slug}` }, { status: 404 })
    }

    const body = await req.json()
    const { walletAddress, token, payToken, usdtHash, receiveCashback, pdjSharePct } = body

    if (!walletAddress || !token) {
      return NextResponse.json({ error: 'Missing auth fields' }, { status: 400 })
    }
    if (!usdtHash) {
      return NextResponse.json({ error: 'No transaction hash provided' }, { status: 400 })
    }

    const optsPct = Number(pdjSharePct ?? 0)
    if (Number.isNaN(optsPct) || optsPct < 0 || optsPct > 100) {
      return NextResponse.json({ error: 'pdjSharePct must be between 0 and 100' }, { status: 400 })
    }
    const optsCashback = receiveCashback !== false

    const db = deps.db()
    const auth = await deps.authenticateUser(db, walletAddress, token)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Red activa: mainnet (42220) o Celo Sepolia (11142220)
    const pub = deps.backend.getPublicClient()
    const chainId = Number((pub as any).chain?.id ?? 42220)
    if (chainId !== 42220 && chainId !== 11142220) {
      return NextResponse.json({ error: `Unsupported network (chainId ${chainId}); campaign donations run on Celo mainnet or Celo Sepolia` }, { status: 400 })
    }
    const mainnet = chainId === 42220

    const payKey = payToken || 'usdt'
    const allowedKeys = getCampaignDonationTokenKeys(cfg, mainnet)
    if (!allowedKeys.includes(payKey)) {
      return NextResponse.json({
        error: `Donations in ${payKey} are not enabled for this campaign ${mainnet ? 'on Celo mainnet' : 'on Celo Sepolia'}. Allowed: ${allowedKeys.join(', ')}`,
      }, { status: 400 })
    }
    const payCfg = getCampaignDonationToken(cfg, payKey, mainnet)
    if (!payCfg) return NextResponse.json({ error: `Campaign has no ${payKey} token configured for this network` }, { status: 500 })
    const tokenAddr = payCfg.address as Address
    const tokenDecimals = payCfg.decimals

    const backendWallet = deps.backend.getBackendWalletLower()

    let tokenAmount: bigint
    try {
      const verified = await verifyTransfer(
        deps.backend.fetchTxWithReceipt, pub, usdtHash, payKey,
        walletAddress, backendWallet, tokenAddr, 24 * 60 * 60 * 1000,
      )
      tokenAmount = verified.amount
    } catch (e: any) {
      console.error('[CampaignDonation] verifyTransfer failed:', e?.shortMessage || e?.message || e)
      return NextResponse.json({
        error: `Transfer verification failed: ${e?.shortMessage || e?.message || String(e)}`,
      }, { status: 400 })
    }
    if (tokenAmount <= 0n) {
      return NextResponse.json({ error: 'Transfer amount must be greater than zero' }, { status: 400 })
    }

    // Precio USD del token donado (pegados → 1; XAUt0 → CoinGecko con caché)
    let price: number
    try {
      price = await getTokenUsdPrice({ key: payCfg.key, peggedUsd: payCfg.peggedUsd, coingeckoId: payCfg.coingeckoId })
    } catch (e: any) {
      console.error('[CampaignDonation] price fetch failed:', e?.message || e)
      return NextResponse.json({
        error: `USD price unavailable for ${payKey} (${e?.message || String(e)}) — try again later`,
      }, { status: 400 })
    }

    const tokenUnits = Number(tokenAmount) / 10 ** tokenDecimals
    const usdValue = tokenUnits * price
    const split = campaignDonorSplit(usdValue, { receiveCashback: optsCashback, pdjSharePct: optsPct }, deps.backend.SLEARN_RATE)
    const { campaignRaw, pdjRaw } = splitRawAmount(tokenAmount, split.pdjSharePct)
    const campaignUnits = round2(Number(campaignRaw) / 10 ** tokenDecimals)
    const pdjUnits = round2(Number(pdjRaw) / 10 ** tokenDecimals)

    const wallet = deps.backend.getWalletClient()
    const chain = (wallet as any).chain || pub.chain
    let nonce = await pub.getTransactionCount({
      address: (await wallet.getAddresses())[0],
      blockTag: 'pending',
    })
    const sendWithNonce = async (args: any) => {
      return deps.backend.sendTxAndWait(wallet, pub, { ...args, chain, nonce: nonce++ })
    }

    // Cashback SLEARN primero (si el backend no tiene MINTER_ROLE falla antes
    // de reenviar nada; el donante ve el error y nada queda a medias).
    let mintHash: string | undefined
    if (split.receiveCashback && split.cashbackSlearn > 0) {
      const slearnAddress = process.env.NEXT_PUBLIC_SLEARN_ADDRESS as Address | undefined
      if (!slearnAddress) {
        return NextResponse.json({ error: 'NEXT_PUBLIC_SLEARN_ADDRESS not configured (needed for the SLEARN cashback)' }, { status: 500 })
      }
      const slearnRaw = BigInt(Math.round(split.cashbackSlearn * 100))
      try {
        mintHash = await sendWithNonce({
          address: slearnAddress, abi: SLEARNAbi as any, functionName: 'mint',
          args: [walletAddress as Address, slearnRaw],
        })
      } catch (e: any) {
        console.error('[CampaignDonation] SLEARN cashback mint failed:', e?.shortMessage || e?.message)
        return NextResponse.json({
          error: 'SLEARN cashback unavailable: the backend wallet lacks MINTER_ROLE on the SLEARN contract',
        }, { status: 400 })
      }
    }

    // Reenvío automático e inmediato a la campaña (y a pdJ si aplica), con
    // reintento inline (2 intentos, 1.5s entre ellos). Si tras los intentos
    // un reenvío sigue fallando se registra igual la donación con el hash
    // pendiente (el balance lo muestra como "pendiente de reenvío") y se
    // loguea una alerta para el operador — el monto nunca se pierde de vista.
    const attemptWithRetry = async (label: string, args: any) => {
      let lastError: unknown
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          return { hash: await sendWithNonce(args) }
        } catch (e: unknown) {
          lastError = e
          console.error(`[CampaignDonation] ${label} attempt ${attempt + 1} failed:`, (e as any)?.shortMessage || (e as any)?.message || e)
          if (attempt === 0) await new Promise((r) => setTimeout(r, 1500))
        }
      }
      return { error: lastError }
    }

    let campaignHash: string | undefined
    let pdjHash: string | undefined
    if (campaignRaw > 0n) {
      const r = await attemptWithRetry('campaign forward', {
        address: tokenAddr, abi: erc20Abi, functionName: 'transfer',
        args: [cfg.wallet, campaignRaw],
      })
      campaignHash = r.hash
      if (r.error) console.error('[CampaignDonation] campaign forward PENDING (recorded without hash; funds remain in the backend wallet)')
    }
    if (pdjRaw > 0n) {
      const treasury = getPdJTreasuryAddress()
      if (!treasury) {
        return NextResponse.json({ error: 'NEXT_PUBLIC_PDJ_TREASURY_ADDRESS not configured (needed for the pdJ share)' }, { status: 500 })
      }
      const r = await attemptWithRetry('pdJ forward', {
        address: tokenAddr, abi: erc20Abi, functionName: 'transfer',
        args: [treasury as Address, pdjRaw],
      })
      pdjHash = r.hash
      if (r.error) console.error('[CampaignDonation] pdJ forward PENDING (recorded without hash; funds remain in the backend wallet)')
    }
    const forwardPending = !campaignHash || (pdjRaw > 0n && !pdjHash)

    const dest = `campaign:${slug}`
    const distribution = []
    if (campaignRaw > 0n) distribution.push({ destination: 'campaign', amount: campaignUnits, crypto: payKey })
    if (pdjRaw > 0n) distribution.push({ destination: 'pdJ', amount: pdjUnits, crypto: payKey })
    if (mintHash) distribution.push({ destination: 'cashback', amount: split.cashbackSlearn, crypto: 'slearn' })
    const breakdownText = distribution
      .map(d => `${d.destination}: ${d.amount.toFixed(2)} ${d.crypto.toUpperCase()}`)
      .join('\n')

    const metadata = {
      campaign: slug, network: mainnet ? 'celo' : 'celoSepolia', payToken: payKey,
      pdjSharePct: split.pdjSharePct,
      campaignAmountUSD: split.campaignUSD, pdjAmountUSD: split.pdjUSD,
      receiveCashback: split.receiveCashback,
      cashbackSlearn: split.cashbackSlearn > 0 ? split.cashbackSlearn : undefined,
      campaignWallet: cfg.wallet, destination: dest,
      campaignForwardHash: campaignHash, pdjForwardHash: pdjHash, mintHash,
      forwardPending,
      distribution,
    }

    await db.insertInto('transaction').values({
      usuario_id: auth.usuario.id, wallet: walletAddress, crypto: payKey,
      type: 'donation', amount: round2(tokenUnits), balance_impact: -round2(tokenUnits),
      date: new Date(), hash: usdtHash as string, categoria: 'donation',
      subcategoria: 'campaign',
      descripcion: `donated: ${round2(tokenUnits).toFixed(2)} ${payCfg.symbol}\n${breakdownText}`,
      metadata,
      created_at: new Date(), updated_at: new Date(),
    } as any).execute()

    if (mintHash) {
      await db.insertInto('transaction').values({
        usuario_id: auth.usuario.id, wallet: walletAddress, crypto: 'slearn',
        type: 'donation_reward', amount: split.cashbackSlearn, balance_impact: split.cashbackSlearn,
        date: new Date(), hash: mintHash, categoria: 'cashback',
        subcategoria: 'campaign',
        descripcion: `${dest} cashback: ${split.cashbackSlearn.toFixed(2)} SLEARN (10%)`,
        metadata: { campaign: slug, destination: 'cashback', campaignWallet: cfg.wallet, usdtHash },
        created_at: new Date(), updated_at: new Date(),
      } as any).execute()
    }

    return NextResponse.json({
      success: true, txHash: usdtHash,
      tokenAmount: String(tokenAmount),
      increment: split.cashbackSlearn,
      distribution,
      pendingForward: forwardPending,
      hashes: { campaignForwardHash: campaignHash, pdjForwardHash: pdjHash, mintHash },
    })
  } catch (error) {
    console.error('Error verifying campaign donation:', (error as any)?.shortMessage || (error as any)?.message || error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
