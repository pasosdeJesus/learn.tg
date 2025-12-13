'use server'

import { NextRequest, NextResponse } from 'next/server'
import { privateKeyToAccount } from 'viem/accounts'
import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  getContract,
  http,
} from 'viem'
import type { Address } from 'viem'
import { celo, celoSepolia } from 'viem/chains'
import { sql } from 'kysely'

import { newKyselyPostgresql } from '@/.config/kysely.config.ts'
import LearnTGVaultsAbi from '@/abis/LearnTGVaults.json'
import type { BilleteraUsuario } from '@/db/db.d.ts'

export async function GET(req: NextRequest) {
  console.log('** scholarship GET req=', req)

  try {
    let retMessage = ''
    if (process.env.NEXT_PUBLIC_AUTH_URL === undefined) {
      retMessage += '\nNEXT_PUBLIC_AUTH_URL undefined'
    }
    if (process.env.NEXT_PUBLIC_DEPLOYED_AT === undefined) {
      retMessage += '\nNEXT_PUBLIC_DEPLOYED_AT undefined'
    }
    if (process.env.PRIVATE_KEY === undefined) {
      retMessage += '\nPRIVATE_KEY undefined'
    }
    if (process.env.NEXT_PUBLIC_RPC_URL === undefined) {
      retMessage += '\nNEXT_PUBLIC_RPC_URL undefined'
    }
    let usdtDecimals = 0
    if (process.env.NEXT_PUBLIC_USDT_DECIMALS === undefined) {
      retMessage += '\nNEXT_PUBLIC_USDT_DECIMALS undefined'
    } else {
      usdtDecimals = +process.env.NEXT_PUBLIC_USDT_DECIMALS
    }

    const { searchParams } = req.nextUrl
    const courseId = searchParams.get('courseId')
    const walletAddress = searchParams.get('walletAddress')
    const token = searchParams.get('token')

    const db = newKyselyPostgresql()
    let courseIdNumber = NaN

    let billeteraUsuario: Partial<BilleteraUsuario> | undefined
    if (walletAddress) {
      const billeteraRow = await db
        .selectFrom('billetera_usuario')
        .where('billetera', '=', walletAddress)
        .selectAll()
        .executeTakeFirst()
      billeteraUsuario = billeteraRow as unknown as Partial<BilleteraUsuario>
      if (
        billeteraUsuario &&
        billeteraUsuario.token &&
        billeteraUsuario.token !== token
      ) {
        retMessage += "\nToken stored for user doesn't match given token. "
      }
    }
    if (courseId == null) {
      retMessage += '\nMissing courseId'
    } else {
      courseIdNumber = /^\d+$/.test(courseId) ? parseInt(courseId, 10) : NaN
      if (isNaN(courseIdNumber)) {
        retMessage += '\nWrong courseId format'
      } else {
        const course = await db
          .selectFrom('cor1440_gen_proyectofinanciero')
          .where('id', '=', courseIdNumber)
          .selectAll()
          .executeTakeFirst()
        if (!course) {
          retMessage += '\nWrong courseId'
        }
      }
    }

    let vaultCreated = false
    let vaultBalance = 0
    let canSubmit = false
    let amountPerGuide = 0
    let percentageCompleted = 0
    let percentagePaid = 0

    if (
      retMessage === '' &&
      billeteraUsuario &&
      billeteraUsuario.usuario_id &&
      !isNaN(courseIdNumber)
    ) {
      try {
        const result: any = await sql`
          SELECT 
            (COUNT(CASE WHEN gu.points > 0 THEN 1 END) * 100.0 / COUNT(a.id)) as percentage_completed,
            (COUNT(CASE WHEN gu.amountpaid > 0 THEN 1 END) * 100.0 / COUNT(a.id)) as percentage_paid
          FROM actividadpf AS a
          LEFT JOIN guide_usuario AS gu ON a.id = gu.actividadpf_id AND gu.usuario_id = ${billeteraUsuario.usuario_id}
          WHERE a.proyectofinanciero_id = ${courseIdNumber}
        `.execute(db)

        if (result.rows.length > 0) {
          percentageCompleted = Number(result.rows[0].percentage_completed || 0)
          percentagePaid = Number(result.rows[0].percentage_paid || 0)
        }
      } catch (error) {
        console.error('Error fetching guide progress:', error)
      }
    }

    if (retMessage == '') {
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL
      const publicClient = createPublicClient({
        chain:
          process.env.NEXT_PUBLIC_AUTH_URL == 'https://learn.tg'
            ? celo
            : celoSepolia,
        transport: http(rpcUrl),
      })

      const privateKey = process.env.PRIVATE_KEY as string | undefined
      let account: ReturnType<typeof privateKeyToAccount> | undefined
      if (privateKey) {
        try {
          account = privateKeyToAccount(privateKey as Address)
        } catch (e) {
          retMessage += '\nInvalid private key'
        }
      }
      const walletClient = account
        ? createWalletClient({
            account,
            chain:
              process.env.NEXT_PUBLIC_AUTH_URL == 'https://learn.tg'
                ? celo
                : celoSepolia,
            transport: http(rpcUrl),
          })
        : undefined

      const contractAddress = process.env.NEXT_PUBLIC_DEPLOYED_AT as Address
      if (!contractAddress) {
        retMessage += '\nMissing contract address'
      } else if (walletClient) {
        const contract = getContract({
          address: contractAddress,
          abi: LearnTGVaultsAbi as any,
          client: { public: publicClient, wallet: walletClient },
        })

        const courseIdArg =
          courseId && /^\d+$/.test(courseId) ? BigInt(courseId) : courseId
        const vaultArray = (await contract.read.vaults([courseIdArg])) as any
        const vault = {
          courseId: Number(vaultArray[0]),
          preBalance: Number(vaultArray[1]),
          preBalanceCcop: Number(vaultArray[2]),
          preBalanceGooddollar: Number(vaultArray[3]),
          preAmountPerGuide: Number(vaultArray[4]),
          exists: Boolean(vaultArray[5]),
        }

        if (vault && vault.exists) {
          vaultCreated = true
          vaultBalance = +formatUnits(BigInt(vault.preBalance), usdtDecimals)
          if (
            vault.preAmountPerGuide > 0 &&
            vault.preBalance >= vault.preAmountPerGuide
          ) {
            amountPerGuide = +formatUnits(
              BigInt(vault.preAmountPerGuide),
              usdtDecimals,
            )
            if (walletAddress) {
              canSubmit = (await contract.read.studentCanSubmit([
                courseIdArg,
                walletAddress as Address,
              ])) as boolean
            }
          }
        }
      }
    }

    return NextResponse.json(
      {
        courseId: courseId == null ? 0 : Number(courseId),
        vaultCreated: vaultCreated,
        vaultBalance: vaultBalance,
        amountPerGuide: amountPerGuide,
        canSubmit: canSubmit,
        percentageCompleted: percentageCompleted,
        percentagePaid: percentagePaid,
        message: retMessage,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Excepción error=', error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

