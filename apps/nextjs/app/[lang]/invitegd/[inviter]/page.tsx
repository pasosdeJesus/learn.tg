'use client'
/**
 * Page for new invited users
 *
 * Based on https://github.com/GoodDollar/GoodSDKs/blob/112301d76e81b5029052dee54a8206670e47944c/apps/engagement-app/src/components/InviteDemo.tsx
 */

import axios from 'axios'
// @ts-ignore
import { useEngagementRewards } from "@goodsdks/engagement-sdk"
// @ts-ignore
import { useIdentitySDK } from "@goodsdks/react-hooks"
import { CopyIcon, CheckIcon } from "lucide-react"
import { useSession, getCsrfToken } from 'next-auth/react'
import { use, useEffect, useState } from "react"
import { useAccount } from "wagmi"

import type { Address} from "viem"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

type PageProps = {
  params: Promise<{
    lang: string
    inviter: string
  }>
}

interface InviteReward {
  invitedWallet: string
  rewardAmount: string
}

const INVITE_STORAGE_KEY = "invite_inviter"

const formatAmount = (amount: bigint) => {
  return (Number(amount) / 1e18).toFixed(2)
}

export default function InviteGD({ params }:PageProps) {
  const { address } = useAccount()
  const { data: session } = useSession()

  const parameters = use(params)
  const { lang, inviter } = parameters

  const { sdk: identitySDK } = useIdentitySDK()

  const [inviteLink, setInviteLink] = useState<string>("")
  const [isCopied, setIsCopied] = useState(false)
  const [inviteRewards, setInviteRewards] = useState<InviteReward[]>([])
  const [rewardAmount, setRewardAmount] = useState<bigint>(0n)
  const [inviterShare, setInviterShare] = useState<number>(0)
  const [isClaimable, setIsClaimable] = useState(false)
  const [isWhitelisted, setIsWhitelisted] = useState<boolean>(false)
  const [checkingWhitelist, setCheckingWhitelist] = useState<boolean>(true)

  if (!process || !process.env || !process.env.NEXT_PUBLIC_ADDRESS) {
    alert("NEXT_PUBLIC_ADDRESS not defined")
    return
  }
  if (!process.env.NEXT_PUBLIC_REWARDS_CONTRACT) {
    alert("NEXT_PUBLIC_REWARDS_CONTRACT not defined")
    return
  }

  const appAddress = process.env.NEXT_PUBLIC_ADDRESS as Address
  const rewardsContractAddress = process.env.NEXT_PUBLIC_REWARDS_CONTRACT as Address

  const engagementRewards = useEngagementRewards(
    rewardsContractAddress
  )

  // Handle inviter storage and reward details
  useEffect(() => {
    if (!engagementRewards || !session || !session.address) return
    console.log("fetching reward and events")
    const fetchRewardDetails = async () => {
      try {
        // Get reward amount and distribution percentages
        const [amount, [, , , , , userInviterPercentage, userPercentage]] =
          await Promise.all([
            engagementRewards.getRewardAmount(),
            engagementRewards.getAppInfo(appAddress),
          ])

        console.log(userInviterPercentage, userPercentage)
        if (amount) {
          setRewardAmount(amount)
        }

        // Calculate share percentages
        const totalUserInviter = Number(userInviterPercentage) || 0
        const userPercent = Number(userPercentage) || 0
        setInviterShare(
          Math.floor((totalUserInviter * (100 - userPercent)) / 100),
        )

        // Check if rewards can be claimed
        const canClaim = await engagementRewards.canClaim(
          appAddress,
          session.address as `0x${string}`,
        )
        setIsClaimable(canClaim)

        // Get recent rewards
        const events = await engagementRewards.getAppRewardEvents(
          appAddress, {
            inviter: session.address as `0x${string}`,
          }
        )

        // Filter and map events where this wallet was the inviter
        const inviterEvents = events
          .filter(
            (event: any) =>
              (event.inviter?.toLowerCase() ?? '') === (session.address!.toLowerCase() ?? ''),
          )
          .map((event: any) => ({
            invitedWallet: event.user || "Unknown",
            rewardAmount: formatAmount(
              BigInt(event.inviterAmount || 0),
            ).toString(),
          }))

        setInviteRewards(inviterEvents)
      } catch (err) {
        console.error("Error fetching reward details:", err)
        alert("Failed to load reward details")
      }
    }

    fetchRewardDetails()
  }, [engagementRewards, session])

  // Handle invite link and inviter storage
  useEffect(() => {
    // Store inviter if in URL params
    if (inviter) {
      localStorage.setItem(INVITE_STORAGE_KEY, inviter)
    }

    // Update invite link when wallet is connected
    if (session && session.address) {
      const baseUrl = window.location.origin
      setInviteLink(`${baseUrl}/invite/${session.address}`)
    }
  }, [inviter, session])

  // Add whitelist check effect
  useEffect(() => {
    const checkWhitelistStatus = async () => {
      if (!identitySDK || !session || !session.address) {
        setCheckingWhitelist(false)
        return
      }

      try {
        const { isWhitelisted } =
          await identitySDK.getWhitelistedRoot(session.address as `0x${string}`)
        setIsWhitelisted(isWhitelisted)
      } catch (error) {
        console.error("Error checking whitelist status:", error)
      } finally {
        setCheckingWhitelist(false)
      }
    }

    checkWhitelistStatus()
  }, [identitySDK, session])

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      alert("Could not copy invite link. Please try again.")
    }
  }

  const claimReward = async () => {
    if (!engagementRewards || !session || !session.address ) {
      alert("Please connect your wallet first")
      return
    }

    try {
      const inviter =
        localStorage.getItem(INVITE_STORAGE_KEY) ||
        "0x0000000000000000000000000000000000000000"
      const validUntilBlock =
        (await engagementRewards.getCurrentBlockNumber()) + 600n

      // Get app signature from backend
      const appSignature = await fetch(
        "https://learn.tg/api/sign-refgd-claim",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            walletAddress: session.address,
            token: await getCsrfToken(),
            validUntilBlock: validUntilBlock.toString(),
            inviter,
          }),
        },
      )
        .then((res) => res.json())
        .then((data) => data.signature)

      // Get user signature
      const userSignature = await engagementRewards.signClaim(
        appAddress,
        inviter as `0x${string}`,
        validUntilBlock,
      )

      // Submit claim transaction
      await engagementRewards.nonContractAppClaim(
        appAddress,
        inviter as `0x${string}`,
        validUntilBlock,
        userSignature,
        appSignature,
        (hash: string) => {
          alert(`Succes. Hash: ${hash}`)
        },
      )
    } catch (err) {
      console.error("Error claiming reward:", err)
      alert(
        err instanceof Error
          ? err.message
          : "Could not claim reward. Please try again."
      )
    }
  }

  const handleVerification = async () => {
    if (!identitySDK) {
      alert("Identity SDK not initialized")
      return
    }

    try {
      // Generate FV link with current URL as callback
      const currentUrl = window.location.href
      const fvLink = await identitySDK.generateFVLink(false, currentUrl)
      window.location.href = fvLink
    } catch (err) {
      console.error("Error generating verification link:", err)
      alert("Failed to generate verification link")
    }
  }

  return (
    <div className="max-w-4xl w-full mx-auto space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          Invite &amp; Earn Rewards
        </h1>
        <p className="text-xl text-muted-foreground">
          Share your invite link and earn rewards for every new user who joins
        </p>
      </div>

      {!session || !session.address ? (
        <Card className="p-6 text-center">
          <h2 className="text-xl font-semibold mb-4">Connect Your Wallet</h2>
          <p className="text-muted-foreground mb-4">
            Connect your wallet to get your unique invite link and start earning
            rewards
          </p>
        </Card>
      ) : (
        <div className="space-y-8">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Verification Status</h2>
            {checkingWhitelist ? (
              <p>Checking verification status...</p>
            ) : isWhitelisted ? (
              <p className="text-green-600">Your account is verified! ✓</p>
            ) : (
              <div className="space-y-4">
                <p className="text-yellow-600">
                  Your account needs verification
                </p>
                <Button onClick={handleVerification}>Get Verified</Button>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Your Invite Link</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteLink}
                readOnly
                className="flex-grow p-2 rounded border bg-muted"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyInviteLink}
                className="shrink-0"
                disabled={!isWhitelisted}
              >
                {isCopied ? (
                  <CheckIcon className="h-4 w-4" />
                ) : (
                  <CopyIcon className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {isWhitelisted
                ? `Share this link to earn ${inviterShare}% of ${formatAmount(
                    rewardAmount,
                  )} G$ for each new user who joins!`
                : "Verify your account to start sharing and earning rewards"}
            </p>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Your Recent Rewards</h2>
            {inviteRewards.length > 0 ? (
              <div className="space-y-4">
                {inviteRewards.map((reward, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center p-4 rounded border"
                  >
                    <div>
                      <p className="font-medium">
                        Invited: {reward.invitedWallet}
                      </p>
                    </div>
                    <p className="font-medium">{reward.rewardAmount} G$</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground">
                {isWhitelisted
                  ? "No rewards yet. Share your invite link to start earning!"
                  : "Get verified to start earning rewards"}
              </p>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Claim Your Rewards</h2>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-muted-foreground">Available to claim:</p>
                <p className="text-2xl font-bold">
                  {formatAmount(rewardAmount)} G$
                </p>
              </div>
              <Button
                onClick={claimReward}
                disabled={!isClaimable || !isWhitelisted}
              >
                {!isWhitelisted ? "Verify to Claim" : "Claim Rewards"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
