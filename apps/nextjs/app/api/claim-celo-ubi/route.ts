import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { createPublicClient, createWalletClient, http, getContract, BaseError, ContractFunctionRevertedError } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo, celoSepolia } from 'viem/chains'
import { newKyselyPostgresql } from '@/.config/kysely.config'
import CeloUbiAbi from '@/abis/CeloUbi.json'
import type { Address } from 'viem'

const PROFILE_SCORE_THRESHOLD = 50;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const db = newKyselyPostgresql();
    const user = await db.selectFrom('usuario').where('email', '=', session.user.email).selectAll().executeTakeFirst();

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    if (user.profilescore < PROFILE_SCORE_THRESHOLD) {
      return NextResponse.json({ message: `Profile score must be at least ${PROFILE_SCORE_THRESHOLD}` }, { status: 403 });
    }

    const billetera = await db.selectFrom('billetera_usuario').where('usuario_id', '=', user.id).selectAll().executeTakeFirst();

    if (!billetera) {
      return NextResponse.json({ message: 'User has no wallet' }, { status: 400 });
    }

    const rpcUrl = process.env.CELO_RPC_URL;
    const contractAddress = process.env.CELO_UBI_CONTRACT_ADDRESS as Address;
    const privateKey = process.env.BACKEND_WALLET_PRIVATE_KEY as Address;

    if (!rpcUrl || !contractAddress || !privateKey) {
      console.error('Missing environment variables');
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }

    const chain = process.env.NEXT_PUBLIC_AUTH_URL === 'https://learn.tg' ? celo : celoSepolia;

    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    const lastClaim = await publicClient.readContract({
        address: contractAddress,
        abi: CeloUbiAbi.abi,
        functionName: 'lastClaim',
        args: [billetera.billetera as Address]
    });

    const cooldown = await publicClient.readContract({
        address: contractAddress,
        abi: CeloUbiAbi.abi,
        functionName: 'cooldown',
        args: []
    });

    if (Date.now() / 1000 - Number(lastClaim) < Number(cooldown)) {
        return NextResponse.json({ message: 'Cooldown period not over' }, { status: 429 });
    }

    const account = privateKeyToAccount(privateKey);

    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
    });

    try {
      const tx = await walletClient.writeContract({
        address: contractAddress,
        abi: CeloUbiAbi.abi,
        functionName: 'claim',
        args: [billetera.billetera as Address],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

      if (receipt.status !== 'success') {
        return NextResponse.json({ message: 'Transaction failed' }, { status: 500 });
      }

      return NextResponse.json({ message: 'Claim successful!', transactionHash: tx });
    } catch (err) {
        if (err instanceof BaseError) {
            const revertError = err.walk(err => err instanceof ContractFunctionRevertedError)
            if (revertError) {
                const errorName = revertError.data?.errorName ?? ''
                return NextResponse.json({ message: `Claim failed: ${errorName}` }, { status: 400 });
            }
        }
        return NextResponse.json({ message: 'Claim failed: Unknown error' }, { status: 400 });
    }

  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
