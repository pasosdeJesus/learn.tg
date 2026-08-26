
import { NextRequest, NextResponse } from 'next/server'
import { privateKeyToAccount } from 'viem/accounts'
import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  getContract,
  http,
} from 'viem'
import type { Address } from 'viem'
import { celo, celoSepolia } from 'viem/chains'
import { sql } from 'kysely'
import type { RewardsDeps } from '../index'

import LearnTGVaultsV3Abi from '../abis/LearnTGVaultsV3.json'
import LearnTGVaultsV5Abi from '../abis/LearnTGVaultsV5.json'
import { IS_PRODUCTION } from '../lib/config'
import { getActiveVault } from '../lib/deployments'

export async function scholarshipStatus(deps: RewardsDeps, req: NextRequest) {
  console.log('** scholarship GET req=', req)

  try {
    let retMessage = ''
    if (process.env.NEXT_PUBLIC_AUTH_URL === undefined) {
      retMessage += '\nNEXT_PUBLIC_AUTH_URL undefined'
    }
    try {
      await getActiveVault()
    } catch {
      retMessage += '\nNo vault deployment found'
    }
    if (process.env.PRIVATE_KEY === undefined) {
      retMessage += '\nPRIVATE_KEY undefined'
    }
    if (process.env.NEXT_PUBLIC_RPC_URL === undefined) {
      retMessage += '\nNEXT_PUBLIC_RPC_URL undefined'
    }
    let usdtDecimals = 0
    if (process.env.NEXT_PUBLIC_USDT_DECIMALS === undefined) {
      retMessage += '\nNEXT_PUBLIC_USDT_DECIMALS undefined'
    } else {
      usdtDecimals = +process.env.NEXT_PUBLIC_USDT_DECIMALS
    }

    const { searchParams } = req.nextUrl
    const courseId = searchParams.get('courseId')
    const walletAddress = searchParams.get('walletAddress')
    const token = searchParams.get('token')

    const db = deps.db()
    let courseIdNumber = NaN

    const auth = await deps.authenticateUser(db, walletAddress || '', token || '')
    const billeteraUsuario = auth?.billetera
    if (walletAddress && token && !auth) {
      retMessage += "\nAuthentication failed. "
    }

    if (courseId == null) {
      retMessage += '\nMissing courseId'
    } else {
      courseIdNumber = /^\d+$/.test(courseId) ? parseInt(courseId, 10) : NaN
      if (isNaN(courseIdNumber)) {
        retMessage += '\nWrong courseId format'
      } else {
        const course = await db
          .selectFrom('cor1440_gen_proyectofinanciero')
          .where('id', '=', courseIdNumber)
          .selectAll()
          .executeTakeFirst()
        if (!course) {
          retMessage += '\nWrong courseId'
        }
      }
    }

    let vaultCreated = false
    let vaultBalance = 0
    let vaultBalanceSlearn = 0
    let amountPerGuideSlearn = 0
    let canSubmit = false
    let amountPerGuide = 0
    let percentageCompleted = 0
    let completedGuides = 0
    let paidGuides = 0
    let totalGuides = 0
    let percentagePaid = 0
    let profileScore = 0
    let amountScholarship = 0
    let amountScholarshipSlearn = 0
    let paidGuidesUSDT = 0
    let paidGuidesSLEARN = 0

    if (
      retMessage === '' &&
      billeteraUsuario &&
      billeteraUsuario.usuario_id &&
      !isNaN(courseIdNumber)
    ) {
      try {
        const result: any = await sql`
          SELECT 
            COUNT(a.id) as total_guides,
            COUNT(CASE WHEN gu.points > 0 THEN 1 END) as completed_guides,
            COUNT(CASE WHEN gu.amountpaid > 0 THEN 1 END) as paid_guides,
            SUM(gu.amountpaid) as total_amount_paid
          FROM cor1440_gen_actividadpf AS a
          LEFT JOIN guide_usuario AS gu ON a.id = gu.actividadpf_id 
          AND gu.usuario_id = ${billeteraUsuario.usuario_id}
          WHERE a.proyectofinanciero_id = ${courseIdNumber}
          AND a."sufijoRuta" <> ''
        `.execute(db)

        if (result.rows.length > 0) {
          totalGuides = Number(result.rows[0].total_guides || 0)
          completedGuides = Number(result.rows[0].completed_guides || 0)
          paidGuides = Number(result.rows[0].paid_guides || 0)
          if (totalGuides > 0) {
            percentageCompleted = (completedGuides * 100.0) / totalGuides
            percentagePaid = (paidGuides * 100.0) / totalGuides
          } else {
            percentageCompleted = 0
            percentagePaid = 0
          }
          const totalAmountPaid = result.rows[0].total_amount_paid
          if (totalAmountPaid) {
            amountScholarship = +formatUnits(BigInt(totalAmountPaid), usdtDecimals)
          }
        }

        // Query SLEARN scholarship total from transaction table
        try {
          const slearnResult: any = await db
            .selectFrom('transaction')
            .select(db.fn.sum('amount').as('total_slearn'))
            .where('usuario_id', '=', billeteraUsuario.usuario_id)
            .where('crypto', '=', 'slearn')
            .where('type', '=', 'scholarship')
            .where(sql`metadata->>'courseId'`, '=', String(courseIdNumber))
            .executeTakeFirst()
          if (slearnResult?.total_slearn) {
            amountScholarshipSlearn = Number(slearnResult.total_slearn)
          }
        } catch (e) {
          console.error('Error fetching SLEARN scholarship total:', e)
        }

        // Count guides with USDT and SLEARN payments separately from transaction table
        try {
          const usdtCount: any = await db
            .selectFrom('transaction')
            .select(db.fn.countAll<number>().as('count'))
            .where('usuario_id', '=', billeteraUsuario.usuario_id)
            .where('crypto', '=', 'usdt')
            .where('type', '=', 'scholarship')
            .where(sql`metadata->>'courseId'`, '=', String(courseIdNumber))
            .executeTakeFirst()
          paidGuidesUSDT = usdtCount?.count || 0

          const slearnCount: any = await db
            .selectFrom('transaction')
            .select(db.fn.countAll<number>().as('count'))
            .where('usuario_id', '=', billeteraUsuario.usuario_id)
            .where('crypto', '=', 'slearn')
            .where('type', '=', 'scholarship')
            .where(sql`metadata->>'courseId'`, '=', String(courseIdNumber))
            .executeTakeFirst()
          paidGuidesSLEARN = slearnCount?.count || 0
        } catch (e) {
          console.error('Error fetching paid guide counts:', e)
        }

        const usuario = await db
          .selectFrom('usuario')
          .where('id', '=', billeteraUsuario.usuario_id)
          .select('profilescore')
          .executeTakeFirst()

        if (usuario && usuario.profilescore) {
          profileScore = usuario.profilescore
        }
      } catch (error) {
        console.error('Error fetching guide progress:', error)
      }
    }

    if (retMessage == '') {
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL
      const publicClient = createPublicClient({
        chain: IS_PRODUCTION ? celo : celoSepolia,
        transport: http(rpcUrl),
      })

      const privateKey = process.env.PRIVATE_KEY as string | undefined
      let account: ReturnType<typeof privateKeyToAccount> | undefined
      if (privateKey) {
        try {
          account = privateKeyToAccount(privateKey as Address)
        } catch (e) {
          retMessage += '\nInvalid private key'
        }
      }
      const walletClient = account
        ? createWalletClient({
            account,
            chain: IS_PRODUCTION ? celo : celoSepolia,
            transport: http(rpcUrl),
          })
        : undefined

      // Get active vault (latest version)
      const { address: contractAddress, version: vaultVersion } = await getActiveVault()
      const vaultAbi = vaultVersion === 'V5' ? (LearnTGVaultsV5Abi as any) : (LearnTGVaultsV3Abi as any)
      if (!contractAddress) {
        retMessage += '\nMissing contract address'
      } else if (walletClient) {
        const contract = getContract({
          address: contractAddress,
          abi: vaultAbi,
          client: { public: publicClient, wallet: walletClient },
        })

        const courseIdArg =
          courseId && /^\d+$/.test(courseId) ? BigInt(courseId) : courseId
        const vaultArray = (await contract.read.vaults([courseIdArg])) as any
        const vault = {
          courseId: Number(vaultArray[0]),
          preBalanceUsdt: Number(vaultArray[1]),
          preBalanceSlearn: Number(vaultArray[2]),
          preAmountPerGuideUsdt: Number(vaultArray[3]),
          preAmountPerGuideSlearn: Number(vaultArray[4]),
          exists: Boolean(vaultArray[5]),
        }

        if (vault && vault.exists) {
          vaultCreated = true
          vaultBalance = +formatUnits(BigInt(vault.preBalanceUsdt), usdtDecimals)
          vaultBalanceSlearn = +formatUnits(BigInt(vault.preBalanceSlearn), 2)
          if (
            vault.preAmountPerGuideUsdt > 0 &&
            vault.preBalanceUsdt >= vault.preAmountPerGuideUsdt
          ) {
            amountPerGuide = +formatUnits(
              BigInt(vault.preAmountPerGuideUsdt),
              usdtDecimals,
            )
          }
          if (
            vault.preAmountPerGuideSlearn > 0 &&
            vault.preBalanceSlearn >= vault.preAmountPerGuideSlearn
          ) {
            amountPerGuideSlearn = +formatUnits(BigInt(vault.preAmountPerGuideSlearn), 2)
          }
          if ((amountPerGuide > 0 || amountPerGuideSlearn > 0) && walletAddress) {
            canSubmit = (await contract.read.studentCanSubmit([
              courseIdArg,
              walletAddress as Address,
            ])) as boolean
          }
        }
      }
    }

    const GD_COURSE_IDS = [10, 11]
    const isGDCourse = courseId != null && GD_COURSE_IDS.includes(Number(courseId))

    return NextResponse.json(
      {
        courseId: courseId == null ? 0 : Number(courseId),
        totalGuides: totalGuides,
        vaultCreated: vaultCreated,
        amountPerGuide: isGDCourse ? amountPerGuide * 0.9 : amountPerGuide,
        vaultBalance: vaultBalance,
        vaultBalanceSlearn: vaultBalanceSlearn,
        amountPerGuideSlearn: isGDCourse ? amountPerGuideSlearn * 0.9 : amountPerGuideSlearn,
        profileScore: profileScore,
        canSubmit: canSubmit,
        completedGuides: completedGuides,
        paidGuides: paidGuides,
        paidGuidesUSDT: paidGuidesUSDT,
        paidGuidesSLEARN: paidGuidesSLEARN,
        percentageCompleted: percentageCompleted,
        percentagePaid: percentagePaid,
        amountScholarship: amountScholarship,
        amountScholarshipSlearn: amountScholarshipSlearn,
        message: retMessage,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Excepción error=', error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
