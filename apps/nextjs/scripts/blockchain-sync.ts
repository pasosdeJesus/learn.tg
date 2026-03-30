
import { createPublicClient, http, decodeEventLog, parseAbiItem, Log, formatUnits } from 'viem'
import { celo, celoSepolia } from 'viem/chains'
import { newKyselyPostgresql } from '../.config/kysely.config'
import LearnTGVaultsAbi from '../abis/LearnTGVaults.json'
import CeloUbiAbi from '../abis/CeloUbi.json'
import { sql } from 'kysely'
import * as dotenv from 'dotenv'
import { refreshUserLearningScore, calculateDonationLearningScore } from '../lib/scores'

dotenv.config()

const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL
const VAULTS_ADDRESS = process.env.NEXT_PUBLIC_DEPLOYED_AT as `0x${string}`
const CELOUBI_ADDRESS = process.env.NEXT_PUBLIC_CELOUBI_ADDRESS as `0x${string}`

async function getLogsInBatches(client: any, options: any) {
  const { fromBlock, toBlock, address } = options
  const batchSize = 10000n 
  let allLogs: any[] = []
  
  for (let current = fromBlock; current <= toBlock; current += batchSize) {
    const end = current + batchSize > toBlock ? toBlock : current + batchSize
    const logs = await client.getLogs({
      address,
      fromBlock: current,
      toBlock: end
    })
    allLogs = [...allLogs, ...logs]
    if (allLogs.length % 100 === 0) console.log(`   Procesados ${allLogs.length} eventos...`)
  }
  return allLogs
}

async function main() {
  const args = process.argv.slice(2)
  const fix = args.includes('--fix')
  const dryRun = !fix
  
  const fromBlockArgIndex = args.indexOf('--from-block')
  let manualFromBlock: bigint | null = null
  if (fromBlockArgIndex !== -1 && args[fromBlockArgIndex + 1]) {
    manualFromBlock = BigInt(args[fromBlockArgIndex + 1])
  }

  console.log(`>>> INICIANDO AUDITORÍA ${dryRun ? '(DRY RUN)' : '(CON REPARACIÓN)'}...`)

  if (!RPC_URL || !VAULTS_ADDRESS || !CELOUBI_ADDRESS) {
    console.error('Faltan variables de entorno críticas.')
    process.exit(1)
  }

  const publicClient = createPublicClient({
    chain: IS_PRODUCTION ? celo : celoSepolia,
    transport: http(RPC_URL),
  })

  const db = newKyselyPostgresql()

  try {
    console.log('Cargando datos de referencia de la BD...')
    const walletsMap = new Map<string, { userId: number; score: number }>()
    const users = await db.selectFrom('billetera_usuario')
      .innerJoin('usuario', 'usuario.id', 'billetera_usuario.usuario_id')
      .select(['billetera', 'usuario.id', 'usuario.learningscore'])
      .execute()
    
    users.forEach(u => {
      walletsMap.set(u.billetera.toLowerCase(), { userId: u.id, score: Number(u.learningscore) || 0 })
    })

    const transactionsInDb = new Set<string>()
    const dbTxs = await db.selectFrom('transaction').select(['hash']).execute()
    dbTxs.forEach(t => { if (t.hash) transactionsInDb.add(t.hash.toLowerCase()) })

    const currentBlock = await publicClient.getBlockNumber()
    // Por defecto 1 mes (aprox 500k bloques) si no se especifica.
    // Para un año usar 6,500,000 o especificar bloque exacto.
    const fromBlock = manualFromBlock !== null ? manualFromBlock : currentBlock - 500000n 

    console.log(`Recuperando eventos desde bloque ${fromBlock} hasta ${currentBlock}...`)

    console.log('Escaneando LearnTGVaults...')
    const vaultLogs = await getLogsInBatches(publicClient, {
      address: VAULTS_ADDRESS,
      fromBlock,
      toBlock: currentBlock
    })

    console.log('Escaneando CeloUBI...')
    const ubiLogs = await getLogsInBatches(publicClient, {
      address: CELOUBI_ADDRESS,
      fromBlock,
      toBlock: currentBlock
    })

    const allLogs = [...vaultLogs, ...ubiLogs]
    const blockchainHashes = new Set<string>()

    let missingInDb = 0
    let inconsistencies = 0

    for (const log of allLogs) {
      if (!log.transactionHash) continue
      const txHash = log.transactionHash.toLowerCase()
      blockchainHashes.add(txHash)

      let eventData: any
      try {
        eventData = decodeEventLog({
          abi: log.address.toLowerCase() === VAULTS_ADDRESS.toLowerCase() ? LearnTGVaultsAbi : CeloUbiAbi,
          data: log.data,
          topics: log.topics
        })
      } catch (e) { continue }

      if (!transactionsInDb.has(txHash)) {
        console.log(`[ALERT] Transacción faltante en BD: ${txHash} (${eventData.eventName})`)
        missingInDb++

        if (fix) {
          await handleMissingTransaction(db, log, eventData, walletsMap, publicClient)
        }
      }
    }

    // 3. Detectar registros falsos en BD
    let fakeRecords = 0
    const relevantDbTxs = await db.selectFrom('transaction')
      .where('tipo', 'in', ['scholarship', 'ubi-claim', 'donation'])
      .where('crypto', 'in', ['usdt', 'celo', 'ccop', 'gooddollar'])
      .select(['id', 'hash', 'wallet', 'cantidad'])
      .execute()

    for (const tx of relevantDbTxs) {
      if (tx.hash && !blockchainHashes.has(tx.hash.toLowerCase())) {
        // Solo alertamos si el hash no está en los logs recuperados 
        // (esto puede tener falsos positivos si el bloque es muy antiguo, 
        // en producción usaríamos una ventana mayor o filtros por bloque)
        console.log(`[ALERT] Registro sospechoso en BD (Hash no en logs recientes): ID ${tx.id}, Hash ${tx.hash}`)
        fakeRecords++
      }
    }

    // 4. Auditoría de learningscore
    console.log('Auditando learningscore de usuarios...')
    let scoreAlerts = 0
    for (const [wallet, data] of walletsMap) {
      const { userId, score } = data

      // Techo por guías
      const guidesPointsResult = await db.selectFrom('guide_usuario')
        .where('usuario_id', '=', userId)
        .select(db.fn.sum('points').as('total'))
        .executeTakeFirst()
      const guidesPoints = Number(guidesPointsResult?.total) || 0

      // Techo por donaciones (usando las transacciones ya validadas en BD)
      const donationsResult = await db.selectFrom('transaction')
        .where('usuario_id', '=', userId)
        .where('tipo', '=', 'donation')
        .select(db.fn.sum('cantidad').as('total'))
        .executeTakeFirst()
      const donationsAmount = Number(donationsResult?.total) || 0
      const donationScore = await calculateDonationLearningScore(donationsAmount)

      const justifiedMax = guidesPoints + donationScore

      if (score > justifiedMax + 0.01) { // Pequeño margen para redondeo
        console.log(`[CRITICAL] Usuario ${userId} (${wallet}) tiene score excedido: Actual ${score}, Justificado ${justifiedMax}`)
        scoreAlerts++
      }

      if (fix) {
        await refreshUserLearningScore(db, userId)
      }
    }

    console.log('\n=== RESUMEN DE AUDITORÍA ===')
    console.log(`Eventos analizados: ${allLogs.length}`)
    console.log(`Transacciones faltantes en BD: ${missingInDb}`)
    console.log(`Registros sospechosos en BD: ${fakeRecords}`)
    console.log(`Alertas de learningscore: ${scoreAlerts}`)
    if (fix) console.log('Acciones de reparación completadas.')

  } catch (error) {
    console.error('Error fatal:', error)
  } finally {
    await db.destroy()
  }
}

async function handleMissingTransaction(db: any, log: Log, event: any, walletsMap: any, client: any) {
  const txHash = log.transactionHash!
  const receipt = await client.getTransactionReceipt({ hash: txHash })
  const sender = receipt.from.toLowerCase()
  
  let usuario_id = walletsMap.get(sender)?.userId
  let wallet = sender

  if (event.eventName === 'ScholarshipPaid') {
    const { student, actualAmount, courseId, guideNumber } = event.args
    wallet = student.toLowerCase()
    usuario_id = walletsMap.get(wallet)?.userId
    const cantidad = Number(formatUnits(actualAmount, 6))

    if (usuario_id) {
      await db.insertInto('transaction').values({
        usuario_id,
        fecha: new Date(),
        tipo: 'scholarship',
        crypto: 'usdt',
        cantidad,
        impacto_balance: cantidad,
        hash: txHash,
        wallet,
        metadata: { source: 'sync', courseId: Number(courseId), guideId: Number(guideNumber) }
      }).execute()
    }
  } else if (event.eventName === 'Claimed') {
    const { recipient, amount } = event.args
    wallet = recipient.toLowerCase()
    usuario_id = walletsMap.get(wallet)?.userId
    const cantidad = Number(formatUnits(amount, 18))

    if (usuario_id) {
      await db.insertInto('transaction').values({
        usuario_id,
        fecha: new Date(),
        tipo: 'ubi-claim',
        crypto: 'celo',
        cantidad,
        impacto_balance: cantidad,
        hash: txHash,
        wallet,
        metadata: { source: 'sync' }
      }).execute()
    }
  } else if (event.eventName === 'Deposit' || event.eventName === 'DepositCcop') {
    const { amount, courseId } = event.args
    const crypto = event.eventName === 'Deposit' ? 'usdt' : 'ccop'
    const decimals = crypto === 'usdt' ? 6 : 18
    const cantidad = Number(formatUnits(amount, decimals))

    if (usuario_id) {
      await db.insertInto('transaction').values({
        usuario_id,
        fecha: new Date(),
        tipo: 'donation',
        crypto,
        cantidad,
        impacto_balance: cantidad, // Para donaciones, el impacto local suele ser positivo en el fondo del curso
        hash: txHash,
        wallet: sender,
        metadata: { source: 'sync', courseId: Number(courseId) }
      }).execute()
      
      // Recompensa de learningscore por donación
      const lpReward = await calculateDonationLearningScore(cantidad)
      await db.insertInto('transaction').values({
        usuario_id,
        fecha: new Date(),
        tipo: 'scholarship', // O un nuevo tipo 'donation-reward'
        crypto: 'learningpoints',
        cantidad: lpReward,
        impacto_balance: lpReward,
        hash: `${txHash}-lp`,
        wallet: sender,
        metadata: { source: 'sync-lp-reward', donationHash: txHash }
      }).execute()
    }
  }
}

main()
