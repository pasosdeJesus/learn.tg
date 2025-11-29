"use server"

import { useIdentitySDK } from "@goodsdks/citizen-sdk"
import { Kysely, PostgresDialect, sql } from 'kysely'
import type { Updateable } from 'kysely'
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

import { newKyselyPostgresql } from '@/.config/kysely.config.ts'
import type { Usuario } from '@/db/db.d.ts'


export async function GET(req: NextRequest) {
  return NextResponse.json(
    {error: "Expecting POST request"},
    {status: 400}
  )
}

export async function POST(req: NextRequest) {
  console.log("** OJO gooddollar-verify GET")

  let retMessage = ""

  try {
    const requestJson = await req.json()
    const lang = requestJson['lang'] ?? ''
    const walletAddress = requestJson['walletAddress'] ?? ''
    const token = requestJson['token'] ?? ''

    const db = newKyselyPostgresql()

    // Mensajes localizados
    const msg = {
      es: {
        atLeast50: "No se enviaron resultados al blockchain. Necesita al menos 50 puntos en su perfil para habilitar el envío",
        cannotSubmit: "Estás es un periodo de espera de 24 horas desde tu último envío para este curso. No puedes enviar resultado para beca en este momento.",
        contractError: "No se pudo conectar con el contrato de becas.",
        correctPoint: "¡Respuesta correcto! +1 punto",
        correct: "¡Respuesta correcta! Se ha enviado tu resultado para beca, por favor espera 24 horas antes de volver a enviar para este curso.",
        incorrect: "Respuesta equivocada. Se ha enviado tu resultado al blockchain, por favor espera 24 horas antes de volver a enviar para este curso.",
        noWallet: "La respuesta no será calificada ni se buscarán becas posibles.",
        submitError: "No se pudo enviar el resultado para beca: ",
        tokenMismatch: "El token almacenado para el usuario no coincide con el token proporcionado.",
        userNotFound: "Usuario no encontrado"
      },
      en: {
        atLeast50: "The results were not sent to the blockchain. You need at least 50 points in your profile to enable sending",
        cannotSubmit: "You are in a waiting period of 24 hours since our last submission. You cannot submit a scholarship result at this time.",
        contractError: "Could not connect to scholarship contract.",
        correct: "Correct answer! Your result has been submitted for scholarship, please waith 24 hourse before submitting again answers for this course.",
        correctPoint: "Correct answer! +1 point",
        incorrect: "Wrong answer. Your result has been submitted for scholarship, please waith 24 hourse before submitting again answers for this course.",
        noWallet: "Your answer will not be graded nor will possible scholarships be sought.",
        submitError: "Could not submit result for scholarship: ",
        tokenMismatch: "Token stored for user doesn't match given token.",
        userNotFound: "User not found"
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

        // Perfil de usuario. Punto si hacía falta y la respuesta es correcta
        let usuario = await db.selectFrom('usuario')
        .where('id', '=', billeteraUsuario.usuario_id)
        .selectAll()
        .executeTakeFirst()
        console.log("OJO usuario=", usuario)

        if (usuario == null) {
          retMessage += "\n" + msg[locale].userNotFound
        } else {
          const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL
          const publicClient = createPublicClient({
            chain: process.env.NEXT_PUBLIC_AUTH_URL == "https://learn.tg" ?
            celo : celoSepolia,
            transport: http(rpcUrl)
          })
          const privateKey = process.env.PRIVATE_KEY as Hex | undefined
          if (!privateKey) {
            console.error("CRITICAL: PRIVATE_KEY is not set in environment variables.");
            throw new Error("Server configuration error.");
          }

          let account;
          try {
            account = privateKeyToAccount(privateKey);
          } catch (e) {
            console.error("CRITICAL: Failed to load account from private key.", e);
            throw new Error("Server configuration error.");
          }
          const walletClient = createWalletClient({
            account,
            chain: process.env.NEXT_PUBLIC_AUTH_URL == "https://learn.tg" ?
            celo : celoSepolia,
            transport: http(rpcUrl)
          })
          const identitySDK = useIdentitySDK('production')

          if (identitySDK == null) {
            retMessage += "\n identitySDK is null"
          } else {
            const { isWhitelisted } = 
              await identitySDK.getWhitelistedRoot(walletAddress)

            let uUsuario:Updateable<Usuario> = {
              lastgooddollarverification: isWhitelisted ? new Date() : null,
            }
            console.log("uUsuario=", uUsuario)
            let rupdate=await db.updateTable('usuario').set(uUsuario).where(
              'id', '=', usuario.id
            ).execute()
            console.log("rupdate=", rupdate)
          }
        }
      }
    }

    console.log("Retornando mensaje ", retMessage)
    return NextResponse.json(
      {
        message: retMessage,
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

