'use server'

import { IdentitySDK } from '@goodsdks/citizen-sdk'
import { Kysely, PostgresDialect, sql, type RawBuilder } from 'kysely'
import type { Updateable } from 'kysely'
import { NextRequest, NextResponse } from 'next/server'
import { privateKeyToAccount } from 'viem/accounts'
import {
  Address,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatUnits,
  getContract,
  Hex,
  http,
} from 'viem'
import { celo, celoSepolia } from 'viem/chains'

import { newKyselyPostgresql } from '@/.config/kysely.config.ts'
import type { Usuario } from '@/db/db.d.ts'
import { calculateLearningScore, calculateProfileScore } from '@/lib/scores'

export async function GET(req: NextRequest) {
  return NextResponse.json({ error: 'Expecting POST request' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  console.log('** OJO update-scores POST')

  let retMessage = ''

  try {
    let learningscore = 0
    let profilescore = 0
    const requestJson = await req.json()
    const lang = requestJson['lang'] ?? ''
    const walletAddress = requestJson['walletAddress'] ?? ''
    const token = requestJson['token'] ?? ''

    const db = newKyselyPostgresql()

    // Mensajes localizados
    const msg = {
      es: {
        noWallet:
          'La respuesta no será calificada ni se buscarán becas posibles.',
        tokenMismatch:
          'El token almacenado para el usuario no coincide con el token proporcionado.',
        userNotFound: 'Usuario no encontrado',
      },
      en: {
        noWallet:
          'Your answer will not be graded nor will possible scholarships be sought.',
        tokenMismatch: "Token stored for user doesn't match given token.",
        userNotFound: 'User not found',
      },
    }
    const locale = lang === 'es' ? 'es' : 'en'

    if (!walletAddress || walletAddress == null || walletAddress == '') {
      retMessage += '\n' + msg[locale].noWallet
    } else {
      let billeteraUsuario = await db
        .selectFrom('billetera_usuario')
        .where('billetera', '=', walletAddress)
        .selectAll()
        .executeTakeFirst()
      if (!billeteraUsuario || billeteraUsuario.token != token) {
        retMessage += '\n' + msg[locale].tokenMismatch
      } else {
        let usuario = await db
          .selectFrom('usuario')
          .where('id', '=', billeteraUsuario.usuario_id)
          .selectAll()
          .executeTakeFirst()
        console.log('OJO usuario=', usuario)

        if (usuario == null) {
          retMessage += '\n' + msg[locale].userNotFound
        } else {
          const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL
          const chain =
            process.env.NEXT_PUBLIC_NETWORK == 'celo' ? celo : celoSepolia

          const publicClient = createPublicClient({
            chain,
            transport: http(rpcUrl),
          })
          const privateKey = process.env.PRIVATE_KEY as Hex | undefined
          if (!privateKey) {
            console.error(
              'CRITICAL: PRIVATE_KEY is not set in environment variables.',
            )
            throw new Error('Server configuration error.')
          }

          let account
          try {
            account = privateKeyToAccount(privateKey)
          } catch (e) {
            console.error(
              'CRITICAL: Failed to load account from private key.',
              e,
            )
            throw new Error('Server configuration error.')
          }

          const walletClient = createWalletClient({
            account,
            chain,
            transport: http(rpcUrl),
          })

          let whitelisted = process.env.NETWORK == "celoSepolia"
          if (process.env.NETWORK == "celo") {
            const identitySDK = new IdentitySDK(
              publicClient as any,
              walletClient as any,
              'production',
            )
            if (identitySDK == null) {
              retMessage += '\n identitySDK is null'
            }  else {
              const { isWhitelisted, root } =
                await identitySDK.getWhitelistedRoot(walletAddress)
              whitelisted = isWhitelisted
            }
          } else {
            // Gooddollar doesn't work in testnet
            whitelisted = true
          }

          learningscore = await calculateLearningScore(db, usuario.id)
          profilescore = calculateProfileScore(usuario, whitelisted)

          let uUsuario: Updateable<Usuario> = {
            lastgooddollarverification: whitelisted ? new Date() : null,
            learningscore: learningscore,
            profilescore: profilescore,
          }
          console.log('uUsuario=', uUsuario)
          let rupdate = await db
          .updateTable('usuario')
          .set(uUsuario)
          .where('id', '=', usuario.id)
          .execute()
          console.log('rupdate=', rupdate)
        }
      }
    }

    console.log('Retornando mensaje ', retMessage)
    return NextResponse.json({ 
      message: retMessage, 
      profilescore: profilescore,
      learningscore: learningscore
    }, { status: 200 })
  } catch (error) {
    console.error('Excepción error=', error)
    const sError = JSON.stringify(error, (key, value) =>
      typeof value === 'bigint' ? value.toString() + 'n' : value,
    )
    return NextResponse.json({ error: sError }, { status: 500 })
  }
}
