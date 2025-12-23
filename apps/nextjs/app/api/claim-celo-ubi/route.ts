'use server'

import { getServerSession } from 'next-auth/next'
import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'

import { newKyselyPostgresql } from '@/.config/kysely.config.ts'
import { authOptions } from '@/app/api/auth/auth-options'

// ABI del contrato CeloUbi
const contractAbi = [
    "function claim(address recipient)",
    "function getBalance() view returns (uint256)",
    "function lastClaimed(address recipient) view returns (uint256)"
];

/**
 * @dev Maneja la solicitud de reclamo de UBI.
 * - Autentica al usuario a través de la sesión.
 * - Verifica su `profilescore` en la base de datos usando Kysely.
 * - Comprueba el saldo del contrato y el período de enfriamiento.
 * - Llama a la función `claim` en el contrato CeloUbi.
 */
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
        return NextResponse.json({ message: 'You must be logged in to claim.' }, { status: 401 });
    }

    try {
        const db = newKyselyPostgresql();
        const userQuery = db
            .selectFrom('usuario')
            .where('email', '=', session.user.email)
            .selectAll();
        const user = await userQuery.executeTakeFirst();

        if (!user) {
            return NextResponse.json({ message: 'User not found.' }, { status: 404 });
        }
        
        const billeteraUsuario = await db.selectFrom('billetera_usuario').where('usuario_id', '=', user.id).selectAll().executeTakeFirst();

        if ((user.profilescore || 0) < 50) {
            return NextResponse.json({ message: 'Your profile score is not high enough to claim.' }, { status: 403 });
        }

        if (!billeteraUsuario || !billeteraUsuario.billetera) {
            return NextResponse.json({ message: 'User does not have a wallet address.' }, { status: 400 });
        }
        const userWallet = billeteraUsuario.billetera;

        const provider = new ethers.JsonRpcProvider(process.env.CELO_RPC_URL);
        const contractAddress = process.env.CELO_UBI_CONTRACT_ADDRESS as string;
        const privateKey = process.env.BACKEND_WALLET_PRIVATE_KEY as string;

        if (!contractAddress || !privateKey) {
            console.error("Server configuration error: Missing contract address or backend private key.");
            return NextResponse.json({ message: 'Server configuration error.' }, { status: 500 });
        }

        const wallet = new ethers.Wallet(privateKey, provider);
        const contract = new ethers.Contract(contractAddress, contractAbi, wallet);

        const balance = await contract.getBalance();
        const rewardAmount = ethers.parseEther("1");

        if (balance < rewardAmount) {
            return NextResponse.json({ 
                message: 'Not enough funds in the contract. Please try again at the beginning of next month.' 
            }, { status: 400 });
        }
        
        const lastClaimedTimestamp = await contract.lastClaimed(userWallet);
        const twentyFourHours = 24 * 60 * 60;
        if (Math.floor(Date.now() / 1000) < Number(lastClaimedTimestamp) + twentyFourHours) {
             return NextResponse.json({ message: 'You can only claim once every 24 hours.' }, { status: 429 });
        }

        const tx = await contract.claim(userWallet);
        await tx.wait();

        return NextResponse.json({ message: 'Claim successful!', transactionHash: tx.hash }, { status: 200 });

    } catch (error: any) {
        console.error("Error processing claim:", error);
        if (error.code === 'CALL_EXCEPTION') {
            return NextResponse.json({ message: 'Claim failed. Please check contract conditions or try again later.' }, { status: 400 });
        }
        return NextResponse.json({ message: 'An error occurred while processing your claim.' }, { status: 500 });
    }
}
