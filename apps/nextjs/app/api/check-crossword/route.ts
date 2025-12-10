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
  formatUnits,
  getContract,
  Hex,
  http,
} from 'viem'
import { celo, celoSepolia } from 'viem/chains'

import LearnTGVaultsAbi from '@/abis/LearnTGVaults.json'
import { newKyselyPostgresql } from '@/.config/kysely.config.ts'
import type { CourseUsuario, DB, GuideUsuario, Usuario } from '@/db/db.d.ts'
import { updateUserAndCoursePoints } from '@/lib/scores'
import { callWriteFun } from '@/lib/crypto'

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
  console.log('** OJO check-crossword POST')

  const removeAccents = (s: string) =>
    s
      .replace(/á/gi, 'A')
      .replace(/é/gi, 'E')
      .replace(/í/gi, 'I')
      .replace(/ó/gi, 'O')
      .replace(/ú/gi, 'U')
      .replace(/ü/gi, 'U')

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

    const locale = lang === 'es' ? 'es' : 'en'
    const msg = {
      es: {
        atLeast50:
          'No se enviaron resultados al blockchain. Necesita al menos 50 puntos en su perfil para habilitar el envío',
        cannotSubmit:
          'Estás es un periodo de espera de 24 horas desde tu último envío para este curso. No puedes enviar resultado para beca en este momento.',
        contractError: 'No se pudo conectar con el contrato de becas.',
        correctPoint: '¡Respuesta correcta! +1 punto. ',
        correct:
          'Se ha enviado tu resultado para beca, por favor espera 24 horas antes de volver a enviar para este curso.',
        incorrect:
          'Respuesta equivocada. Se ha enviado tu resultado al blockchain, por favor espera 24 horas antes de volver a enviar para este curso.',
        noWallet: 'La respuesta no será calificada ni se buscarán becas posibles.',
        submitError: 'Error al enviar el resultado a la blockchain: ',
        userNotFound: 'No se encontró el usuario para la billetera.',
        tokenMismatch: 'El token almacenado para el usuario no coincide con el token proporcionado.',
        youReceived: "Recibiste",
        invalidCourse: 'ID de curso inválido',
        invalidGuide: 'ID de guía inválido',
        invalidToken: 'Token inválido',
        invalidGrid: 'Estructura de cuadrícula inválida',
        invalidPlacements: 'Estructura de colocaciones inválida',
      },
      en: {
        atLeast50:
          'The results were not sent to the blockchain. You need at least 50 points in your profile to enable sending',
        cannotSubmit:
          'You are in a waiting period of 24 hours since your last submission. You cannot submit a scholarship result at this time.',
        contractError: 'Could not connect to scholarship contract.',
        correct:
          'Your result has been submitted for scholarship, please waith 24 hours before submitting again answers for this course.',
        correctPoint: 'Correct answer! +1 point. ',
        incorrect:
          "\nWrong answer. Your result has been submitted for scholarship, please waith 24 hourse before submitting again answers for this course.",
        noWallet: 'Your answer will not be graded nor will possible scholarships be sought.',
        submitError: 'Error submitting result to the blockchain: ',
        userNotFound: 'User not found for wallet.',
        tokenMismatch: "Token stored for user doesn't match given token.",
        youReceived: "You received",
        invalidCourse: 'Invalid course ID',
        invalidGuide: 'Invalid guide ID',
        invalidToken: 'Invalid token',
        invalidGrid: 'Invalid grid structure',
        invalidPlacements: 'Invalid placements structure',
      },
    }

    console.log('walletAddress=', walletAddress)
    if (!walletAddress || walletAddress == null || walletAddress == '') {
      return NextResponse.json({ error: msg[locale].noWallet}, { status: 400 });
    }

    if (!Number.isInteger(courseId) || courseId <= 0) {
      return NextResponse.json({ error: msg[locale].invalidCourse }, { status: 400 })
    }
    if (!Number.isInteger(guideId) || guideId <= 0) {
      return NextResponse.json({ error: msg[locale].invalidGuide }, { status: 400 })
    }
    if (!token || token.trim() === '') {
      return NextResponse.json({ error: msg[locale].invalidToken }, { status: 400 })
    }
    if (!grid || !Array.isArray(grid)) {
      return NextResponse.json({ error: msg[locale].invalidGrid }, { status: 400 })
    }
    if (!placements || !Array.isArray(placements)) {
      return NextResponse.json({ error: msg[locale].invalidPlacements }, { status: 400 })
    }

    const db = newKyselyPostgresql()

    let billeteraUsuario = await db
      .selectFrom('billetera_usuario')
      .where('billetera', '=', walletAddress)
      .selectAll()
      .executeTakeFirst()

    console.log('billeteraUsuario=', billeteraUsuario)
    if (!billeteraUsuario) {
      return NextResponse.json({ error: msg[locale].userNotFound }, { status: 404 });
    }

    if (billeteraUsuario.token !== token) {
        return NextResponse.json({ error: msg[locale].tokenMismatch }, { status: 401 });
    }

    let words = billeteraUsuario.answer_fib
      ? billeteraUsuario.answer_fib.split(' | ')
      : []
    console.log('words=', words)
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
    if (!guides.rows || guides.rows.length === 0) {
      return NextResponse.json({ error: msg[locale].invalidCourse }, { status: 400 })
    }
    if (guideId < 1 || guideId > guides.rows.length) {
      return NextResponse.json({ error: msg[locale].invalidGuide }, { status: 400 })
    }
    const actividadpfId = guides.rows[guideId - 1].id
    const ug = await db
      .selectFrom('guide_usuario')
      .select(['usuario_id', 'points'])
      .where('usuario_id', '=', billeteraUsuario.usuario_id)
      .where('actividadpf_id', '=', actividadpfId)
      .execute()
    if (mistakesInCW.length == 0) {
      if (ug.length == 0) {
        let gp: Insertable<GuideUsuario> = {
          usuario_id: billeteraUsuario.usuario_id,
          actividadpf_id: actividadpfId,
          amountpaid: 0,
          profilescore: usuario.profilescore || 0,
          points: 1,
        }
        let igp = await db
        .insertInto('guide_usuario')
        .values(gp)
        .returningAll()
        .executeTakeFirstOrThrow()
        console.log('      After insert igp.points=', igp.points)
      } else {
        await db.updateTable('guide_usuario')
          .set({ points: ug[0].points + 1 })
          .where('usuario_id', '=', billeteraUsuario.usuario_id)
          .where('actividadpf_id', '=', actividadpfId)
          .execute();
        console.log('      After update points=', ug[0].points + 1 )
      }
      retMessage += msg[locale].correctPoint
    }

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

    const contractAddress = process.env.NEXT_PUBLIC_DEPLOYED_AT as Address
    if (contractAddress) {
      const contract = getContract({
        address: contractAddress,
        abi: LearnTGVaultsAbi as any,
        client: { public: publicClient, wallet: walletClient },
      })
      const courseIdArg = BigInt(courseId)
      console.log('*** courseIdArg=', courseIdArg)
      const guideIdArg = BigInt(guideId)
      console.log('*** guideIdArg=', guideIdArg)
      const vaultArray: any = await contract.read.vaults(
        [courseIdArg]
      )
      const vault = {
        courseId: Number(vaultArray[0]),
        balance: Number(vaultArray[1]),
        balanceCcop: Number(vaultArray[2]),
        balanceGooddollar: Number(vaultArray[3]),
        amountPerGuide: Number(vaultArray[4]),
        exists: Boolean(vaultArray[5]),
      }
      console.log('*** vault=', vault)
      if (vault.exists) {
        const canSubmit = (await contract.read.studentCanSubmit([
          courseIdArg,
          walletAddress as Address,
        ])) as boolean
        console.log('** canSubmit=', canSubmit)
        if (usuario.profilescore == null || usuario.profilescore < 50) {
          retMessage += msg[locale].atLeast50
        } else if (canSubmit) {
          try {
            let tx: Address = await callWriteFun(
              publicClient,
              account,
              contract.write.submitGuideResult,
              [
                courseIdArg,
                guideIdArg,
                walletAddress as Address,
                mistakesInCW.length == 0,
                usuario.profilescore || 0,
              ],
              0
            )
            // VERIFICAR Y GUARDAR MONTO
            const statusArray: any = await contract.read.getStudentGuideStatus([
              courseIdArg,
              guideIdArg,
              walletAddress as Address,
            ])
            console.log("OJO statusArray=",statusArray)
            const status = {
              paidAmount: statusArray[0],
              canSubmit: statusArray[1],
            }
            scholarshipResult = tx
            console.log("OJO status=",status)
            const paidAmount = status.paidAmount

            if (mistakesInCW.length == 0) {
              retMessage += '\n' + msg[locale].correct

              if (paidAmount > 0) {
                await db
                  .updateTable('guide_usuario')
                  .set({ amountpaid: paidAmount.toString() })
                  .where('usuario_id', '=', billeteraUsuario.usuario_id)
                  .where('actividadpf_id', '=', actividadpfId)
                  .execute()
                retMessage += '\n' + msg[locale].youReceived + ' ' +
                  formatUnits(paidAmount, 6) + 'USDT'
              }

              const learningscore = await updateUserAndCoursePoints(
                db, usuario
              )

            } else {
              retMessage += '\n' + msg[locale].incorrect
              if (paidAmount > 0) {
                console.log("*** PROBLEMA GRAVE, se pago a alguine que no tenía bien la respuesta, tx=", tx)
                console.log(mistakesInCW)
              }
            }
          } catch (err) {
            console.error('Error submitting transaction:', err)
            retMessage += '\n' + msg[locale].submitError
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

    console.log('Retornando mensaje ', retMessage)
    console.log('Retornando scholarshipResult', scholarshipResult)
    return NextResponse.json(
      {
        mistakesInCW: mistakesInCW,
        message: retMessage,
        scholarshipResult: scholarshipResult,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Internal server error in check-crossword:', error)
    const errorMessage = process.env.NODE_ENV === 'development'
      ? String(error)
      : 'Internal server error'

    return NextResponse.json({
      error: errorMessage,
      errorCode: 'INTERNAL_SERVER_ERROR'
    }, {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff'
      }
    })
  }
}

