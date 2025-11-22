import 'dotenv/config'
import { Kysely, PostgresDialect } from 'kysely'
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

import { newKyselyPostgresql } from '../../.config/kysely.config.ts'
import ScholarshipVaultsV1Abi from 
  '../../abis/ScholarshipVaults-v1.json' with { type: "json" }
import Erc20Abi from 
  '../../abis/IERC20.json' with { type: "json" }
import LearnTGVaultsAbi from 
  '../../abis/LearnTGVaults.json' with { type: "json" }


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

  console.log('1. Drenar contrato viejo')
  const usdtAbi = [ 
    {
      constant: false,
      inputs: [
        { name: '_to', type: 'address' },
        { name: '_value', type: 'uint256' },
      ],
      name: 'transfer',
      outputs: [], // Note: no return value
      payable: false,
      stateMutability: 'nonpayable',
      type: 'function',
    },
  ] as const;
  const usdtContract = getContract({
    address: process.env.NEXT_PUBLIC_USDT_ADDRESS! as Address,
    abi: usdtAbi as any,
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
    console.log(`Drenando ${formatUnits(oldBalance, 6)} USDT del contrato viejo...`)
    const hash1 = await oldContract.write.emergencyWithdraw([oldBalance])
    console.log(`Fondos drenados: ${hash1}`)

    // 2. Transferir fondos al nuevo contrato
    const { request } = await publicClient.simulateContract({
      account,
      address: process.env.NEXT_PUBLIC_USDT_ADDRESS!,
      abi: usdtAbi,
      functionName: 'transfer',
      args: [process.env.NEXT_PUBLIC_DEPLOYED_AT!, oldBalance]
    })
    console.log("request=", request)
    const hash2 = await walletClient.writeContract(request)
    console.log(`Fondos transferidos al nuevo contrato: ${hash2}`)
  }

  // 3. Recrear vaults
  const courses = await db
  .selectFrom('cor1440_gen_proyectofinanciero')
  .select(['id', 'scholarship_per_guide'])
  .execute()

  for (const c of courses) {
    const courseId = BigInt(c.id)
    const amount = parseUnits(c.scholarship_per_guide.toString(), 6)

    const oldVault:any = await publicClient.readContract({
      ...oldContract,
      functionName: 'vaults',
      args: [courseId],
    })

    const newVault:any = await publicClient.readContract({
      ...newContract,
      functionName: 'vaults',
      args: [courseId],
    })

    if (oldVault.exists && !newVault.exists) {
      const hash = await walletClient.writeContract({
        ...newContract,
        functionName: 'createVault',
        args: [courseId, oldVault.amountPerGuide],
        account,
      })
      await publicClient.waitForTransactionReceipt({ hash })
      console.log(`Vault creado: course ${c.id}`)
    }

    const guides = await db
    .selectFrom('cor1440_gen_actividadpf')
    .select([
      'id'
    ]).where(
    'proyectofinanciero_id', '=', courseId
    ).orderBy('nombrecorto')

    console.log("guides=", guides)
    const batch = []
    for (let g = 1; g <= guides.length; g++) {
      const uwallets = await db
      .selectFrom('billetera_usuario')
      .select([
        'usuario_id',
        'billetera',
      ])
      .execute()
      for (const uw of uwallets) {
        const oldGuidePaid = await publicClient.readContract({
          ...oldContract,
          functionName: 'guidePaid',
          args: [courseId, g, uw.billetera],
        })

        const newGuidePaid = await publicClient.readContract({
          ...newContract,
          functionName: 'guidePaid',
          args: [courseId, g, uw.billetera],
        })

        if (oldGuidePaid && newGuidePaid == 0) {
          batch.push(walletClient.writeContract({
            ...newContract,
            functionName: 'guidePaid',
            args: [courseId, g, uw.billetera, 
              oldVault.amountPerGuide],
              account,
          }))
          console.log(
            `guidePaid con ${courseId}, ${g}, ` +
              `${uw.billetera}, ${oldVault.amountPerGuide}`
          )
        }

        if (batch.length >= 30) {
          await Promise.all(batch.map(
            p => p.then(
              h => {
                publicClient.waitForTransactionReceipt({ hash: h })
                console.log(`Hash ${h}`)
              }
            )
          ))
          batch.length = 0
        }
      }
    }
    if (batch.length > 0) {
      await Promise.all(batch.map(
        p => p.then(
          h => {
            publicClient.waitForTransactionReceipt({ hash: h })
            console.log(`Hash ${h}`)
          }
        )
      ))
    }
  }
  console.log('¡MIGRACIÓN COMPLETA!')
}

export async function down(db: Kysely<any>): Promise<void> {
  console.error("Irreversible migration")
  process.exit(1)
}
