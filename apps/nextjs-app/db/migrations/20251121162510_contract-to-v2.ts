import 'dotenv/config'
import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'
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

export async function up(db: Kysely<any>): Promise<void> {

  // ========= CONFIGURACIÓN =========
  const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL! // ej: https://forno.celo.org o https://mainnet.base.org
  const PRIVATE_KEY = process.env.PRIVATE_KEY! as `0x${string}`
  const DEPLOYED_AT_1 = process.env.NEXT_PUBLIC_DEPLOYED_AT1! as `0x${string}`
  const DEPLOYED_AT= process.env.NEXT_PUBLIC_DEPLOYED_AT! as `0x${string}`
  const USDT_ADDRESS = process.env.NEXT_PUBLIC_USDT_ADDRESS!
  const NETWORK = process.env.NEXT_PUBLIC_NETWORK!

  const client = createPublicClient({
    chain: NETWORK == "celo" ? celo : celoSepolia,
    transport: http(RPC_URL),
  })

  const account = privateKeyToAccount(PRIVATE_KEY)

  const walletClient = account ? createWalletClient({
    account,
    chain: NETWORK == "celo" ? celo : celoSepolia,
    transport: http(RPC_URL)
  }) : undefined
  //console.log("*** walletClient=", walletClient)
  
  const oldAbi = [ /* solo las funciones que necesitas del viejo contrato */
    'function emergencyWithdraw(uint256 amount) external',
    'function getContractUSDTBalance() view returns (uint256)',
  ] as const

  const newAbi = [ /* ABI completo del contrato final limpio que ya tienes */
    'function createVault(uint256 courseId, uint256 amountPerGuide) external',
    'function vaults(uint256 courseId) view returns (tuple(uint256 courseId, uint256 balance, uint256 amountPerGuide, bool exists))',
    'function pendingScholarship(uint256 courseId, uint256 guideNumber, address student) view returns (uint256)',
    'function guidePaid(uint256 courseId, uint256 guideNumber, address student) view returns (uint256)',
    'function profileScoreAtSubmission(uint256 courseId, uint256 guideNumber, address student) view returns (uint8)',
    'function studentCooldowns(uint256 courseId, address student) view returns (uint256)',
  ] as const

  const oldContract = { 
    address: process.env.NEXT_PUBLIC_DEPLOYED_AT_1!, abi: oldAbi 
  }
  const newContract = { 
    address: process.env.NEXT_PUBLIC_DEPLOYED_AT!, abi: newAbi 
  }
  const usdtContract = { 
    address: process.env.NEXT_PUBLIC_USDT_ADDRESS!, 
    abi: ['function transfer(address to, uint256 amount) returns (bool)'] as const 
  }

  console.log('Iniciando migración con viem')

  console.log('1. Drenar contrato viejo')
  const oldC = getContract({
    address: process.env.NEXT_PUBLIC_DEPLOYED_AT_1!,
    abi: oldAbi,
    client: { public: client, wallet: walletClient }
  })
  console.log("oldC=", oldC)
  const oldBalance = await oldC.read.getContractUSDTBalance([])
  console.log(oldBalance)

  if (oldBalance > 0n) {
    console.log(`Drenando ${formatUnits(oldBalance, 6)} USDT del contrato viejo...`)
    const hash1 = await client.writeContract({
      ...oldContract,
      functionName: 'emergencyWithdraw',
      args: [oldBalance],
      account,
    })
    await client.waitForTransactionReceipt({ hash: hash1 })
    console.log(`Fondos drenados: ${hash1}`)
  }

  // 2. Transferir fondos al nuevo contrato
  if (oldBalance > 0n) {
    const hash2 = await client.writeContract({
      address: process.env.NEXT_PUBLIC_USDT_ADDRESS!,
      abi: usdtContract.abi,
      functionName: 'transfer',
      args: [process.env.NEXT_PUBLIC_DEPLOYED_AT!, oldBalance],
      account,
    })
    await client.waitForTransactionReceipt({ hash: hash2 })
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

    const oldVault = await client.readContract({
      ...oldContract,
      functionName: 'vaults',
      args: [courseId],
    })

    const newVault = await client.readContract({
      ...newContract,
      functionName: 'vaults',
      args: [courseId],
    })

    if (oldVault.exists && !newVault.exists) {
      const hash = await client.writeContract({
        ...newContract,
        functionName: 'createVault',
        args: [courseId, oldVault.amountPerGuide],
        account,
      })
      await client.waitForTransactionReceipt({ hash })
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
        const oldGuidePaid = await client.readContract({
          ...oldContract,
          functionName: 'guidePaid',
          args: [courseId, g, uw.billetera],
        })

        const newGuidePaid = await client.readContract({
          ...newContract,
          functionName: 'guidePaid',
          args: [courseId, g, uw.billetera],
        })

        if (oldGuidePaid && newGuidePaid == 0) {
          batch.push(client.writeContract({
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
                client.waitForTransactionReceipt({ hash: h })
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
          h => client.waitForTransactionReceipt({ hash: h })
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
