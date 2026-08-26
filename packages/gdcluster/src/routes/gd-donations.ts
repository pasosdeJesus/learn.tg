import { NextRequest, NextResponse } from 'next/server'
import { type Address } from 'viem'
import { PILOT_COUNTRIES } from '../lib/gd-utils'
import { getClusterFundsAddress } from '../lib/gd-cluster-routing'
import ClusterFundsV2Abi from '../abis/ClusterFundsV2.json'
import { erc20Abi } from '@learn-tg/rewards/src/lib/donate-utils'
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
