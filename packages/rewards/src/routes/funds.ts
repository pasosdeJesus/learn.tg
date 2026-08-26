import { NextResponse } from 'next/server'
import { createPublicClient, formatUnits, http, type Address } from 'viem'
import { celo, celoSepolia } from 'viem/chains'
import SLEARNAbi from '../abis/SLEARN.json'
import Erc20Abi from '../abis/IERC20.json'
import { getSlearnAddress } from '../lib/deployments'
import { IS_PRODUCTION } from '../lib/config'

const slearnAbi = [
  { name: 'name', type: 'function', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'symbol', type: 'function', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'decimals', type: 'function', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'totalSupply', type: 'function', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

function publicClient() {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://forno.celo.org'
  const chain = IS_PRODUCTION ? celo : celoSepolia
  return createPublicClient({ chain, transport: http(rpcUrl) })
}

/** GET /api/slearn/metadata — metadata del token SLEARN. */
export async function slearnMetadata(): Promise<Response> {
  try {
    const pc = publicClient()
    const addr = await getSlearnAddress()

    const [name, symbol, decimals, totalSupply] = await Promise.all([
      pc.readContract({ abi: slearnAbi, address: addr, functionName: 'name' }),
      pc.readContract({ abi: slearnAbi, address: addr, functionName: 'symbol' }),
      pc.readContract({ abi: slearnAbi, address: addr, functionName: 'decimals' }),
      pc.readContract({ abi: slearnAbi, address: addr, functionName: 'totalSupply' }),
    ])

    const isProduction = IS_PRODUCTION
    const baseUrl = isProduction ? 'https://learn.tg' : 'https://learn.tg:9001'

    return NextResponse.json({
      name,
      symbol,
      decimals,
      totalSupply: Number(formatUnits(totalSupply as bigint, decimals as number)),
      description: 'Utility token for community-powered learning on learn.tg. Earn by completing courses, donating, or using the pdJ ecosystem.',
      image: `${baseUrl}/img/slearn-icon.svg`,
    })
  } catch (error) {
    console.error('Error in SLEARN metadata API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** GET /api/churches/fund — saldos del fondo de iglesias (SLEARN + USDT). */
export async function churchesFund(): Promise<Response> {
  try {
    const slearnAddress = await getSlearnAddress()
    const pc = publicClient()

    const fund = (await pc.readContract({
      address: slearnAddress,
      abi: SLEARNAbi as any,
      functionName: 'churchesWallet',
    })) as Address

    const usdtAddress = (await pc.readContract({
      address: slearnAddress,
      abi: SLEARNAbi as any,
      functionName: 'usdt',
    })) as Address

    const slearnRaw = (await pc.readContract({
      address: slearnAddress,
      abi: SLEARNAbi as any,
      functionName: 'balanceOf',
      args: [fund],
    })) as bigint

    const usdtRaw = (await pc.readContract({
      address: usdtAddress,
      abi: Erc20Abi as any,
      functionName: 'balanceOf',
      args: [fund],
    })) as bigint

    return NextResponse.json({
      address: fund,
      slearnAddress,
      slearnBalance: formatUnits(slearnRaw, 2),
      usdtBalance: formatUnits(usdtRaw, 6),
    })
  } catch (error) {
    console.error('Error reading churches fund:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** GET /api/referrals/fund — saldo del fondo de referidos (SLEARN + USDT). */
export async function referralsFund(): Promise<Response> {
  try {
    const slearnAddress = await getSlearnAddress()
    const pc = publicClient()

    const wallet = (await pc.readContract({
      address: slearnAddress,
      abi: SLEARNAbi as any,
      functionName: 'referralWallet',
    })) as Address

    const usdtAddress = (await pc.readContract({
      address: slearnAddress,
      abi: SLEARNAbi as any,
      functionName: 'usdt',
    })) as Address

    const slearnRaw = (await pc.readContract({
      address: slearnAddress,
      abi: SLEARNAbi as any,
      functionName: 'balanceOf',
      args: [wallet],
    })) as bigint

    const usdtRaw = (await pc.readContract({
      address: usdtAddress,
      abi: Erc20Abi as any,
      functionName: 'balanceOf',
      args: [wallet],
    })) as bigint

    return NextResponse.json({
      address: wallet,
      slearnBalance: formatUnits(slearnRaw, 2),
      usdtBalance: formatUnits(usdtRaw, 6),
    })
  } catch (error) {
    console.error('Error reading referral wallet:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
