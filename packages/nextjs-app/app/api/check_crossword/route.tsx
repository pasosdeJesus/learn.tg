"use server"

import { Kysely, PostgresDialect } from 'kysely'
import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { privateKeyToAccount } from "viem/accounts";
import {
  Address,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatUnits,
  getContract,
  Hex,
  http
} from 'viem'
import { celo, celoSepolia } from 'viem/chains'
import { getReferralTag, submitReferral } from '@divvi/referral-sdk'

import { newKyselyPostgresql } from '@/.config/kysely.config.ts'
import type { DB } from '@/db/db.d.ts'
import ScholarshipVaultsAbi from '@/abis/ScholarshipVaults.json'

interface WordPlacement {
  word: string
  row: number
  col: number
  direction: "across" | "down"
  number: number
  clue: string
}

interface Cell {
  letter: string
  number?: number
  isBlocked: boolean
  userInput: string
  belongsToWords: number[]
}


export async function GET(req: NextRequest) {
  return NextResponse.json(
    {error: "Expecting POST request"},
    {status: 400}
  )
}

export async function POST(req: NextRequest) {
  console.log("** OJO check_crossword POST")
  console.log(1/0)

  let retMessage = ""
  const removeAccents = (s: string) => s.replace('á', 'A').
    replace('é', 'E').
    replace('í', 'I').
    replace('ó', 'O').
    replace('ú', 'U').
    replace('ü', 'U').
    replace('Á', 'A').
    replace('É', 'E').
    replace('Ó', 'O').
    replace('Ú', 'U').
    replace('Ü', 'U')

  try {
    let mistakesInCW: number[] = []
    let retMessage = ""
    let scholarshipResult: any = null
    const requestJson = await req.json()
    const courseId = +requestJson['courseId']
    const guideId = +requestJson['guideId']
    const lang = requestJson['lang'] ?? ''
    const prefix = requestJson['prefix'] ?? ''
    const guide = requestJson['guide'] ?? ''
    const grid = requestJson['grid'] ?? ''
    const placements = requestJson['placements'] ?? ''
    const walletAddress = requestJson['walletAddress'] ?? ''
    const token = requestJson['token'] ?? ''

    const db = newKyselyPostgresql()

    // Mensajes localizados
    const msg = {
      es: {
        noWallet: "La respuesta no será calificada ni se buscarán becas posibles.",
        tokenMismatch: "El token almacenado para el usuario no coincide con el token proporcionado.",
        correct: "¡Respuesta correcta! Se ha enviado tu resultado para beca.",
        submitError: "No se pudo enviar el resultado para beca: ",
        cannotSubmit: "No puedes enviar resultado para beca en este momento.",
        contractError: "No se pudo conectar con el contrato de becas.",
        invalidKey: "Clave privada inválida"
      },
      en: {
        noWallet: "Your answer will not be graded nor will possible scholarships be sought.",
        tokenMismatch: "Token stored for user doesn't match given token.",
        correct: "Correct answer! Your result has been submitted for scholarship.",
        submitError: "Could not submit result for scholarship: ",
        cannotSubmit: "You cannot submit a scholarship result at this time.",
        contractError: "Could not connect to scholarship contract.",
        invalidKey: "Invalid private key"
      }
    }
    const locale = lang === "es" ? "es" : "en"

    if (!walletAddress || walletAddress == null || walletAddress == "") {
      retMessage += "\n" + msg[locale].noWallet
    } else {
      let billeteraUsuario = await db.selectFrom('billetera_usuario')
        .where('billetera', '=', walletAddress)
        .selectAll()
        .executeTakeFirst()
      if (!billeteraUsuario || billeteraUsuario.token != token) {
        retMessage += "\n" + msg[locale].tokenMismatch
      } else {
        let words = billeteraUsuario.answer_fib ?
          billeteraUsuario.answer_fib.split(" | ") : []
        for(let i = 0; i < words.length; i++) {
          let nrow = placements[i].row
          let ncol = placements[i].col
          let dir = placements[i].direction
          let word = words[i]
          for (let j = 0; j < word.length; j++) {
            if (
              nrow >= grid.length || ncol >= grid[nrow].length ||
              removeAccents(grid[nrow][ncol].userInput.toUpperCase()) !=
            removeAccents(word[j].toUpperCase())
            ) {
              if (!mistakesInCW.includes(i+1)) {
                mistakesInCW.push(i+1)
              }
            }
            if (dir == "across") {
              ncol++
            } else {
              nrow++
            }
          }
        }

        // Intentamos beca
        // Lógica similar a /api/scholarship
        let usdtDecimals = 0
        if (process.env.NEXT_PUBLIC_USDT_DECIMALS != undefined) {
          usdtDecimals = +process.env.NEXT_PUBLIC_USDT_DECIMALS
        }
        const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL
        const publicClient = createPublicClient({
          chain: process.env.NEXT_PUBLIC_AUTH_URL == "https://learn.tg" ?
          celo : celoSepolia,
          transport: http(rpcUrl)
        })
        const privateKey = process.env.NEXT_PUBLIC_PRIVATE_KEY as string | undefined
        let account: ReturnType<typeof privateKeyToAccount> | undefined
        if (privateKey) {
          try {
            account = privateKeyToAccount(privateKey as Address)
          } catch (e) {
            retMessage += "\n" + msg[locale].invalidKey
          }
        }
        const walletClient = account ? createWalletClient({
          account,
          chain: process.env.NEXT_PUBLIC_AUTH_URL == "https://learn.tg" ?
          celo : celoSepolia,
          transport: http(rpcUrl)
        }) : undefined
        console.log("*** walletClient=", walletClient)
        const referralTag = account ? getReferralTag({
          user: walletAddress,
          consumer: account.address,
        }) : undefined
        console.log("*** referralTag=", referralTag)

        const contractAddress = process.env.NEXT_PUBLIC_DEPLOYED_AT as Address
        if (account && contractAddress && walletClient) {
          const contract = getContract({
            address: contractAddress,
            abi: ScholarshipVaultsAbi as any,
            client: { public: publicClient, wallet: walletClient }
          })
          console.log("*** contract=", contract)
          const courseIdArg = BigInt(courseId)
          const guideIdArg = BigInt(guideId)
          // Existe la boveda
          const vault:any = await contract.read.getVault([
            courseIdArg
          ])
          console.log("*** vault=", vault)
          if (vault[3]) { // vault.exists
            // Verificar si puede enviar
            const canSubmit = await contract.read.studentCanSubmit([
              courseIdArg, walletAddress as Address
            ]) as boolean
            if (canSubmit) {
              // Enviar resultado
              try {
                const encodedData = encodeFunctionData({
                  abi: ScholarshipVaultsAbi,
                  functionName: 'submitGuideResult',
                  args: [
                    courseIdArg,
                    guideIdArg,
                    walletAddress as Address,
                    mistakesInCW.length == 0,
                  ]
                })
                console.log("encodedData=", encodedData)
                let txData = encodedData
                if (txData && txData.length >= 10) {
                  txData += referralTag
                }
                console.log("txData=", txData)
                const tx = await walletClient.sendTransaction({
                  account,
                  to: contract.address,
                  data: txData as Hex,
                });
                console.log("tx=", tx)
                const receipt = await walletClient.waitForTransactionReceipt(
                  {tx}
                );
                console.log("receipt=", receipt)
                const transactionUrl = `${process.env.NEXT_PUBLIC_EXPLORER_TX}${receipt?.transactionHash}`;
                 const chainId = await walletClient.getChainId()
                 console.log("chainId=", chainId)

                 if (chainId == 42220) { // Celo mainnet
                   const sr = await submitReferral({
                     txHash: tx,
                     chainId: chainId,
                   })

                   console.log("sr=", sr)
                 }

                /*const tx = await contract.write.submitGuideResult([
                  courseIdArg, guideIdArg, walletAddress as Address,
                  mistakesInCW.length == 0
                ]) */
                scholarshipResult = tx
                retMessage += "\n" + msg[locale].correct
              } catch (err) {
                retMessage += "\n" + msg[locale].submitError + err
              }
            } else {
              retMessage += "\n" + msg[locale].cannotSubmit
            }
          } else {
            retMessage += `\nThere is not vault for the course (${courseId})`
          }
        } else {
          retMessage += "\n" + msg[locale].contractError
        }
        }
    }

    return NextResponse.json(
      {
        mistakesInCW: mistakesInCW,
        message: retMessage,
        scholarshipResult: scholarshipResult
      },
      {status: 200}
    )
  } catch (error) {
    console.error("Excepción error=", error)
    const sError = JSON.stringify(
      error,
      (key, value) => typeof value === 'bigint' ? value.toString() + 'n' : value
    );
    return NextResponse.json(
      {error: sError},
      {status: 500}
    )
  }

}
