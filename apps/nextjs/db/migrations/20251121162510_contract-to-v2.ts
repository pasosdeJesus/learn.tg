import 'dotenv/config'
import { Kysely, PostgresDialect, sql } from 'kysely'
import type { Insertable } from 'kysely'
import pg from 'pg'
import type { Address } from 'viem';
import { 
  createPublicClient, 
  createWalletClient, 
  getContract,
  http,
  parseUnits,
  formatUnits 
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo, celoSepolia, base } from 'viem/chains' // o la chain que uses

import ScholarshipVaultsV1Abi from 
  '../../abis/ScholarshipVaults-v1.json' with { type: "json" }
import Erc20Abi from 
  '../../abis/IERC20.json' with { type: "json" }
import LearnTGVaultsAbi from 
  '../../abis/LearnTGVaults.json' with { type: "json" }
import { newKyselyPostgresql } from '../../.config/kysely.config.ts'
import type { GuidepaidUsuario, CoursecompletedUsuario } from 
  '../../db/db.d.ts';


export async function up(db: Kysely<any>): Promise<void> {

  // ========= CONFIGURACIÓN =========
  const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL! // ej: https://forno.celo.org o https://mainnet.base.org
  const PRIVATE_KEY = process.env.PRIVATE_KEY! as `0x${string}`
  const DEPLOYED_AT_1 = process.env.NEXT_PUBLIC_DEPLOYED_AT1! as `0x${string}`
  const DEPLOYED_AT= process.env.NEXT_PUBLIC_DEPLOYED_AT! as `0x${string}`
  const USDT_ADDRESS = process.env.NEXT_PUBLIC_USDT_ADDRESS!
  const NETWORK = process.env.NEXT_PUBLIC_NETWORK!

  const publicClient = createPublicClient({
    chain: NETWORK == "celo" ? celo : celoSepolia,
    transport: http(RPC_URL),
  })

  const account = privateKeyToAccount(PRIVATE_KEY as Address)
  //console.log("OJO account=", account)

  const walletClient = createWalletClient({
    account,
    chain: NETWORK == "celo" ? celo : celoSepolia,
    transport: http(RPC_URL)
  })
  //console.log("*** walletClient=", walletClient)
  
  console.log('Iniciando migración con viem')

  const usdtContract = getContract({
    address: process.env.NEXT_PUBLIC_USDT_ADDRESS! as Address,
    abi: Erc20Abi as any,
    client: { public: publicClient, wallet: walletClient }
  })
  const newContract = getContract({
    address: process.env.NEXT_PUBLIC_DEPLOYED_AT! as Address,
    abi: LearnTGVaultsAbi as any,
    client: { public: publicClient, wallet: walletClient }
  })
  const oldContract = getContract({
    address: process.env.NEXT_PUBLIC_DEPLOYED_AT_1! as Address,
    abi: ScholarshipVaultsV1Abi as any,
    client: { public: publicClient, wallet: walletClient }
  })
  //console.log("oldContract=", oldContract)
  const oldBalance = await oldContract.read.getContractUSDTBalance([]) || 0n

  if (oldBalance > 0n) {
    console.log('1. Drenar contrato viejo')
    console.log(`Drenando ${formatUnits(oldBalance, 6)} USDT del contrato viejo...`)
    const hash1 = await oldContract.write.emergencyWithdraw([oldBalance])
    console.log(`Fondos drenados: ${hash1}`)

    // Wait for the transaction to be mined
    try {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: hash1,
        confirmations: 1, // Optional: number of confirmations to wait for
        timeout: 1_000, // 1 second
      });
      console.log(`Receipt: ${receipt}`)
    } catch (e) {
      console.error(`**No operó waitForTransactionReceipt de ${hash1}`)
    }
    
  
    console.log("2. Transferir fondos al nuevo contrato")
    let tx:Address = '0x0'
    try {
      tx = await usdtContract.write.transfer(
        [
          DEPLOYED_AT, 
          oldBalance
        ],
      )
    } catch (e) {
      console.log("** Falló transacción reintentando con calculo de nonce")
      // Tuvimos que manejar nonce para evitar errores por 2 writes
      // consecutivos como `replacement transaction underpriced` y
      // `once too low: next nonce 45, tx nonce 44`
      let nonce = await publicClient.getTransactionCount({
        address: account.address,
        blockTag: 'pending', // includes pending transactions
      });
      console.log("OJO  nonce=", nonce)
      let nextNonce = nonce + 1;
      console.log("OJO  nextNonce=", nextNonce)
      tx = await usdtContract.write.transfer(
        [
          DEPLOYED_AT, 
          oldBalance
        ],
        { account, nonce: nextNonce }
      )
    }
    console.log(`Fondos transferidos al nuevo contrato: ${tx}`)
    try {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: tx,
        confirmations: 1, // Optional: number of confirmations to wait for
        timeout: 1_000, // 1 second
      });
      console.log(`Receipt: ${receipt}`)
    } catch (e) {
      console.error(`**No operó waitForTransactionReceipt de ${tx}`)
    }

  }

  console.log("3. Recrear bovedas")
  const courses = await db
  .selectFrom('cor1440_gen_proyectofinanciero')
  .select(['id'])
  .execute()

  for (const c of courses) {
    console.log("Curso ", c.id)
    const courseId = BigInt(c.id)
    const lOldVault:any = await oldContract.read.vaults([courseId])
    const oldVault = {
      courseId: lOldVault[0],
      balance: lOldVault[1],
      amountPerGuide: lOldVault[2],
      exists: lOldVault[3]
    }
    //console.log("oldVault=", oldVault)
    const amount = oldVault.balance
    let lNewVault:any = await newContract.read.vaults([courseId])
    let newVault = {
      courseId: lNewVault[0],
      balance: lNewVault[1],
      amountPerGuide: lNewVault[2],
      exists: lNewVault[3]
    }
    //console.log("newVault=", newVault)
    if (oldVault.exists && !newVault.exists) {
      console.log("  Creando boveda como", oldVault)
      let tx:Address = '0x0'
      try {
        await newContract.write.createVault(
          [ courseId, oldVault.amountPerGuide ],
        )
      } catch (e) {
        console.log("  * Reintentando con nonce")
        let nonce = await publicClient.getTransactionCount({
          address: account.address,
          blockTag: 'pending', // includes pending transactions
        });
        console.log("OJO  nonce=", nonce)
        let nextNonce = nonce + 1;
        console.log("OJO  nextNonce=", nextNonce)
        tx = await newContract.write.createVault(
          [ courseId, oldVault.amountPerGuide ],
          { account, nonce: nextNonce }
        )
        console.log("* hash=", tx)
      }
      try {
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: tx,
          confirmations: 1, // Optional: number of confirmations to wait for
          timeout: 1_000, // 1 second
        });
        console.log(`Receipt: ${receipt}`)
      } catch (e) {
        console.error(`**No operó waitForTransactionReceipt de ${tx}`)
      }
      lNewVault = await newContract.read.vaults([courseId])
      newVault = {
        courseId: lNewVault[0],
        balance: lNewVault[1],
        amountPerGuide: lNewVault[2],
        exists: lNewVault[3]
      }
      console.log('newVault=', newVault)

      console.log(`Vault creado: course ${newVault.courseId}`)
    }

    if (oldVault.exists && newVault.exists) {
      const uwallets = await db
      .selectFrom('billetera_usuario')
      .select([
        'usuario_id',
        'billetera',
      ])
      .execute()
      console.log("  Cantidad de billeteras=", uwallets.length)
      for (const uw of uwallets) {
        console.log("   Billetera", uw.billetera)
        let guiasCompletadas = 0
        const guides = await sql<any>(
          'select id, nombrecorto, "sufijoRuta" from cor1440_gen_actividadpf ' +
            `where proyectofinanciero_id = ${courseId} ` +
            'and "sufijoRuta" IS NOT NULL ' +
            'and "sufijoRuta" <>\'\' ' +
            'order by nombrecorto'
        ).execute(db)
        //console.log("guides=", guides)
        console.log(
          "    Curso", courseId, " con", guides.rows.length, "guias"
        )
        let numGuia = 0
        for (const g of guides.rows) {
          numGuia++
          console.log("      Guía ", g.nombrecorto)
          const oldGuidePaid = await oldContract.read.guidePaid(
            [courseId, numGuia, uw.billetera]
          )
          console.log("      ** oldGuidePaid=", oldGuidePaid)
          const newGuidePaid = await newContract.read.guidePaid(
            [courseId, numGuia, uw.billetera]
          )
          console.log("      ** newGuidePaid=", newGuidePaid)
          if (oldGuidePaid) {
            console.log(
              "      Registrando pago de guía por", 
              formatUnits(oldVault.amountPerGuide, 6),
              "USDT"
            )
            const ug = await db
            .selectFrom('guidepaid_usuario')
            .select([
              'usuario_id'
            ])
            .where('usuario_id', '=', uw.usuario_id)
            .where('actividadpf_id', '=', g.id)
            .execute()
            if (ug.length == 0) {
              guiasCompletadas++
              let gp:Insertable<GuidepaidUsuario> = {
                usuario_id: uw.usuario_id,
                actividadpf_id: g.id,
                amountpaid: oldVault.amountPerGuide,
                profilescore: 0,
                amountpending: 0,
                points: 1,
              }
              let igp = await db
              .insertInto('guidepaid_usuario')
              .values(gp)
              .returningAll()
              .executeTakeFirstOrThrow()
              console.log("      After insert igp.amountpaid=", igp.amountpaid)
            }
            if (newGuidePaid == 0) {
              let tx:Address = "0x0"
              console.log("      Registrando en blockchain")
              try {
                tx = await newContract.write.setGuidePaid(
                  [courseId, numGuia, uw.billetera, oldVault.amountPerGuide],
                )
              } catch (e) {
                console.log("      Falló normla, intentando con nonce")
                let nonce = await publicClient.getTransactionCount({
                  address: account.address,
                  blockTag: 'pending', // includes pending transactions
                });
                console.log("      ** OJO  nonce=", nonce)
                let nextNonce = nonce + 1;
                console.log("      ** OJO  nextNonce=", nextNonce)
                tx = await newContract.write.setGuidePaid(
                  [courseId, numGuia, uw.billetera, oldVault.amountPerGuide],
                  { account, nonce: nextNonce }
                )
              }
              console.log(
                `guidePaid con ${courseId}, ${numGuia}, ` +
                  `${uw.billetera}, ${oldVault.amountPerGuide}` +
                  ` tx: `, tx
              )
              try {
                const receipt = await publicClient.waitForTransactionReceipt({
                  hash: tx,
                  confirmations: 1, // Optional: number of confirmations to wait for
                  timeout: 1_000, // 1 second
                });
                console.log(`      Receipt: ${receipt}`)
              } catch (e) {
                console.error(`      **No operó waitForTransactionReceipt de ${tx}`)
              }

            }

          }
        }
        if (guiasCompletadas == guides.rows.length) {
          let cp:Insertable<CoursecompletedUsuario> = {
            usuario_id: uw.usuario_id,
            proyectofinanciero_id: c.id,
            points: 2
          }
          let icp = await db
          .insertInto('coursecompleted_usuario')
          .values(cp)
          .returningAll()
          .executeTakeFirstOrThrow()
          console.log("After insert icp=", icp)
        }
      }
    }
  }
  console.log('¡MIGRACIÓN COMPLETA!')
}

export async function down(db: Kysely<any>): Promise<void> {
  console.error("Irreversible migration")
  process.exit(1)
}
