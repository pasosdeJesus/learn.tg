
import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, createWalletClient, http, BaseError, ContractFunctionRevertedError, decodeEventLog } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo, celoSepolia } from 'viem/chains'
import { newKyselyPostgresql } from '@/.config/kysely.config'
import CeloUbiAbi from '@/abis/CeloUbi.json'
import type { Address } from 'viem'

const PROFILE_SCORE_THRESHOLD = 50

export async function POST(request: NextRequest) {
  console.log("OJO POST claim-celo-ubi")
  try {
    const lang = request.headers.get('accept-language')?.startsWith('es') ? 'es' : 'en';
    const requestJson = await request.json()
    const walletAddress = requestJson['walletAddress'] ?? ''
    const token = requestJson['token'] ?? ''

    if (!walletAddress || walletAddress.trim() === '' || !token || token.trim() === '') {
      return NextResponse.json({ message: 'walletAddress and token are required' }, { status: 400 })
    }

    const db = newKyselyPostgresql()
    const billeteraUsuario = await db
      .selectFrom('billetera_usuario')
      .where('billetera', '=', walletAddress)
      .selectAll()
      .executeTakeFirst()

    if (!billeteraUsuario) {
      return NextResponse.json({ message: 'User not found for wallet' }, { status: 404 })
    }

    if (billeteraUsuario.token !== token) {
        return NextResponse.json({ message: "Token stored for user doesn't match given token." }, { status: 401 })
    }

    const user = await db.selectFrom('usuario').where('id', '=', billeteraUsuario.usuario_id).selectAll().executeTakeFirst()

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 })
    }

    if (user.profilescore === null || user.profilescore < PROFILE_SCORE_THRESHOLD) {
      return NextResponse.json({ message: `Profile score must be at least ${PROFILE_SCORE_THRESHOLD}` }, { status: 403 })
    }

    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL
    const contractAddress = process.env.NEXT_PUBLIC_CELOUBI_ADDRESS as Address
    const privateKey = process.env.PRIVATE_KEY as Address

    if (!rpcUrl || !contractAddress || !privateKey) {
      console.error(
        'Missing environment variables. rcpUrl=', rpcUrl,
        "contractAddress=", contractAddress,
        "privateKey.length=", privateKey.length
      )
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }

    const chain = process.env.NEXT_PUBLIC_AUTH_URL === 'https://learn.tg' ? celo : celoSepolia

    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    })

    const lastClaimed = await publicClient.readContract({
        address: contractAddress,
        abi: CeloUbiAbi,
        functionName: 'lastClaimed',
        args: [billeteraUsuario.billetera as Address]
    })

    const cooldown = await publicClient.readContract({
        address: contractAddress,
        abi: CeloUbiAbi,
        functionName: 'COOLDOWN_PERIOD',
        args: []
    })

    if (Date.now() / 1000 - Number(lastClaimed) < Number(cooldown)) {
        const remainingSeconds = Math.ceil(Number(cooldown) - (Date.now() / 1000 - Number(lastClaimed)));
        const hours = Math.floor(remainingSeconds / 3600);
        const minutes = Math.floor((remainingSeconds % 3600) / 60);

        let message = '';
        if (lang === 'es') {
            message = `Periodo de enfriamiento no ha terminado. Inténtalo de nuevo en aproximadamente ${hours} hora(s) y ${minutes} minuto(s).`;
        } else {
            message = `Cooldown period not over. Please try again in about ${hours} hour(s) and ${minutes} minute(s).`;
        }

        return NextResponse.json({ message: message }, { status: 429 })
    }

    const account = privateKeyToAccount(privateKey)

    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
    })

    try {
      const tx = await walletClient.writeContract({
        address: contractAddress,
        abi: CeloUbiAbi,
        functionName: 'claim',
        args: [billeteraUsuario.billetera as Address, user.profilescore],
      })
      console.log("OJO claim-celo-ubi tx=", tx)

      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx })
      console.log("OJO claim-celo-ubi receipt=", receipt)

      if (receipt.status !== 'success') {
        return NextResponse.json({ message: 'Transaction failed' }, { status: 500 })
      }

      console.log("OJO claim-celo-ubi receipt.logs=", receipt.logs)
      const claimEvent = receipt.logs
        .map(log => {
          try {
            const del = decodeEventLog({ abi: CeloUbiAbi, ...log })
            console.log("OJO claim-celo-ubi del=", del)
            return del;
          } catch {
            return null;
          }
        })
        .find(event => event?.eventName === 'Claimed');
      console.log("OJO claim-celo-ubi claimEvent=", claimEvent)

      let formattedAmount = '0';
      if (claimEvent && claimEvent.args) {
        const { amount } = claimEvent.args as unknown as { amount: bigint };
        formattedAmount = (Number(amount) / 1e18).toString();
        console.log("OJO claim-celo-ubi formattedAmount=", formattedAmount)

        try {
          await db
            .insertInto('ubitransactions' as any)
            .values({
              wallet: walletAddress,
              amount: formattedAmount,
              hash: tx,
              date: new Date(),
            })
            .execute();
        } catch (dbError) {
          console.error('Failed to save UBI transaction to db:', dbError);
          // No devolver error al cliente, pero sí loguearlo.
        }
      }

      return NextResponse.json({ 
        message: lang === 'es' ? `¡Reclamo exitoso! Has recibido ${formattedAmount} Celo UBI.` : `Claim successful! You have received ${formattedAmount} Celo UBI.`,
        txHash: tx,
        amount: formattedAmount 
      });

    } catch (err) {
        console.error('Claim transaction failed:', err)
        let errorMessage = 'Claim failed: Unknown error'
        if (err instanceof BaseError) {
            const revertError = err.walk(e => e instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null
            if (revertError) {
                errorMessage = `Claim failed: ${revertError.reason || revertError.shortMessage}`
            }
        }
        return NextResponse.json({ message: errorMessage }, { status: 400 })
    }

  } catch (error) {
    console.error(error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
