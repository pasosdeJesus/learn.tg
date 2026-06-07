import dotenv from 'dotenv'
dotenv.config({ path: '../.env' })
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
import { celo, celoSepolia } from 'viem/chains'

import LearnTGVaultsAbi from '../../abis/LearnTGVaults.json' with { type: 'json' }
import LearnTGVaultsV3Abi from '../../abis/LearnTGVaultsV3.json' with { type: 'json' }
import Erc20Abi from '../../abis/IERC20.json' with { type: 'json' }
import type { GuideUsuario } from '../../db/db.d.ts'
import { getV3Address } from '../../lib/deployments'

async function callWriteFun(
  publicClient: any,
  account: any,
  contractFun: any,
  contractParams: any,
  indent: any,
) {
  const sindent = indent > 0 ? ' '.repeat(indent - 1) : ''
  console.log(
    sindent,
    'Calling function',
    contractFun.name || 'unknown',
    'with params',
    contractParams,
  )
  let tx: Address = '0x0'
  try {
    tx = await contractFun(contractParams)
  } catch (e) {
    console.log(sindent, '* Retrying with nonce')
    const nonce = await publicClient.getTransactionCount({
      address: account.address,
      blockTag: 'pending',
    })
    const nextNonce = nonce + 1
    console.log(sindent, 'nextNonce=', nextNonce)
    tx = await contractFun(contractParams, { account, nonce: nextNonce })
  }
  console.log(sindent, 'tx=', tx)
  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: tx,
      confirmations: 2,
      timeout: 30_000,
    })
    console.log(sindent, `Receipt: ${receipt.status}`)
  } catch (e) {
    console.error(
      sindent,
      `** waitForTransactionReceipt failed for ${tx}, continuing`,
    )
  }
  return tx
}

export async function up(db: Kysely<any>): Promise<void> {
  // ========= CONFIGURATION =========
  const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://forno.celo-sepolia.celo-testnet.org'
  const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}` | undefined
  const DEPLOYED_AT_V2 = process.env.NEXT_PUBLIC_DEPLOYED_AT_V2 as `0x${string}` | undefined
  const USDT_ADDRESS = process.env.NEXT_PUBLIC_USDT_ADDRESS!
  const NETWORK = process.env.NEXT_PUBLIC_NETWORK

  // Validate required env vars
  const missing: string[] = []
  if (!RPC_URL) missing.push('NEXT_PUBLIC_RPC_URL')
  if (!PRIVATE_KEY) missing.push('PRIVATE_KEY')
  if (!DEPLOYED_AT_V2) missing.push('NEXT_PUBLIC_DEPLOYED_AT_V2')
  if (!USDT_ADDRESS) missing.push('NEXT_PUBLIC_USDT_ADDRESS')
  if (!NETWORK) missing.push('NEXT_PUBLIC_NETWORK')
  if (missing.length > 0) {
    console.error('Missing required env vars:', missing.join(', '))
    console.error('Make sure apps/.env is configured correctly.')
    throw new Error(`Missing: ${missing.join(', ')}`)
  }

  const DEPLOYED_AT_V3 = await getV3Address()
  if (!DEPLOYED_AT_V3) {
    throw new Error('V3 address not found. Deploy LearnTGVaultsV3 first (bin/deployLearnTGVaultsV3).')
  }

  const chain = NETWORK === 'celo' ? celo : celoSepolia

  const publicClient = createPublicClient({
    chain,
    transport: http(RPC_URL),
  })

  const account = privateKeyToAccount(PRIVATE_KEY as Address)

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(RPC_URL),
  })

  console.log('Starting V2 → V3 migration')

  // ========= CONTRACTS =========
  const usdtContract = getContract({
    address: USDT_ADDRESS as Address,
    abi: Erc20Abi as any,
    client: { public: publicClient, wallet: walletClient },
  })

  const oldContract = getContract({
    address: DEPLOYED_AT_V2 as Address,
    abi: LearnTGVaultsAbi as any,
    client: { public: publicClient, wallet: walletClient },
  })

  const newContract = getContract({
    address: DEPLOYED_AT_V3 as Address,
    abi: LearnTGVaultsV3Abi as any,
    client: { public: publicClient, wallet: walletClient },
  })

  // ========= 1. DRAIN V2 CONTRACT =========
  // USDT
  const oldBalance =
    ((await oldContract.read.getContractUSDTBalance([])) as bigint) || 0n

  if (oldBalance > 0n) {
    console.log(
      `Draining ${formatUnits(oldBalance, 6)} USDT from V2 contract...`,
    )
    await callWriteFun(
      publicClient,
      account,
      oldContract.write.emergencyWithdrawUsdt,
      [oldBalance],
      0,
    )
  }

  // Transfer exactly what was in V2 from deployer to V3 (not the whole wallet)
  if (oldBalance > 0n) {
    console.log(`Transferring ${formatUnits(oldBalance, 6)} USDT to V3...`)
    await callWriteFun(
      publicClient,
      account,
      usdtContract.write.transfer,
      [DEPLOYED_AT_V3, oldBalance],
      0,
    )
    console.log('USDT transferred to V3')
  } else {
    console.log('V2 has no USDT, skipping transfer')
  }

  // cCOP
  const cCopAddress = process.env.NEXT_PUBLIC_CCOP_ADDRESS as Address
  if (cCopAddress) {
    const cCopContract = getContract({
      address: cCopAddress,
      abi: Erc20Abi as any,
      client: { public: publicClient, wallet: walletClient },
    })
    const cCopBalance = (await oldContract.read.getContractCcopBalance([])) as bigint || 0n
    if (cCopBalance > 0n) {
      console.log(`Draining ${formatUnits(cCopBalance, 18)} cCOP from V2...`)
      await callWriteFun(publicClient, account, oldContract.write.emergencyWithdrawCcop, [cCopBalance], 0)
      await callWriteFun(publicClient, account, cCopContract.write.transfer, [DEPLOYED_AT_V3, cCopBalance], 0)
    }
  }

  // GoodDollar
  const goodDollarAddress = process.env.NEXT_PUBLIC_GOODDOLLAR_ADDRESS as Address
  if (goodDollarAddress) {
    const gdContract = getContract({
      address: goodDollarAddress,
      abi: Erc20Abi as any,
      client: { public: publicClient, wallet: walletClient },
    })
    const gdBalance = (await oldContract.read.getContractGooddollarBalance([])) as bigint || 0n
    if (gdBalance > 0n) {
      console.log(`Draining ${formatUnits(gdBalance, 18)} GoodDollar from V2...`)
      await callWriteFun(publicClient, account, oldContract.write.emergencyWithdrawGooddollar, [gdBalance], 0)
      await callWriteFun(publicClient, account, gdContract.write.transfer, [DEPLOYED_AT_V3, gdBalance], 0)
    }
  }

  // ========= 2. MIGRATE VAULTS AND GUIDE PAID RECORDS =========
  const courses = await db
    .selectFrom('cor1440_gen_proyectofinanciero')
    .select(['id'])
    .execute()

  for (const c of courses) {
    const courseId = BigInt(c.id)
    console.log(`\nCourse ${c.id}`)

    // Read V2 vault
    const lOldVault: any = await oldContract.read.vaults([courseId])
    const oldVault = {
      courseId: lOldVault[0],
      balanceUsdt: lOldVault[1],
      balanceCcop: lOldVault[2],
      balanceGooddollar: lOldVault[3],
      amountPerGuide: lOldVault[4],
      exists: lOldVault[5],
    }
    console.log('  V2 vault:', {
      courseId: oldVault.courseId.toString(),
      balanceUsdt: oldVault.balanceUsdt.toString(),
      amountPerGuide: oldVault.amountPerGuide.toString(),
      exists: oldVault.exists,
    })

    // Read V3 vault
    const lNewVault: any = await newContract.read.vaults([courseId])
    const newVault = {
      courseId: lNewVault[0],
      balanceUsdt: lNewVault[1],
      balanceSlearn: lNewVault[2],
      amountPerGuideUsdt: lNewVault[3],
      amountPerGuideSlearn: lNewVault[4],
      exists: lNewVault[5],
    }
    console.log('  V3 vault:', {
      courseId: newVault.courseId.toString(),
      balanceUsdt: newVault.balanceUsdt.toString(),
      balanceSlearn: newVault.balanceSlearn.toString(),
      exists: newVault.exists,
    })

    // Create vault in V3 if it doesn't exist
    if (oldVault.exists && !newVault.exists) {
      console.log(`  Creating vault in V3: USDT=${oldVault.amountPerGuide}, SLEARN=0`)
      await callWriteFun(
        publicClient,
        account,
        newContract.write.createVault,
        [courseId, oldVault.amountPerGuide, 0n],
        2,
      )
    }

    // Restore balance
    if (oldVault.exists) {
      const lv3: any = await newContract.read.vaults([courseId])
      const v3BalanceUsdt = (lv3[1] as bigint) || 0n
      if (oldVault.balanceUsdt > 0n && v3BalanceUsdt === 0n) {
        console.log(
          `  Setting V3 vault balance: USDT=${oldVault.balanceUsdt}, SLEARN=0`,
        )
        await callWriteFun(
          publicClient,
          account,
          newContract.write.setVaultBalance,
          [courseId, oldVault.balanceUsdt, 0n],
          4,
        )
      }
    }

    if (!oldVault.exists) {
      console.log('  Vault does not exist in V2, skipping')
      continue
    }

    // ========= 3. MIGRATE guidePaid RECORDS =========
    // In V2: guidePaid(courseId, guideNumber, student) — guideNumber is sequential (1-indexed, ORDER BY nombrecorto)
    // In V3: guidePaidUSDT(courseId, guideId, student) — guideId = actividadpf_id
    const guides = await sql<any>`
      SELECT id, nombrecorto, "sufijoRuta"
      FROM cor1440_gen_actividadpf
      WHERE proyectofinanciero_id = ${c.id}
      AND "sufijoRuta" IS NOT NULL
      AND "sufijoRuta" <> ''
      ORDER BY nombrecorto
    `.execute(db)
    console.log(`  Course ${courseId} has ${guides.rows.length} guides`)

    const wallets = await db
      .selectFrom('billetera_usuario')
      .select(['usuario_id', 'billetera'])
      .execute()

    for (const uw of wallets) {
      let guidesCompleted = 0
      let numGuia = 0

      for (const g of guides.rows as any[]) {
        numGuia++
        // V2 uses sequential guideNumber, guidePaid returns uint256 (amount)
        const paidAmountInV2: bigint = (await oldContract.read.guidePaid([
          courseId,
          numGuia,
          uw.billetera,
        ])) as bigint
        if (paidAmountInV2 === 0n) continue

        console.log(
          `    Guide ${g.nombrecorto} (numGuia=${numGuia}, id=${g.id}): paid in V2`,
        )

        guidesCompleted++

        // Ensure guide_usuario record exists in DB
        const ug = await db
          .selectFrom('guide_usuario')
          .select(['usuario_id'])
          .where('usuario_id', '=', uw.usuario_id)
          .where('actividadpf_id', '=', g.id)
          .execute()
        if (ug.length === 0) {
          const gp: Insertable<GuideUsuario> = {
            usuario_id: uw.usuario_id,
            actividadpf_id: g.id,
            amountpaid: Number(oldVault.amountPerGuide),
            profilescore: 0,
            points: 1,
          }
          await db
            .insertInto('guide_usuario')
            .values(gp)
            .returningAll()
            .executeTakeFirstOrThrow()
          console.log(`      Created guide_usuario record`)
        }

        // Register in V3 using guideId (= actividadpf_id)
        const paidUSDTinV3: bigint =
          ((await newContract.read.guidePaidUSDT([
            courseId,
            g.id,
            uw.billetera,
          ])) as bigint) || 0n
        if (paidUSDTinV3 === 0n) {
          console.log(
            `      Registering in V3: guideId=${g.id}, USDT=${oldVault.amountPerGuide}, SLEARN=0`,
          )
          await callWriteFun(
            publicClient,
            account,
            newContract.write.setGuidePaid,
            [courseId, g.id, uw.billetera, oldVault.amountPerGuide, 0n],
            4,
          )
        } else {
          console.log(`      Already registered in V3, skipping`)
        }
      }
    }
  }

  console.log('\n=== MIGRATION COMPLETE ===')
  console.log('Remember to update .env:')
  console.log(`  NEXT_PUBLIC_DEPLOYED_AT_V2=${DEPLOYED_AT_V2}`)
  console.log(`  NEXT_PUBLIC_DEPLOYED_AT=${DEPLOYED_AT_V3}`)
}

export async function down(_db: Kysely<any>): Promise<void> {
  // Irreversible migration
}
