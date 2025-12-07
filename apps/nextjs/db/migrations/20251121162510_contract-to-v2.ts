import 'dotenv/config'
import { Kysely, sql } from 'kysely'
import type { Insertable } from 'kysely'
import type { Address } from 'viem'
import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
  formatUnits,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo, celoSepolia, base } from 'viem/chains'

import ScholarshipVaultsAbi from '../../abis/ScholarshipVaults.json' with { type: 'json' }
import Erc20Abi from '../../abis/IERC20.json' with { type: 'json' }
import LearnTGVaultsAbi from '../../abis/LearnTGVaults.json' with { type: 'json' }
import type { GuideUsuario, CourseUsuario } from '../../db/db.d.ts'

async function callWriteFun(
  publicClient: any,
  account: any,
  contractFun: any,
  contractParams: any,
  indent: any,
) {
  let sindent = indent > 0 ? ' '.repeat(indent - 1) : ''
  console.log(
    sindent,
    'Calling function',
    contractFun.name,
    'with params',
    contractParams,
  )
  let tx: Address = '0x0'
  try {
    tx = await contractFun(contractParams)
  } catch (e) {
    console.log(sindent, '* Reintentando con nonce')
    let nonce = await publicClient.getTransactionCount({
      address: account.address,
      blockTag: 'pending', // includes pending transactions
    })
    let nextNonce = nonce + 1
    console.log(sindent, 'OJO  nextNonce=', nextNonce)
    tx = await contractFun(contractParams, { account, nonce: nextNonce })
  }
  console.log(sindent, 'tx=', tx)
  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: tx,
      confirmations: 2, // Optional: number of confirmations to wait for
      timeout: 3_000, // 2 seconds
    })
    console.log(sindent, `Receipt: ${receipt}`)
  } catch (e) {
    console.error(
      sindent,
      `**No operó waitForTransactionReceipt de ${tx}, continuando`,
    )
  }
  return tx
}

export async function up(db: Kysely<any>): Promise<void> {
  // ========= CONFIGURACIÓN =========
  const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL! // ej: https://forno.celo.org o https://mainnet.base.org
  const PRIVATE_KEY = process.env.PRIVATE_KEY! as `0x${string}`
  const DEPLOYED_AT_1 = process.env.NEXT_PUBLIC_DEPLOYED_AT1! as `0x${string}`
  const DEPLOYED_AT = process.env.NEXT_PUBLIC_DEPLOYED_AT! as `0x${string}`
  const USDT_ADDRESS = process.env.NEXT_PUBLIC_USDT_ADDRESS!
  const NETWORK = process.env.NEXT_PUBLIC_NETWORK!

  const publicClient = createPublicClient({
    chain: NETWORK == 'celo' ? celo : celoSepolia,
    transport: http(RPC_URL),
  })

  const account = privateKeyToAccount(PRIVATE_KEY as Address)
  //console.log("OJO account=", account)

  const walletClient = createWalletClient({
    account,
    chain: NETWORK == 'celo' ? celo : celoSepolia,
    transport: http(RPC_URL),
  })
  //console.log("*** walletClient=", walletClient)

  console.log('Iniciando migración con viem')

  const usdtContract = getContract({
    address: process.env.NEXT_PUBLIC_USDT_ADDRESS! as Address,
    abi: Erc20Abi as any,
    client: { public: publicClient, wallet: walletClient },
  })
  const newContract = getContract({
    address: process.env.NEXT_PUBLIC_DEPLOYED_AT! as Address,
    abi: LearnTGVaultsAbi as any,
    client: { public: publicClient, wallet: walletClient },
  })
  const oldContract = getContract({
    address: process.env.NEXT_PUBLIC_DEPLOYED_AT_1! as Address,
    abi: ScholarshipVaultsAbi as any,
    client: { public: publicClient, wallet: walletClient },
  })
  //console.log("oldContract=", oldContract)
  const oldBalance =
    ((await oldContract.read.getContractUSDTBalance([])) as bigint) || 0n

  if (oldBalance > 0n) {
    console.log('1. Drenar contrato viejo')
    console.log(
      `Drenando ${formatUnits(oldBalance, 6)} USDT del contrato viejo...`,
    )
    let tx: Address = await callWriteFun(
      publicClient,
      account,
      oldContract.write.emergencyWithdraw,
      [oldBalance],
      0,
    )
    console.log('2. Transferir fondos al nuevo contrato')
    tx = await callWriteFun(
      publicClient,
      account,
      usdtContract.write.transfer,
      [DEPLOYED_AT, oldBalance],
      0,
    )
    console.log(`Fondos transferidos al nuevo contrato: ${tx}`)
  }

  console.log('3. Recrear bovedas')
  const courses = await db
    .selectFrom('cor1440_gen_proyectofinanciero')
    .select(['id'])
    .execute()

  for (const c of courses) {
    console.log('Curso ', c.id)
    const courseId = BigInt(c.id)
    const lOldVault: any = await oldContract.read.vaults([courseId])
    const oldVault = {
      courseId: lOldVault[0],
      balance: lOldVault[1],
      amountPerGuide: lOldVault[2],
      exists: lOldVault[3],
    }
    console.log("oldVault=", oldVault)
    let lNewVault: any = await newContract.read.vaults([courseId])
    let newVault = {
      courseId: lNewVault[0],
      balanceUsdt: lNewVault[1],
      balanceCcop: lNewVault[2],
      balanceGooddollar: lNewVault[3],
      amountPerGuide: lNewVault[4],
      exists: lNewVault[5],
    }
    console.log("newVault=", newVault)
    if (oldVault.exists && !newVault.exists) {
      console.log('  Creando boveda como', oldVault)
      //if (oldVault.courseId == 103) {
        // temporal
        //oldVault.amountPerGuide = 1000000
      //}
      let tx: Address = await callWriteFun(
        publicClient,
        account,
        newContract.write.createVault,
        [courseId, oldVault.amountPerGuide],
        2,
      )
      lNewVault = await newContract.read.vaults([courseId])
      newVault = {
        courseId: lNewVault[0],
        balanceUsdt: lNewVault[1],
        balanceCcop: lNewVault[2],
        balanceGooddollar: lNewVault[3],
        amountPerGuide: lNewVault[4],
        exists: lNewVault[5],
      }
      console.log('newVault=', newVault)

      console.log(`Vault creado: ${newVault.courseId}`)
    }

    if (oldVault.exists && newVault.exists) {
      console.log('  newVault.balanceUsdt=', newVault.balanceUsdt)
      if (oldVault.balance > 0n && newVault.balanceUsdt == 0n) {
        console.log('Setting balance to', oldVault.balance)
        let tx = await callWriteFun(
          publicClient,
          account,
          newContract.write.setVaultBalance,
          [courseId, oldVault.balance],
          4,
        )
      }
      const uwallets = await db
        .selectFrom('billetera_usuario')
        .select(['usuario_id', 'billetera'])
        .execute()
      console.log('  Cantidad de billeteras=', uwallets.length)
      for (const uw of uwallets) {
        console.log('  Billetera', uw.billetera)
        let guiasCompletadas = 0
        const guides = await sql<any>`
          SELECT id, nombrecorto, "sufijoRuta"
          FROM cor1440_gen_actividadpf
          WHERE proyectofinanciero_id = ${c.id}
          AND "sufijoRuta" IS NOT NULL
          AND "sufijoRuta" <> ''
          ORDER BY nombrecorto
        `.execute(db)
        //console.log("guides=", guides)
        console.log('  Curso', courseId, ' con', guides.rows.length, 'guias')
        let numGuia = 0
        for (const g of guides.rows as any[]) {
          numGuia++
          console.log('    Guía ', g.nombrecorto)
          const oldGuidePaid = await oldContract.read.guidePaid([
            courseId,
            numGuia,
            uw.billetera,
          ])
          console.log('      ** oldGuidePaid=', oldGuidePaid)
          if (oldGuidePaid) {
            console.log(
              '      Registrando pago de guía por',
              formatUnits(oldVault.amountPerGuide, 6),
              'USDT',
            )
            const ug = await db
              .selectFrom('guide_usuario')
              .select(['usuario_id'])
              .where('usuario_id', '=', uw.usuario_id)
              .where('actividadpf_id', '=', g.id)
              .execute()
            if (ug.length == 0) {
              guiasCompletadas++
              let gp: Insertable<GuideUsuario> = {
                usuario_id: uw.usuario_id,
                actividadpf_id: g.id,
                amountpaid: oldVault.amountPerGuide.toString(),
                profilescore: 0,
                points: 1,
              }
              let igp = await db
                .insertInto('guide_usuario')
                .values(gp)
                .returningAll()
                .executeTakeFirstOrThrow()
              console.log('    After insert igp.amountpaid=', igp.amountpaid)
            }
            const newGuidePaid = (await newContract.read.guidePaid([
              courseId,
              numGuia,
              uw.billetera,
            ])) as bigint
            if (newGuidePaid == 0n) {
              console.log('    Registrando en blockchain')
              let tx = await callWriteFun(
                publicClient,
                account,
                newContract.write.setGuidePaid,
                [courseId, numGuia, uw.billetera, oldVault.amountPerGuide],
                4,
              )
            }
          }
        }
        if (guides.rows.length > 0 && guiasCompletadas == guides.rows.length) {
          let cp: Insertable<CourseUsuario> = {
            usuario_id: uw.usuario_id,
            proyectofinanciero_id: c.id,
            points: 2,
          }
          let icp = await db
            .insertInto('course_usuario')
            .values(cp)
            .returningAll()
            .executeTakeFirstOrThrow()
          console.log('After insert icp=', icp)
        }
      }
    }
  }
  console.log('¡MIGRACIÓN COMPLETA!')
}

export async function down(db: Kysely<any>): Promise<void> {
  // console.error("Irreversible migration")
  // process.exit(1)
}
