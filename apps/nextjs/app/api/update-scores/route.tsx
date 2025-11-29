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

export async function GET(req: NextRequest) {
  return NextResponse.json({ error: 'Expecting POST request' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  console.log('** OJO update-scores POST')

  let retMessage = ''

  try {
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
          const identitySDK = new IdentitySDK(
            publicClient as any,
            walletClient as any,
            'production',
          )
          if (identitySDK == null) {
            retMessage += '\n identitySDK is null'
          } else {
            const { isWhitelisted, root } =
              await identitySDK.getWhitelistedRoot(walletAddress)

            // LEARNING SCORE CALCULATION
            const guidePointsQuery = await db
              .selectFrom('guide_usuario')
              .where('usuario_id', '=', usuario.id)
              .select(sql<number>`sum(points)`.as('total_points'))
              .executeTakeFirst()
            const coursePointsQuery = await db
              .selectFrom('course_usuario')
              .where('usuario_id', '=', usuario.id)
              .select(sql<number>`sum(points)`.as('total_points'))
              .executeTakeFirst()

            const guidePoints = Number(guidePointsQuery?.total_points) || 0
            const coursePoints = Number(coursePointsQuery?.total_points) || 0
            const learningscore = guidePoints + coursePoints

            // PROFILE SCORE CALCULATION
            let profilescore = 0
            if (usuario.lastgooddollarverification || usuario.passport_name) {
              profilescore += 51
            }
            if (usuario.passport_name) {
              profilescore += 15
            }
            if (usuario.passport_nationality) {
              profilescore += 15
            }
            if (usuario.email) {
              profilescore += 9
            }
            if (usuario.religion_id) {
              profilescore += 9
            }

            let uUsuario: Updateable<Usuario> = {
              lastgooddollarverification: isWhitelisted ? new Date() : null,
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
    }

    console.log('Retornando mensaje ', retMessage)
    return NextResponse.json({ message: retMessage }, { status: 200 })
  } catch (error) {
    console.error('Excepción error=', error)
    const sError = JSON.stringify(error, (key, value) =>
      typeof value === 'bigint' ? value.toString() + 'n' : value,
    )
    return NextResponse.json({ error: sError }, { status: 500 })
  }
}
