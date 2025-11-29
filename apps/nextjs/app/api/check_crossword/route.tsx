'use server'

import { Kysely, sql } from 'kysely'
import type { Insertable } from 'kysely'
import { NextRequest, NextResponse } from 'next/server'
import { privateKeyToAccount } from 'viem/accounts'
import {
  Address,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  getContract,
  Hex,
  http,
} from 'viem'
import { celo, celoSepolia } from 'viem/chains'
import { getReferralTag, submitReferral } from '@divvi/referral-sdk'

import LearnTGVaultsAbi from '@/abis/LearnTGVaults.json'
import { newKyselyPostgresql } from '@/.config/kysely.config.ts'
import type { GuideUsuario, CourseUsuario } from '@/db/db.d.ts'

interface WordPlacement {
  word: string
  row: number
  col: number
  direction: 'across' | 'down'
  number: number
  clue: string
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ error: 'Expecting POST request' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  console.log('** OJO check_crossword POST')

  const removeAccents = (s: string) =>
    s
      .replace('á', 'A')
      .replace('é', 'E')
      .replace('í', 'I')
      .replace('ó', 'O')
      .replace('ú', 'U')
      .replace('ü', 'U')
      .replace('Á', 'A')
      .replace('É', 'E')
      .replace('Ó', 'O')
      .replace('Ú', 'U')
      .replace('Ü', 'U')

  try {
    let mistakesInCW: number[] = []
    let retMessage = ''
    let scholarshipResult: any = null
    const requestJson = await req.json()
    const courseId = +requestJson['courseId']
    const guideId = +requestJson['guideId']
    const lang = requestJson['lang'] ?? ''
    const grid = requestJson['grid'] ?? ''
    const placements = requestJson['placements'] ?? ''
    const walletAddress = requestJson['walletAddress'] ?? ''
    const token = requestJson['token'] ?? ''

    const db = newKyselyPostgresql()

    // Mensajes localizados
    const msg = {
      es: {
        atLeast50:
          'No se enviaron resultados al blockchain. Necesita al menos 50 puntos en su perfil para habilitar el envío',
        cannotSubmit:
          'Estás es un periodo de espera de 24 horas desde tu último envío para este curso. No puedes enviar resultado para beca en este momento.',
        contractError: 'No se pudo conectar con el contrato de becas.',
        correctPoint: '¡Respuesta correcto! +1 punto',
        correct:
          '¡Respuesta correcta! Se ha enviado tu resultado para beca, por favor espera 24 horas antes de volver a enviar para este curso.',
        incorrect:
          'Respuesta equivocada. Se ha enviado tu resultado al blockchain, por favor espera 24 horas antes de volver a enviar para este curso.',
        noWallet:
          'La respuesta no será calificada ni se buscarán becas posibles.',
        submitError: 'No se pudo enviar el resultado para beca: ',
        tokenMismatch:
          'El token almacenado para el usuario no coincide con el token proporcionado.',
        userNotFound: 'No se encontró el usuario para la billetera.',
      },
      en: {
        atLeast50:
          'The results were not sent to the blockchain. You need at least 50 points in your profile to enable sending',
        cannotSubmit:
          'You are in a waiting period of 24 hours since our last submission. You cannot submit a scholarship result at this time.',
        contractError: 'Could not connect to scholarship contract.',
        correct:
          'Correct answer! Your result has been submitted for scholarship, please waith 24 hourse before submitting again answers for this course.',
        correctPoint: 'Correct answer! +1 point',
        incorrect:
          'Wrong answer. Your result has been submitted for scholarship, please waith 24 hourse before submitting again answers for this course.',
        noWallet:
          'Your answer will not be graded nor will possible scholarships be sought.',
        submitError: 'Could not submit result for scholarship: ',
        tokenMismatch: "Token stored for user doesn't match given token.",
        userNotFound: 'User not found for wallet.',
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
        let words = billeteraUsuario.answer_fib
          ? billeteraUsuario.answer_fib.split(' | ')
          : []
        for (let i = 0; i < words.length; i++) {
          let nrow = placements[i].row
          let ncol = placements[i].col
          let dir = placements[i].direction
          let word = words[i]
          for (let j = 0; j < word.length; j++) {
            if (
              nrow >= grid.length ||
              ncol >= grid[nrow].length ||
              removeAccents(grid[nrow][ncol].userInput.toUpperCase()) !=
                removeAccents(word[j].toUpperCase())
            ) {
              console.log(
                `** Reviewing answer, problem in word ${i + 1} in position ${j}, received ${removeAccents(grid[nrow][ncol].userInput.toUpperCase())} but expected ${removeAccents(word[j].toUpperCase())}`,
              )
              if (!mistakesInCW.includes(i + 1)) {
                mistakesInCW.push(i + 1)
              }
            }
            if (dir == 'across') {
              ncol++
            } else {
              nrow++
            }
          }
        }

        // Perfil de usuario. Punto si hacía falta y la respuesta es correcta
        let usuario = await db
          .selectFrom('usuario')
          .where('id', '=', billeteraUsuario.usuario_id)
          .selectAll()
          .executeTakeFirst()
        if (!usuario) {
          return NextResponse.json(
            { error: msg[locale].userNotFound },
            { status: 500 },
          )
        }
        console.log('OJO usuario=', usuario)
        const guides = await sql<any>`
          SELECT id, nombrecorto, "sufijoRuta"
          FROM cor1440_gen_actividadpf
          WHERE proyectofinanciero_id = ${courseId}
          AND "sufijoRuta" IS NOT NULL
          AND "sufijoRuta" <> ''
          ORDER BY nombrecorto
        `.execute(db)
        console.log('OJO guides=', guides)
        const ug = await db
          .selectFrom('guide_usuario')
          .select(['usuario_id'])
          .where('usuario_id', '=', billeteraUsuario.usuario_id)
          .where('actividadpf_id', '=', guides.rows[guideId - 1].id)
          .execute()
        if (ug.length == 0 && mistakesInCW.length == 0) {
          let gp: Insertable<GuideUsuario> = {
            usuario_id: billeteraUsuario.usuario_id,
            actividadpf_id: guides.rows[guideId - 1].id,
            amountpaid: 0,
            profilescore: usuario.profilescore || 0,
            amountpending: 0,
            points: 1,
          }
          let igp = await db
            .insertInto('guide_usuario')
            .values(gp)
            .returningAll()
            .executeTakeFirstOrThrow()
          retMessage += msg[locale].correctPoint
          console.log('      After insert igp.points=', igp.points)
        }

        // Intentamos beca
        // Lógica similar a /api/scholarship
        const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL
        const publicClient = createPublicClient({
          chain:
            process.env.NEXT_PUBLIC_AUTH_URL == 'https://learn.tg'
              ? celo
              : celoSepolia,
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
          console.error('CRITICAL: Failed to load account from private key.', e)
          throw new Error('Server configuration error.')
        }

        const walletClient = createWalletClient({
          account,
          chain:
            process.env.NEXT_PUBLIC_AUTH_URL == 'https://learn.tg'
              ? celo
              : celoSepolia,
          transport: http(rpcUrl),
        })

        const referralTag = getReferralTag({
          user: '0x358643bAdcC77Cccb28A319abD439438A57339A7',
          consumer: walletAddress,
        })
        console.log('*** referralTag=', referralTag)

        const contractAddress = process.env.NEXT_PUBLIC_DEPLOYED_AT as Address
        if (contractAddress) {
          const contract = getContract({
            address: contractAddress,
            abi: LearnTGVaultsAbi as any,
            client: { public: publicClient, wallet: walletClient },
          })
          //console.log("*** contract=", contract)
          const courseIdArg = BigInt(courseId)
          console.log('*** courseIdArg=', courseIdArg)
          const guideIdArg = BigInt(guideId)
          console.log('*** guideIdArg=', guideIdArg)
          // Existe la boveda
          const vault: any = await contract.read.vaults([courseIdArg])
          console.log('*** vault=', vault)
          if (vault[3]) {
            // vault.exists
            // Verificar si puede enviar
            const canSubmit = (await contract.read.studentCanSubmit([
              courseIdArg,
              walletAddress as Address,
            ])) as boolean
            console.log('** canSubmit=', canSubmit)
            if (usuario.profilescore == null || usuario.profilescore < 50) {
              retMessage += msg[locale].atLeast50
            } else if (canSubmit) {
              // Enviar resultado
              try {
                const encodedData = encodeFunctionData({
                  abi: LearnTGVaultsAbi,
                  functionName: 'submitGuideResult',
                  args: [
                    courseIdArg,
                    guideIdArg,
                    walletAddress as Address,
                    mistakesInCW.length == 0,
                    usuario.profilescore || 0,
                  ],
                })
                console.log('encodedData=', encodedData)
                let txData = encodedData
                if (txData && txData.length >= 10) {
                  txData += referralTag
                }
                console.log('txData=', txData)
                const tx = await walletClient.sendTransaction({
                  account,
                  to: contract.address,
                  data: txData as Hex,
                })
                console.log('tx=', tx)
                const chainId = await walletClient.getChainId()
                console.log('chainId=', chainId)

                if (chainId == 42220) {
                  // Celo mainnet
                  const sr = await submitReferral({
                    txHash: tx,
                    chainId: chainId,
                  })

                  console.log('sr=', sr)
                }

                scholarshipResult = tx
                if (mistakesInCW.length == 0) {
                  retMessage += '\n' + msg[locale].correct
                } else {
                  retMessage += '\n' + msg[locale].incorrect
                }
              } catch (err) {
                retMessage += '\n' + msg[locale].submitError + err
              }
            } else {
              retMessage += '\n' + msg[locale].cannotSubmit
            }
          } else {
            retMessage += `\nThere is not vault for the course (${courseId})`
          }
        } else {
          retMessage += '\n' + msg[locale].contractError
        }
      }
    }

    console.log('Retornando mensaje ', retMessage)
    return NextResponse.json(
      {
        mistakesInCW: mistakesInCW,
        message: retMessage,
        scholarshipResult: scholarshipResult,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Excepción error=', error)
    const sError = JSON.stringify(error, (key, value) =>
      typeof value === 'bigint' ? value.toString() + 'n' : value,
    )
    return NextResponse.json({ error: sError }, { status: 500 })
  }
}
