'use client'

import { ClaimSDK, useIdentitySDK } from '@goodsdks/citizen-sdk'
import { useSession } from 'next-auth/react'
import { usePublicClient, useWalletClient } from 'wagmi'
import { useAccount } from 'wagmi'

import { Button } from '@/components/ui/button'

export function GoodDollarClaimButton() {
  const { address } = useAccount()
  const { data: session } = useSession()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const identitySDK =
    process.env.NEXT_PUBLIC_AUTH_URL == 'https://learn.tg'
      ? useIdentitySDK('production')
      : null

  const claimUBI = async () => {
    if (
      !session ||
      !address ||
      session.address != address ||
      !publicClient ||
      !walletClient ||
      !identitySDK
    ) {
      alert('Please connect your wallet and sign in to claim.')
      return
    }

    const claimSDK = new ClaimSDK({
      account: session.address,
      publicClient,
      walletClient,
      identitySDK,
      env: 'production',
    })

    try {
      await claimSDK.claim()
      console.log('Claim successful')
      alert('Claim successful')
    } catch (error) {
      console.error('Claim failed:', error)
      alert('Claim failed: ' + JSON.stringify(error))
    }
  }

  return (
    <div className="flex items-center justify-center my-4">
      <Button onClick={claimUBI} size="lg">
        Sign up with GoodDollar or Claim UBI
      </Button>
    </div>
  )
}

