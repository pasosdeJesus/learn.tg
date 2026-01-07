import { EngagementRewardsSDK } from '@goodsdks/engagement-sdk'
import { NextResponse } from 'next/server'
import { createWalletClient, http, parseEther, createPublicClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo } from 'viem/chains'

import type { DB, BilleteraUsuario } from '@/db/db.d.ts'
import { newKyselyPostgresql } from '@/.config/kysely.config'

export async function POST(req: Request) {

  try {
    console.log('POST /api/sign-refgd-claim/')

    const db = newKyselyPostgresql()

    // App configuration should be in environment variables
    const APP_PRIVATE_KEY = process.env.PRIVATE_KEY! as `0x${string}`
    const APP_ADDRESS = process.env.NEXT_PUBLIC_APP_ADDRESS! as `0x${string}`
    console.log( 'APP_ADDRESS', APP_ADDRESS)
    const REWARDS_CONTRACT = process.env.NEXT_PUBLIC_GDREWARDS_CONTRACT! as `0x${string}`
    console.log( 'REWARDS_CONTRACT', REWARDS_CONTRACT)

    // Initialize viem clients
    const account = privateKeyToAccount(APP_PRIVATE_KEY)
    const publicClient = createPublicClient({ 
      chain: celo,
      transport: http()
    })
    const walletClient = createWalletClient({ 
      chain: celo,
      transport: http(),
      account
    })

    // Initialize SDK
    const engagementRewards = new EngagementRewardsSDK(
      publicClient,
      walletClient,
      REWARDS_CONTRACT
    )

    // Extract data from the request
    const { walletAddress, token, validUntilBlock, inviter } = await req.json()
    console.log('walletAddress=', walletAddress)
    console.log('token=', token)
    console.log('validUntilBlock=', validUntilBlock)
    console.log('inviter=', inviter)

    // Verify all required fields are present
    if (!walletAddress || !token || !validUntilBlock || !inviter) {
      return NextResponse.json(
        {
          message:
            'walletAddress, token, validUntilBlock and inviter are required',
        },
        { status: 400 },
      )
    }


    // Authorization
    let billeteraUsuario = await db
      .selectFrom('billetera_usuario')
      .where('billetera', '=', walletAddress)
      .selectAll()
      .executeTakeFirst()
    if (!billeteraUsuario || billeteraUsuario.token != token) {
      return NextResponse.json(
        {
          message:
            'Unatororized',
        },
        { status: 400 },
      )
    }

    // Use SDK to prepare signature data
    const { domain, types, message } = await engagementRewards.prepareAppSignature(
      APP_ADDRESS,
      walletAddress as `0x${string}`,
      BigInt(validUntilBlock)
    )

    // Sign the prepared data
    const signature = await walletClient.signTypedData({
      domain,
      types, 
      primaryType: 'AppClaim',
      message
    })

    // Log signature request for auditing
    console.log(
      "[logSignaturRequest] ", APP_ADDRESS, 
      "walletAddress=", walletAddress, 
      "inviter=", inviter,
      "validUntilBlock=", validUntilBlock, 
      "signature=", signature
    )

    return NextResponse.json(
        {
          signature
        },
        { status: 200 },
      )
  } catch (error) {
    console.log('Error error=', error)
    return NextResponse.json(
      {
        status: 'error',
        result: false,
        reason: error instanceof Error ? error.message : 'Unknown error',
        error_code: 'UNKNOWN_ERROR',
      },
      { status: 500 },
    )
  }
}
