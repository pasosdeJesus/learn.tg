'use server'

import { getServerSession } from 'next-auth/next'
import { NextRequest, NextResponse } from 'next/server'
import {
    createPublicClient, 
    createWalletClient, 
    http, 
    BaseError,
    ContractFunctionRevertedError,
    Address
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celoAlfajores } from 'viem/chains';

import { newKyselyPostgresql } from '@/.config/kysely.config.ts'
import { authOptions } from '@/app/api/auth/auth-options'
import CeloUbi from '@celo-legacy/celo-ubi-contracts/artifacts/contracts/CeloUbi.sol/CeloUbi.json';

/**
 * @dev Handles the UBI claim request using Viem.
 * - Authenticates the user via session.
 * - Verifies their `profilescore` from the database using Kysely.
 * - Checks the cooldown period by reading from the contract.
 * - Calls the `claim` function on the CeloUbi contract, passing the `profileScore`.
 */
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
        return NextResponse.json({ message: 'You must be logged in to claim.' }, { status: 401 });
    }

    try {
        const db = newKyselyPostgresql();
        const user = await db
            .selectFrom('usuario')
            .where('email', '=', session.user.email)
            .selectAll()
            .executeTakeFirst();

        if (!user) {
            return NextResponse.json({ message: 'User not found.' }, { status: 404 });
        }
        
        const billeteraUsuario = await db
            .selectFrom('billetera_usuario')
            .where('usuario_id', '=', user.id)
            .selectAll()
            .executeTakeFirst();
        
        const profileScore = user.profilescore || 0;

        if (profileScore < 50) {
            return NextResponse.json({ message: 'Your profile score is not high enough to claim.' }, { status: 403 });
        }

        if (!billeteraUsuario || !billeteraUsuario.billetera) {
            return NextResponse.json({ message: 'User does not have a wallet address.' }, { status: 400 });
        }
        const userWallet = billeteraUsuario.billetera as Address;

        const contractAddress = process.env.CELO_UBI_CONTRACT_ADDRESS as Address;
        const privateKey = process.env.BACKEND_WALLET_PRIVATE_KEY as `0x${string}`;
        const celoRpcUrl = process.env.CELO_RPC_URL;

        if (!contractAddress || !privateKey || !celoRpcUrl) {
            console.error("Server configuration error: Missing contract address, backend private key, or RPC URL.");
            return NextResponse.json({ message: 'Server configuration error.' }, { status: 500 });
        }

        const publicClient = createPublicClient({
            chain: celoAlfajores,
            transport: http(celoRpcUrl),
        });

        const account = privateKeyToAccount(privateKey);

        const walletClient = createWalletClient({
            account,
            chain: celoAlfajores,
            transport: http(celoRpcUrl),
        });

        const lastClaimedTimestamp = await publicClient.readContract({
            address: contractAddress,
            abi: CeloUbi.abi,
            functionName: 'lastClaimed',
            args: [userWallet]
        });

        const twentyFourHours = 24 * 60 * 60;
        if (Math.floor(Date.now() / 1000) < Number(lastClaimedTimestamp) + twentyFourHours) {
             return NextResponse.json({ message: 'You can only claim once every 24 hours.' }, { status: 429 });
        }

        const hash = await walletClient.writeContract({
            address: contractAddress,
            abi: CeloUbi.abi,
            functionName: 'claim',
            args: [userWallet, BigInt(profileScore)],
            account,
        });
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        if (receipt.status === 'reverted') {
             return NextResponse.json({ message: 'Claim failed: Transaction was reverted.' }, { status: 400 });
        }

        return NextResponse.json({ message: 'Claim successful!', transactionHash: hash }, { status: 200 });

    } catch (error: any) {
        console.error("Error processing claim:", error);

        if (error instanceof BaseError) {
            const revertError = error.walk(err => err instanceof ContractFunctionRevertedError);
            if (revertError instanceof ContractFunctionRevertedError) {
                const errorName = revertError.data?.errorName ?? 'unknown error';
                return NextResponse.json({ message: `Claim failed: ${errorName}` }, { status: 400 });
            }
        }
        
        return NextResponse.json({ message: 'An error occurred while processing your claim.' }, { status: 500 });
    }
}
