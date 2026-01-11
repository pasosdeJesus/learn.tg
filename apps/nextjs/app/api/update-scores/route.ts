'use server'

import { IdentitySDK } from '@goodsdks/citizen-sdk'
import { Kysely, sql} from 'kysely'
import type { Selectable, Updateable } from 'kysely'
import { NextRequest, NextResponse } from 'next/server'
import { privateKeyToAccount } from 'viem/accounts'
import { createPublicClient, createWalletClient, Hex, http } from 'viem'
import { celo, celoSepolia } from 'viem/chains'

import { newKyselyPostgresql } from '@/.config/kysely.config'
import { updateUserAndCoursePoints } from '@/lib/scores'
import type { DB, Usuario, CourseUsuario } from '@/db/db.d'


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

    // Localized messages
    const msg = {
      es: {
        noWallet: 'La respuesta no será calificada.',
        tokenMismatch: 'El token no coincide con el esperado.',
        userNotFound: 'Usuario no encontrado',
        serverError: 'Error del servidor.',
      },
      en: {
        noWallet: 'Your answer will not be graded.',
        tokenMismatch: "Token doesn't match expected.",
        userNotFound: 'User not found',
        serverError: 'Server error.',
      },
    }
    const locale = lang === 'es' ? 'es' : 'en'

    if (!walletAddress) {
      retMessage += '\n' + msg[locale].noWallet
      return NextResponse.json({ message: retMessage }, { status: 400 })
    }

    const billeteraUsuario = await db
      .selectFrom('billetera_usuario')
      .where('billetera', '=', walletAddress)
      .selectAll()
      .executeTakeFirst()

    if (!billeteraUsuario || billeteraUsuario.token !== token) {
      retMessage += '\n' + msg[locale].tokenMismatch
      return NextResponse.json({ message: retMessage }, { status: 401 })
    }

    const usuario = await db
      .selectFrom('usuario')
      .where('id', '=', billeteraUsuario.usuario_id)
      .selectAll()
      .executeTakeFirst()

    if (!usuario) {
      retMessage += '\n' + msg[locale].userNotFound
      return NextResponse.json({ message: retMessage }, { status: 404 })
    }

    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL
    const chain = process.env.NEXT_PUBLIC_NETWORK === 'celo' ? celo : celoSepolia

    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    })
    const privateKey = process.env.PRIVATE_KEY as Hex | undefined
    if (!privateKey) {
      console.error('CRITICAL: PRIVATE_KEY is not set')
      throw new Error(msg[locale].serverError)
    }

    const account = privateKeyToAccount(privateKey)
    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
    })

    let whitelisted = false
    if (process.env.NEXT_PUBLIC_NETWORK === 'celo') {
      const identitySDK = new IdentitySDK(publicClient as any, walletClient as any, 'production')
      if (identitySDK) {
        const { isWhitelisted, root } = await identitySDK.getWhitelistedRoot(walletAddress)
        console.log("root=", root, ", walletAddress=", walletAddress)
        if (root != "" && 
            root.toLowerCase() != walletAddress.toLowerCase()) {
          retMessage += '\n' + "Please  use your root goodDollar wallet"
          console.log(retMessage)
        } else  if (root != "" && 
            root.toLowerCase() == walletAddress.toLowerCase() &&
                   isWhitelisted) {
            whitelisted = true
        }
      } else {
        console.warn('IdentitySDK is null')
      }
    } else {
      // Gooddollar doesn't work in testnet, so we assume whitelisted
      whitelisted = true
    }

    // 1. Calculate Profile Score
    let profilescore = 0
    if (whitelisted || usuario.passport_name) {
      profilescore += 52
    }
    if (usuario.passport_name) {
      profilescore += 24
    }
    if (usuario.passport_nationality) {
      profilescore += 24
    }

    const uUsuario: Updateable<Usuario> = {
      lastgooddollarverification: whitelisted ? new Date() : null,
      profilescore: profilescore,
      updated_at: new Date(),
    }
    await db.updateTable('usuario')
      .set(uUsuario)
      .where('id', '=', usuario.id).execute()

    const learningscore = await updateUserAndCoursePoints(
      db,
      usuario,
      null
    )

    console.log('Scores updated successfully.')
    return NextResponse.json(
      {
        message: retMessage,
        profilescore: profilescore,
        learningscore: learningscore,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Exception in update-scores:', error)
    const sError = String(error)
    return NextResponse.json({ error: sError }, { status: 500 })
  }
}
