"use server"

import { Kysely, PostgresDialect } from 'kysely';
import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { privateKeyToAccount } from "viem/accounts";
import { 
  createPublicClient, createWalletClient, formatUnits, getContract, http 
} from 'viem'
import type { Address } from 'viem'
import { celo, celoSepolia } from 'viem/chains'

import { newKyselyPostgresql } from '@/.config/kysely.config.ts'
import LearnTGVaultsAbi from '@/abis/LearnTGVaults.json'
import type { DB, BilleteraUsuario } from '@/db/db.d.ts';

export async function GET(req: NextRequest) {
  console.log("** scolarship GET req=", req)

  try {
    let retMessage = "";
    let md2 = "";
    if (process.env.NEXT_PUBLIC_AUTH_URL == undefined) {
      retMessage += "\nNEXT_PUBLIC_AUTH_URL undefined"
    }
    if (process.env.NEXT_PUBLIC_DEPLOYED_AT == undefined) {
      retMessage += "\nNEXT_PUBLIC_DEPLOYED_AT undefined"
    }
    if (process.env.PRIVATE_KEY == undefined) {
      retMessage += "\nPRIVATE_KEY undefined"
    }
    if (process.env.NEXT_PUBLIC_RPC_URL == undefined) {
      retMessage += "\nNEXT_PUBLIC_RPC_URL undefined"
    }
    let usdtDecimals = 0
    if (process.env.NEXT_PUBLIC_USDT_DECIMALS == undefined) {
      retMessage += "\nNEXT_PUBLIC_USDT_DECIMALS undefined"
    } else {
      usdtDecimals = +process.env.NEXT_PUBLIC_USDT_DECIMALS
    }


    const { searchParams } = req.nextUrl
    const courseId = searchParams.get("courseId")
    const walletAddress = searchParams.get("walletAddress")
    const token = searchParams.get("token")

    console.log("** courseId=", courseId)
    console.log("** walletAddress =", walletAddress)
    console.log("** token=", token)

    const db = newKyselyPostgresql()

    // Usamos un tipo más laxo porque los tipos generados de timestamp no coinciden exactamente con Date
    let billeteraUsuario: Partial<BilleteraUsuario> | undefined
    if (walletAddress) {
      const billeteraRow = await db.selectFrom('billetera_usuario')
        .where('billetera', '=', walletAddress)
        .selectAll()
        .executeTakeFirst()
      billeteraUsuario = billeteraRow as unknown as Partial<BilleteraUsuario>
      console.log("** billeteraUsuario=", billeteraUsuario)
      if (billeteraUsuario && billeteraUsuario.token && billeteraUsuario.token != token) {
        retMessage += "\nToken stored for user doesn't match given token. "
      }
    }
    if (courseId == null) {
      retMessage += "\nMissing courseId"
    } else {
      // id parece ser numérico; intentar conversión
      const courseIdNumber = /^\d+$/.test(courseId) ? parseInt(courseId, 10) : NaN
      if (isNaN(courseIdNumber)) {
        retMessage += "\nWrong courseId format"
      } else {
        const course = await db.selectFrom("cor1440_gen_proyectofinanciero")
          .where('id', "=", courseIdNumber)
          .selectAll()
          .executeTakeFirst()
        console.log("** course=", course)
        if (!course) {
          retMessage += "\nWrong courseId"
        }
      }
    }

    let vaultCreated = false
    let vaultBalance = 0
    let canSubmit = false
    let amountPerGuide = 0
    if (retMessage == "") {
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL
      console.log("** rpcUrl=", rpcUrl)
      const publicClient = createPublicClient({
        chain: process.env.NEXT_PUBLIC_AUTH_URL == "https://learn.tg" ?
          celo : celoSepolia,
        transport: http(rpcUrl)
      })
      console.log("** publicClient=", publicClient)

      const privateKey = process.env.PRIVATE_KEY as string | undefined
      let account: ReturnType<typeof privateKeyToAccount> | undefined
      if (privateKey) {
        try {
          account = privateKeyToAccount(privateKey as Address)
          console.log("** account=", account?.address)
        } catch (e) {
          retMessage += "\nInvalid private key"
        }
      }
      const walletClient = account ? createWalletClient({
        account,
        chain: process.env.NEXT_PUBLIC_AUTH_URL == "https://learn.tg" ?
          celo : celoSepolia,
        transport: http(rpcUrl)
      }) : undefined
      console.log("** walletClient=", walletClient)
      if (walletClient) {
        console.log("** walletClient creado")
      }

      const contractAddress = process.env.NEXT_PUBLIC_DEPLOYED_AT as Address
      console.log("** contractAddress=", contractAddress)
      if (!contractAddress) {
        retMessage += "\nMissing contract address"
      } else if (walletClient) {
        const contract = getContract({
          address: contractAddress,
          abi: LearnTGVaultsAbi as any,
          client: { public: publicClient, wallet: walletClient }
        })
 
        const courseIdArg = courseId && /^\d+$/.test(courseId) ? BigInt(courseId) : courseId
        const vaultArray = await contract.read.vaults([courseIdArg]) as any
        console.log("** vaultArray=", vaultArray)
        const vault = {
          courseId: Number(vaultArray[0]),
          preBalance: Number(vaultArray[1]),
          preAmountPerGuide: Number(vaultArray[2]),
          exists: Boolean(vaultArray[3])
        }
        console.log("** vault=", vault)
        if (vault && vault.exists) {
          vaultCreated = true
          vaultBalance = +formatUnits(BigInt(vault.preBalance), usdtDecimals)
          if (
            vault.preAmountPerGuide > 0 && 
            vault.preBalance >= vault.preAmountPerGuide
          ) {
            amountPerGuide = +formatUnits(
              BigInt(vault.preAmountPerGuide), usdtDecimals
            )
            if (walletAddress) {
              canSubmit = await contract.read.studentCanSubmit(
                [courseIdArg, walletAddress as Address]
              ) as boolean
            }
          }
        }
      }
    }

    console.log("** Normal exit with vaultCreated=", vaultCreated)
    console.log("** Normal exit with vaultBalance=", vaultBalance)
    console.log("** Normal exit with amountPerGuide=", amountPerGuide)
    console.log("** Normal exit with canSubmit=", canSubmit)
    console.log("** Normal exit with message=", retMessage)
    return NextResponse.json(
      {
        courseId: courseId == null ? 0 : Number(courseId),
        vaultCreated: vaultCreated,
        vaultBalance: vaultBalance,
        amountPerGuide: amountPerGuide,
        canSubmit: canSubmit,
        message: retMessage,
      },
      {status: 200}
    )
  } catch (error) {
    console.error("Excepción error=", error)
    return NextResponse.json(
      {error: error.toString()},
      {status: 500}
    )
  }

}
