"use server"

import { Insertable, Kysely, PostgresDialect, sql, Updateable } from 'kysely';
import { NextRequest, NextResponse } from 'next/server'
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, createWalletClient, getContract, http } from 'viem'
import { celo, celoSepolia } from 'viem/chains'

import defineConfig from '@/.config/kysely.config.ts'
import type { DB, BilleteraUsuario, Usuario } from '@/db/db.d.ts';
import ScholarshipVaultsAbi from '@/abis/ScholarshipVaults.json'

export async function GET(req: NextRequest) {
  console.log("** scolarship GET req=", req)

  try {
    let retMessage = "";
    let md2 = "";
    if (process.env.NEXT_PUBLIC_AUTH_URL == undefined) {
      retMessage = "\nNEXT_PUBLIC_AUTH_URL undefined"
    }
    if (process.env.NEXT_PUBLIC_DEPLOYED_AT == undefined) {
      retMessage = "\nNEXT_PUBLIC_DEPLOYED_AT undefined"
    }
    if (process.env.NEXT_PUBLIC_PRIVATE_KEY == undefined) {
      retMessage = "\nNEXT_PUBLIC_PRIVATE_KEY undefined"
    }
    if (process.env.NEXT_PUBLIC_RPC_URL == undefined) {
      retMessage = "\nNEXT_PUBLIC_RPC_URL undefined"
    }

    const { searchParams } = req.nextUrl
    const courseId = searchParams.get("courseId")
    const walletAddress = searchParams.get("walletAddress")
    const token = searchParams.get("token")

    console.log("** courseId=", courseId)
    console.log("** walletAddress =", walletAddress)
    console.log("** token=", token)
    const db = new Kysely<DB>({
      dialect: defineConfig.dialect
    })

    let billeteraUsuario = {}
    if (walletAddress && walletAddress != null) {
      billeteraUsuario = await db.selectFrom('billetera_usuario')
        .where('billetera', '=', walletAddress)
        .selectAll()
        .executeTakeFirst()
        console.log("** billeteraUsuario=", billeteraUsuario)
        if (billeteraUsuario.token != token) {
          retMessage += "\nToken stored for user doesn't match given token. "
        }
    }
    if (courseId == null) {
      retMessage += "\nMissing courseId"
    } else {
      let course = await db.selectFrom("cor1440_gen_proyectofinanciero")
        .where('id', "=", courseId)
        .selectAll()
        .executeTakeFirst()
        console.log("** course=", course)
        if (course == null) {
          retMessage += "\nWront courseId"
        }
    }

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

      const account = privateKeyToAccount(
        process.env.NEXT_PUBLIC_PRIVATE_KEY as Address
      )
      console.log("** account=", account)
      const walletClient = createWalletClient({
        account,
        chain: process.env.NEXT_PUBLIC_AUTH_URL == "https://learn.tg" ?
          celo : celoSepolia,
        transport: http(rpcUrl)
      })
      console.log("** walletClient=", walletClient)

      // Quisieramso usar getContract de viem asi:
      //      const contract = getContract({
      //    address: process.env.NEXT_PUBLIC_DEPLOYED_AT,
      //    abi: ScholarshipVaultsAbi,
      //    publicClient,
      //    walletClient,
      // })
      // console.log("** contract=", contract)
      // const vault = await contract.read.getVault( courseId )
      //
      // Pero contract.read ha resultado undefined al ejecutar con diversas
      // combinaciones de publicClient, walletClient con diversos
      // RPCs

      const contractAddress = process.env.NEXT_PUBLIC_DEPLOYED_AT as Address
      const vault = await publicClient.readContract({
        abi: ScholarshipVaultsAbi,
        address: contractAddress,
        functionName: "getVault",
        args: [courseId],
      })
      console.log("** vault=", vault)
      if (vault.exists && vault.amountPerGuide > 0 &&
          vault.balance >= vault.amountPerGuide
        // userElegible(courseId, walletAddress)
      ) {
        amountPerGuide = vault.amountPerGuide // * verificationScore/maxVerificationScore
        canSubmit = await contract.read.studentCanSubmit(
          courseId, walletAddress
        )
      } else {
        //retMessage += "\nCourse doesn't have a scolarship available"
      }
    }

    console.log("** Normal exit with amountPerGuide=", amountPerGuide)
    console.log("** Normal exit with canSubmit=", canSubmit)
    console.log("** Normal exit with message=", retMessage)
    return NextResponse.json(
      {
        amountPerGuide: amountPerGuide,
        canSubmit: canSubmit,
        message: retMessage,
      },
      {status: 200}
    )
  } catch (error) {
    console.error("Excepción error=", error)
    return NextResponse.json(
      {error: error},
      {status: 500}
    )
  }

}
