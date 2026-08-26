
// Crossword submission pipeline:
// 1. Validate inputs (courseId, guideId, wallet, token, grid, placements).
// 2. Verify wallet + token match billetera_usuario record.
// 3. Compare each placement against answer_fib (from Rails backend),
//    tracking mistakes per word.
// 4. Record game_complete event with score and elapsed time.
// 5. If correct: insert/update guide_usuario point, recalculate scores
//    (updateUserAndCoursePoints), record course_progress/guide_complete.
// 6. Submit result to smart contract via callWriteFun (nonce retry logic).
// 7. If contract pays: insert transaction record, update amountpaid.
// 8. Return mistakes array, message text (i18n: es/en), and tx hash.

import { Kysely, sql } from 'kysely'
import type { Insertable } from 'kysely'
import { NextRequest, NextResponse } from 'next/server'
import type { RewardsDeps } from '../index'
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

import LearnTGVaultsV3Abi from '../abis/LearnTGVaultsV3.json'
import LearnTGVaultsV5Abi from '../abis/LearnTGVaultsV5.json'
import { callWriteFun } from '../lib/crypto'
import { IS_PRODUCTION } from '../lib/config'
import { mintCourseCredential } from '../lib/credentials'
import { getActiveVault, type VaultVersion } from '../lib/deployments'

interface WordPlacement {
  word: string
  row: number
  col: number
  direction: 'across' | 'down'
  number: number
  clue: string
}

export async function checkCrosswordGet(): Promise<Response> {
  return NextResponse.json({ error: 'Expecting POST request' }, { status: 400 })
}

export async function checkCrosswordPost(deps: RewardsDeps, req: NextRequest) {

  const removeAccents = (s: string) =>
    s
      .replace(/á/gi, 'A')
      .replace(/é/gi, 'E')
      .replace(/í/gi, 'I')
      .replace(/ó/gi, 'O')
      .replace(/ú/gi, 'U')
      .replace(/ü/gi, 'U')

  try {
    const mistakesInCW: number[] = []
    let retMessage = ''
    let scholarshipResult: any = null
    let credentialMinted = false
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
          'No se enviaron resultados al blockchain. Necesita al menos 50 puntos en su perfil para recibir beca',
        cannotSubmit:
          'Estás es un periodo de espera de 24 horas desde tu último envío para este curso. No puedes enviar resultado para beca en este momento.',
        contractError: 'No se pudo conectar con el contrato de becas.',
        correctPoint: '¡Respuesta correcta! ',
        correct:
          'Se ha enviado tu resultado para beca, por favor espera 24 horas antes de volver a enviar para este curso.',
        incorrect:
          'Respuesta equivocada. Corrige y vuelve a intentar.',
        noWallet: 'La respuesta no será calificada ni se buscarán becas posibles.',
        submitError: 'Error al enviar el resultado a la blockchain: ',
        userNotFound: 'No se encontró el usuario para la billetera.',
        tokenMismatch: 'El token almacenado para el usuario no coincide con el token proporcionado.',
        youReceived: "Recibiste",
        youReceivedSLEARN: "Recibiste",
        scholarshipPaid: 'Ambas becas ya fueron pagadas para esta guía.',
        invalidCourse: 'ID de curso inválido',
        invalidGuide: 'ID de guía inválido',
        invalidToken: 'Token inválido',
        invalidGrid: 'Estructura de cuadrícula inválida',
        invalidPlacements: 'Estructura de colocaciones inválida',
      },
      en: {
        atLeast50:
          'The results were not sent to the blockchain. You need at least 50 points in your profile to receive scholarship',
        cannotSubmit:
          'You are in a waiting period of 24 hours since your last submission. You cannot submit a scholarship result at this time.',
        contractError: 'Could not connect to scholarship contract.',
        correct:
          'Your result has been submitted for scholarship, please waith 24 hours before submitting again answers for this course.',
        correctPoint: 'Correct answer! ',
        incorrect:
          "\nWrong answer. Correct your answers and try again.",
        noWallet: 'Your answer will not be graded nor will possible scholarships be sought.',
        submitError: 'Error submitting result to the blockchain: ',
        userNotFound: 'User not found for wallet.',
        tokenMismatch: "Token stored for user doesn't match given token.",
        youReceived: "You received",
        youReceivedSLEARN: "You received",
        scholarshipPaid: 'Both scholarships already paid for this guide.',
        invalidCourse: 'Invalid course ID',
        invalidGuide: 'Invalid guide ID',
        invalidToken: 'Invalid token',
        invalidGrid: 'Invalid grid structure',
        invalidPlacements: 'Invalid placements structure',
      },
    }

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

    const db = deps.db()

    const auth = await deps.authenticateUser(db, walletAddress, token)
    if (!auth) {
      if (!walletAddress) {
        return NextResponse.json({ error: msg[locale].noWallet }, { status: 400 });
      }
      return NextResponse.json({ error: msg[locale].tokenMismatch }, { status: 401 });
    }
    const { usuario, billetera: billeteraUsuario } = auth

    const words = billeteraUsuario.answer_fib
      ? billeteraUsuario.answer_fib.split(' | ')
      : []
    for (let i = 0; i < words.length; i++) {
      let nrow = placements[i].row
      let ncol = placements[i].col
      const dir = placements[i].direction
      const word = words[i]
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

    // Find most recent game_start event to calculate elapsed time
    const gameStartEvent = await db
      .selectFrom('userevent')
      .where('usuario_id', '=', usuario.id)
      .where('event_type', '=', 'game_start')
      .where(sql`event_data->>'gameType'`, '=', 'crossword')
      .orderBy('created_at', 'desc')
      .select(['created_at'])
      .executeTakeFirst()

    const now = new Date()
    let timeMs = 0
    if (gameStartEvent?.created_at) {
      timeMs = now.getTime() - new Date(gameStartEvent.created_at).getTime()
    }

    // Record game completion event
    try {
      await deps.recordEvent({
        event_type: 'game_complete',
        event_data: {
          gameType: 'crossword',
          score: mistakesInCW.length == 0 ? 1 : 0,
          timeMs: timeMs,
        },
        usuario_id: usuario.id,
      })
    } catch (error) {
      console.error('Failed to record game_complete event:', error)
    }
    const guides = await sql<any>`
      SELECT id, nombrecorto, "sufijoRuta", proyectofinanciero_id
      FROM cor1440_gen_actividadpf
      WHERE proyectofinanciero_id = ${courseId}
      AND "sufijoRuta" IS NOT NULL
      AND "sufijoRuta" <> ''
      ORDER BY nombrecorto
    `.execute(db)
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

    // --- Blockchain client setup (needed by credential minting and contract interaction) ---
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL
    const publicClient = createPublicClient({
      chain: IS_PRODUCTION ? celo : celoSepolia,
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
      chain: IS_PRODUCTION ? celo : celoSepolia,
      transport: http(rpcUrl),
    })

    if (mistakesInCW.length == 0) {
      let gUsuario: any;
      if (ug.length == 0) {
        const gp: Insertable<any> = {
          usuario_id: billeteraUsuario.usuario_id,
          actividadpf_id: actividadpfId,
          amountpaid: 0,
          profilescore: usuario.profilescore || 0,
          points: 1
        }
        gUsuario = await db
        .insertInto('guide_usuario')
        .values(gp)
        .returningAll()
        .executeTakeFirstOrThrow()
      } else {
        await db.updateTable('guide_usuario')
          .set({ points: 1 })
          .where('usuario_id', '=', billeteraUsuario.usuario_id)
          .where('actividadpf_id', '=', actividadpfId)
          .execute();
        gUsuario = await db.selectFrom('guide_usuario').where('usuario_id', '=', billeteraUsuario.usuario_id).where('actividadpf_id', '=', actividadpfId).selectAll().executeTakeFirstOrThrow();
      }
      retMessage += msg[locale].correctPoint
      await deps.updateUserAndCoursePoints(db, usuario, courseId, walletAddress, gUsuario)
      
      // Record guide completion event
      try {
        await deps.recordEvent({
          event_type: 'guide_complete',
          event_data: {
            guideId: guideId,
            courseId: courseId,
            correct: true,
          },
          usuario_id: usuario.id,
        })
      } catch (error) {
        console.error('Failed to record guide_complete event:', error)
      }

      // --- Credential minting: check if course 100% completed ---
      try {
        const totalPublished = guides.rows.length
        const completedGuides = await db
          .selectFrom('guide_usuario')
          .select(db.fn.countAll<number>().as('count'))
          .where('usuario_id', '=', billeteraUsuario.usuario_id)
          .where('actividadpf_id', 'in',
            guides.rows.map((r: any) => r.id)
          )
          .where('points', '=', 1)
          .executeTakeFirst()

        const completedCount = completedGuides?.count || 0
        console.log(`[credential] course=${courseId} user=${billeteraUsuario.usuario_id} completed=${completedCount}/${totalPublished} wallet=${walletAddress}`)
        if (completedCount >= totalPublished && totalPublished > 0) {
          console.log(`[credential] 100% reached, attempting mint for course=${courseId}`)
          try {
            const result = await mintCourseCredential(
              db,
              billeteraUsuario.usuario_id,
              courseId,
              walletAddress,
            )
            if (result) {
              console.log(`[credential] ✓ Minted: user=${billeteraUsuario.usuario_id} course=${courseId} tokenId=${result.tokenId} tx=${result.txHash.slice(0, 10)}...`)
              credentialMinted = true
            } else {
              console.log(`[credential] ⊘ Skipped (already emitted or not registered): user=${billeteraUsuario.usuario_id} course=${courseId}`)
            }
          } catch (err: any) {
            console.error(`[credential] ✗ Mint failed: user=${billeteraUsuario.usuario_id} course=${courseId}`, err?.message || err)
          }
        } else {
          console.log(`[credential] Not at 100% yet: ${completedCount}/${totalPublished}`)
        }
      } catch (error: any) {
        console.error(`[credential] Section error:`, error?.message || error)
      }
    }

    // Vaults migration guard
    if (process.env.NEXT_PUBLIC_LEARNTG_VAULTS_READONLY === '1') {
      return NextResponse.json(
        { error: 'Vaults migration in progress. Try again in a few minutes.' },
        { status: 503 }
      )
    }

    // Get active vault (latest version: V5 if deployed, else V4)
    const { address: contractAddress, version: vaultVersion } = await getActiveVault()
    const vaultAbi = vaultVersion === 'V5' ? (LearnTGVaultsV5Abi as any) : (LearnTGVaultsV3Abi as any)
    const isV5 = vaultVersion === 'V5'

    if (contractAddress) {
      const vaultContract = getContract({
        address: contractAddress,
        abi: vaultAbi,
        client: { public: publicClient, wallet: walletClient },
      })
      const courseIdArg = BigInt(courseId)
      const guideIdArg = BigInt(actividadpfId)
      const vaultArray: any = await vaultContract.read.vaults(
        [courseIdArg]
      )
      const vault = {
        courseId: Number(vaultArray[0]),
        balanceUsdt: Number(vaultArray[1]),
        balanceSlearn: Number(vaultArray[2]),
        amountPerGuideUsdt: Number(vaultArray[3]),
        amountPerGuideSlearn: Number(vaultArray[4]),
        exists: Boolean(vaultArray[5]),
      }
      if (vault.exists) {
        const canSubmit = (await vaultContract.read.studentCanSubmit([
          courseIdArg,
          walletAddress as Address,
        ])) as boolean
        if (usuario.profilescore == null || usuario.profilescore < 50) {
          retMessage += msg[locale].atLeast50
        } else if (canSubmit) {
          try {
            // Read status BEFORE payment to calculate delta
            const statusBefore: any = await vaultContract.read.getStudentGuideStatus([
              courseIdArg,
              guideIdArg,
              walletAddress as Address,
            ])
            const paidUSDTBefore = BigInt(statusBefore[0])
            const paidSlearnBefore = BigInt(statusBefore[1])

            // Safety net: check DB if both already paid, skip on-chain call
            if (mistakesInCW.length == 0) {
              const dbUSDT = await db.selectFrom('transaction')
                .select(db.fn.countAll<number>().as('c'))
                .where('usuario_id', '=', billeteraUsuario.usuario_id)
                .where('crypto', '=', 'usdt')
                .where('type', '=', 'scholarship')
                .where(sql`metadata->>'guideId'`, '=', String(actividadpfId))
                .executeTakeFirst()
              const dbSLEARN = await db.selectFrom('transaction')
                .select(db.fn.countAll<number>().as('c'))
                .where('usuario_id', '=', billeteraUsuario.usuario_id)
                .where('crypto', '=', 'slearn')
                .where('type', '=', 'scholarship')
                .where(sql`metadata->>'guideId'`, '=', String(actividadpfId))
                .executeTakeFirst()
              const bothPaidInDB = (dbUSDT && dbUSDT.c > 0) && (dbSLEARN && dbSLEARN.c > 0)
              if (bothPaidInDB && paidUSDTBefore > 0n && paidSlearnBefore > 0n) {
                console.log(`Skipping payScholarship: both already paid for user=${billeteraUsuario.usuario_id} guide=${actividadpfId}`)
                retMessage += '\n' + msg[locale].scholarshipPaid
                return NextResponse.json({ message: retMessage, mistakesInCW, scholarshipResult: null, alreadyPaid: true }, { status: 200 })
              }
            }

            // GD course scholarship routing (10% to cluster/country fund via ClusterFunds)
            let learnTgAddr: Address = '0x0000000000000000000000000000000000000000' as Address
            let learnTgUSDT = 0n
            let learnTgSlearn = 0n
            let gdCtx: any = null
            if (isV5) {
              const fullUSDT = BigInt(vault.amountPerGuideUsdt)
              const fullSlearn = BigInt(vault.amountPerGuideSlearn)
              const score = BigInt(usuario.profilescore || 0)
              const scholarUSDT = (fullUSDT * score) / 100n
              const scholarSlearn = (fullSlearn * score) / 100n
              // Hook §5.4: resuelve si el curso es GD y el split (10%) al fund.
              gdCtx = {
                db,
                usuarioId: usuario.id,
                courseId,
                usdtAmount: scholarUSDT,
                slearnAmount: scholarSlearn,
              }
              await deps.routeReward(gdCtx)
              if (gdCtx.destino) {
                learnTgUSDT = gdCtx.gdUsdtAmount ?? 0n
                learnTgSlearn = gdCtx.gdSlearnAmount ?? 0n
                learnTgAddr = gdCtx.gdAddr ?? ('0x0000000000000000000000000000000000000000' as Address)
              }
            }

            const tx: Address = await callWriteFun(
              publicClient,
              account,
              vaultContract.write.payScholarship,
              isV5
                ? [
                    courseIdArg,
                    guideIdArg,
                    walletAddress as Address,
                    mistakesInCW.length == 0,
                    usuario.profilescore || 0,
                    '0x0000000000000000000000000000000000000000' as Address, // referrer (TODO: #163)
                    0n,  // referrerUSDT
                    0n,  // referrerSlearn
                    learnTgAddr,
                    learnTgUSDT,
                    learnTgSlearn
                  ]
                : [
                    courseIdArg,
                    guideIdArg,
                    walletAddress as Address,
                    mistakesInCW.length == 0,
                    usuario.profilescore || 0,
                  ],
            )
            // Record cooldown start event
            try {
              await deps.recordEvent({
                event_type: 'cooldown_start',
                event_data: {
                  courseId: courseId,
                  guideId: guideId,
                },
                usuario_id: usuario.id,
              })
            } catch (error) {
              console.error('Failed to record cooldown_start event:', error)
            }
            // VERIFY AND RECORD AMOUNT — read status AFTER payment, compute delta
            const statusAfter: any = await vaultContract.read.getStudentGuideStatus([
              courseIdArg,
              guideIdArg,
              walletAddress as Address,
            ])
            const paidUSDTAfter = BigInt(statusAfter[0])
            const paidSlearnAfter = BigInt(statusAfter[1])

            scholarshipResult = tx
            const paidUSDT = paidUSDTAfter - paidUSDTBefore
            const paidSlearn = paidSlearnAfter - paidSlearnBefore

            if (mistakesInCW.length == 0) {
              retMessage += '\n' + msg[locale].correct

              if (paidUSDT > 0 || paidSlearn > 0) {
                const usdtDecimals = +(process.env.NEXT_PUBLIC_USDT_DECIMALS || 6)
                const slearnDecimals = 2

                await db.transaction().execute(async (trx) => {
                  if (paidUSDT > 0) {
                    const usdtAmount = parseFloat(formatUnits(paidUSDT, usdtDecimals))
                    await trx.insertInto('transaction').values({
                      usuario_id: usuario.id,
  date: new Date(),
                      type: 'scholarship',
                      crypto: 'usdt',
                      amount: usdtAmount,
                      balance_impact: usdtAmount,
                      hash: tx,
                      wallet: walletAddress,
                      metadata: { courseId: courseId, guideId: actividadpfId }
                    }).execute()
                    retMessage += '\n' + msg[locale].youReceived + ' ' + usdtAmount.toFixed(2) + ' USDT'
                  }

                  if (paidSlearn > 0) {
                    const slearnAmount = parseFloat(formatUnits(paidSlearn, slearnDecimals))
                    await trx.insertInto('transaction').values({
                      usuario_id: usuario.id,
  date: new Date(),
                      type: 'scholarship',
                      crypto: 'slearn',
                      amount: slearnAmount,
                      balance_impact: slearnAmount,
                      hash: tx,
                      wallet: walletAddress,
                      metadata: { courseId: courseId, guideId: actividadpfId }
                    }).execute()
                    retMessage += '\n' + msg[locale].youReceivedSLEARN + ' ' + slearnAmount.toFixed(2) + ' SLEARN'
                  }

                  // GD course: auto-route 10% to cluster/country fund via ClusterFunds
                  if (learnTgUSDT > 0n || learnTgSlearn > 0n) {
                    try {
                      const destino = gdCtx?.destino
                      const usdtAddr = (await vaultContract.read.usdtToken()) as Address
                      const slearnAddr = (await vaultContract.read.slearnToken()) as Address
                      await deps.routeToClusterFunds(publicClient, walletClient, account, tx, destino, learnTgUSDT, learnTgSlearn, usdtAddr, slearnAddr)
                    } catch (e: any) {
                      console.error(`[gd] Auto-route failed: ${e?.shortMessage || e?.message || e}`)
                      await sql`
                        INSERT INTO admin_solves (type, metadata)
                        VALUES ('gd_cluster_transfer', ${JSON.stringify({
                          txHash: tx, courseId, guideId: actividadpfId,
                          usuarioId: usuario.id,
                          learnTgUSDT: learnTgUSDT.toString(),
                          learnTgSlearn: learnTgSlearn.toString(),
                        })}::jsonb)
                      `.execute(trx)
                    }
                  }

                  const totalPaidAmount = paidUSDTAfter > 0n
                    ? paidUSDTAfter.toString()
                    : paidSlearnAfter.toString()
                  await trx
                    .updateTable('guide_usuario')
                    .set({ amountpaid: Number(totalPaidAmount) })
                    .where('usuario_id', '=', billeteraUsuario.usuario_id)
                    .where('actividadpf_id', '=', actividadpfId)
                    .execute()
                })
              }

            } else {
              retMessage += '\n' + msg[locale].incorrect
              if (paidUSDT > 0 || paidSlearn > 0) {
                console.log("*** PROBLEM: payment was made for incorrect answer, tx=", tx)
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

    return NextResponse.json(
      {
        mistakesInCW: mistakesInCW,
        credentialMinted,
        credentialUserId: credentialMinted ? billeteraUsuario.usuario_id : null,
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
