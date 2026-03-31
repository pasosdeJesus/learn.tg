
import { createPublicClient, http, decodeEventLog, formatUnits, Log } from 'viem'
import { celo, celoSepolia } from 'viem/chains'
import { newKyselyPostgresql } from '../.config/kysely.config'
import LearnTGVaultsAbi from '../abis/LearnTGVaults.json'
import CeloUbiAbi from '../abis/CeloUbi.json'
import * as dotenv from 'dotenv'
import path from 'path'
import { refreshUserLearningScore } from '../lib/scores'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL
const VAULTS_ADDRESS = process.env.NEXT_PUBLIC_DEPLOYED_AT as `0x${string}`
const CELOUBI_ADDRESS = process.env.NEXT_PUBLIC_CELOUBI_ADDRESS as `0x${string}`

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getLogsInBatches(client: any, options: any) {
  const { fromBlock, toBlock, address, batchSize: customBatchSize } = options
  const batchSize = customBatchSize || 5n 
  let allLogs: any[] = []
  
  for (let current = fromBlock; current <= toBlock; current += batchSize) {
    const end = current + (batchSize - 1n) > toBlock ? toBlock : current + (batchSize - 1n);
    if (current % (batchSize * 50n) === 0n) {
       console.log(`   Escaneando bloques ${current} a ${current + batchSize * 50n}...`);
    }
    try {
      const logs = await client.getLogs({
        address, fromBlock: current, toBlock: end
      })
      allLogs = [...allLogs, ...logs]
      if (logs.length > 0) console.log(`      ¡Encontrados ${logs.length} eventos en bloque ${logs[0].blockNumber}!`)
    } catch (e) {
      console.error(`      Error en bloque ${current}:`, (e as any).message)
    }
    if (batchSize < 100n) await sleep(150);
  }
  return allLogs
}

async function main() {
  const args = process.argv.slice(2)
  const fix = args.includes('--fix')
  const scanMissing = args.includes('--scan')
  const deepScan = args.includes('--deep-scan')
  
  const fromBlockArgIndex = args.indexOf('--from-block')
  let manualFromBlock: bigint | null = null
  if (fromBlockArgIndex !== -1 && args[fromBlockArgIndex + 1]) {
    manualFromBlock = BigInt(args[fromBlockArgIndex + 1])
  }

  const batchSizeArgIndex = args.indexOf('--batch-size')
  let manualBatchSize: bigint | null = null
  if (batchSizeArgIndex !== -1 && args[batchSizeArgIndex + 1]) {
    manualBatchSize = BigInt(args[batchSizeArgIndex + 1])
  }
  const currentBatchSize = manualBatchSize || 5n;

  console.log(`>>> INICIANDO AUDITORÍA ${fix ? '(CON REPARACIÓN)' : '(DRY RUN)'}...`)

  if (!RPC_URL || !VAULTS_ADDRESS || !CELOUBI_ADDRESS) {
    console.error('Faltan variables de entorno críticas en .env')
    process.exit(1)
  }

  const client = createPublicClient({
    chain: IS_PRODUCTION ? celo : celoSepolia,
    transport: http(RPC_URL),
  })

  const db = newKyselyPostgresql()

  try {
    const wallets = await db.selectFrom('billetera_usuario').select(['usuario_id', 'billetera']).execute()
    const walletToUserMap = new Map(wallets.map(w => [w.billetera.toLowerCase(), w.usuario_id]))

    // --- FASE 1: Verificación de Hashes existentes ---
    console.log('\n--- FASE 1: Verificación de Hashes existentes ---')
    const dbTransactions = await db.selectFrom('transaction')
      .where('hash', 'is not', null)
      .where('crypto', 'in', ['usdt', 'celo', 'ccop', 'gooddollar'])
      .selectAll().execute()

    let verifiedCount = 0
    let fakeRecords = 0
    for (const tx of dbTransactions) {
      try {
        const receipt = await client.getTransactionReceipt({ hash: tx.hash as `0x${string}` })
        if (receipt.status === 'success') verifiedCount++
        else { console.log(`[CRITICAL] Tx fallida on-chain: ID ${tx.id}, Hash ${tx.hash}`); fakeRecords++ }
      } catch (e: any) {
        if (e.message.includes('could not be found')) {
          console.log(`[ALERT] Registro FALSO (Hash no existe): ID ${tx.id}, Hash ${tx.hash}`)
          fakeRecords++
        }
      }
    }

    // --- FASE 2: Escaneo de eventos (Discovery) ---
    if (scanMissing) {
      console.log('\n--- FASE 2: Escaneando blockchain para descubrir faltantes ---')
      const currentBlock = await client.getBlockNumber()
      const fromBlock = manualFromBlock !== null ? manualFromBlock : currentBlock - 500n
      
      const vaultLogs = await getLogsInBatches(client, { address: VAULTS_ADDRESS, fromBlock, toBlock: currentBlock, batchSize: currentBatchSize })
      const ubiLogs = await getLogsInBatches(client, { address: CELOUBI_ADDRESS, fromBlock, toBlock: currentBlock, batchSize: currentBatchSize })
      
      const hashesInDb = new Set(dbTransactions.map(t => t.hash?.toLowerCase()))
      for (const log of [...vaultLogs, ...ubiLogs]) {
        if (!log.transactionHash || hashesInDb.has(log.transactionHash.toLowerCase())) continue
        try {
          const eventData = decodeEventLog({
            abi: log.address.toLowerCase() === VAULTS_ADDRESS.toLowerCase() ? LearnTGVaultsAbi : CeloUbiAbi,
            data: log.data, topics: log.topics
          })
          console.log(`[ALERT] Transacción on-chain faltante: ${log.transactionHash} (${eventData.eventName})`)
          if (fix) await handleMissingTransaction(db, log, eventData, walletToUserMap, client)
        } catch (e) {}
      }
    }

    // --- FASE 4: Auditoría Estructural (Deep Scan) ---
    if (deepScan) {
      console.log('\n--- FASE 4: Auditoría Estructural (Cursos -> Guías -> Usuarios) ---')
      const courses = await db.selectFrom('cor1440_gen_proyectofinanciero').select(['id']).execute()
      const CONCURRENCY = 3; 

      for (const course of courses) {
        const guides = await db.selectFrom('cor1440_gen_actividadpf')
          .where('proyectofinanciero_id', '=', course.id)
          .where('sufijoRuta', 'is not', null)
          .select(['id', 'nombrecorto']).orderBy('nombrecorto', 'asc').execute()

        console.log(`   Curso ${course.id}: Auditando ${guides.length} guías para ${wallets.length} usuarios...`)

        for (let i = 0; i < guides.length; i++) {
          const guide = guides[i]
          const guideNum = BigInt(i + 1)

          for (let j = 0; j < wallets.length; j += CONCURRENCY) {
            const batch = wallets.slice(j, j + CONCURRENCY);
            await Promise.all(batch.map(async (uw) => {
              try {
                const status: any = await client.readContract({
                  address: VAULTS_ADDRESS, abi: LearnTGVaultsAbi, functionName: 'getStudentGuideStatus',
                  args: [BigInt(course.id), guideNum, uw.billetera as `0x${string}`]
                })

                if (Number(status[0]) > 0) {
                  const tx = await db.selectFrom('transaction')
                    .where('usuario_id', '=', uw.usuario_id).where('tipo', '=', 'scholarship').where('crypto', '=', 'usdt')
                    .where(eb => eb.or([
                       eb('metadata', '->>', 'guideId').equals(guide.id.toString()),
                       eb('metadata', '->>', 'guideNum').equals((i+1).toString())
                    ])).executeTakeFirst()

                  if (!tx) {
                    console.log(`      [ALERT] Beca faltante: Usuario ${uw.usuario_id}, Curso ${course.id}, Guía ${guide.id}`)
                    if (fix) {
                      const amount = Number(formatUnits(status[0], 6))
                      await db.insertInto('transaction').values({
                        usuario_id: uw.usuario_id, fecha: new Date(), tipo: 'scholarship', crypto: 'usdt',
                        cantidad: amount, impacto_balance: amount, wallet: uw.billetera,
                        metadata: { source: 'deep-scan', courseId: course.id, guideId: guide.id }
                      }).execute()
                    }
                  }
                }
                
                const guideUser = await db.selectFrom('guide_usuario')
                  .where('usuario_id', '=', uw.usuario_id).where('actividadpf_id', '=', guide.id)
                  .select(['points']).executeTakeFirst()
                
                if (guideUser && Number(guideUser.points) > 0) {
                  const lpTx = await db.selectFrom('transaction')
                    .where('usuario_id', '=', uw.usuario_id).where('crypto', '=', 'learningpoints')
                    .where(eb => eb('metadata', '->>', 'guideId').equals(guide.id.toString()))
                    .executeTakeFirst()
                  
                  if (!lpTx) {
                    console.log(`      [ALERT] learningscore faltante: Usuario ${uw.usuario_id}, Guía ${guide.id}`)
                    if (fix) {
                      await db.insertInto('transaction').values({
                        usuario_id: uw.usuario_id, fecha: new Date(), tipo: 'scholarship', crypto: 'learningpoints',
                        cantidad: guideUser.points, impacto_balance: guideUser.points, wallet: uw.billetera,
                        metadata: { source: 'deep-scan', guideId: guide.id }
                      }).execute()
                    }
                  }
                }
              } catch (e) {}
            }));
            if (currentBatchSize < 10n) await sleep(150)
          }
        }
      }
    }

    // --- FASE 3: Auditoría de Score final ---
    console.log('\n--- FASE 3: Auditoría de learningscore ---')
    const users = await db.selectFrom('usuario').select(['id', 'learningscore']).execute()
    let scoreAlerts = 0
    for (const user of users) {
      const gPoints = await db.selectFrom('guide_usuario').where('usuario_id', '=', user.id).select(db.fn.sum('points').as('t')).executeTakeFirst().then(r => Number(r?.t) || 0)
      const dAmt = await db.selectFrom('transaction').where('usuario_id', '=', user.id).where('tipo', '=', 'donation').select(db.fn.sum('cantidad').as('t')).executeTakeFirst().then(r => Number(r?.t) || 0)
      const justified = gPoints + ((dAmt * 22) / 10)
      if (Number(user.learningscore) > justified + 0.01) {
        console.log(`[CRITICAL] Usuario ${user.id}: Score ${user.learningscore} > Techo ${justified.toFixed(2)}`)
        scoreAlerts++
      }
      if (fix) await refreshUserLearningScore(db, user.id)
    }

    console.log('\n=== RESUMEN FINAL ===')
    console.log(`Verificados: ${verifiedCount} | Falsos: ${fakeRecords} | Score Alerts: ${scoreAlerts}`)

  } catch (error) { console.error('Error fatal:', error) } finally { await db.destroy() }
}

async function handleMissingTransaction(db: any, log: Log, event: any, walletToUserMap: Map<string, number>, client: any) {
  const txHash = log.transactionHash!
  const receipt = await client.getTransactionReceipt({ hash: txHash })
  const sender = receipt.from.toLowerCase()
  if (event.eventName === 'ScholarshipPaid') {
    const { student, actualAmount, courseId, guideNumber } = event.args
    const uid = walletToUserMap.get(student.toLowerCase())
    const amt = Number(formatUnits(actualAmount, 6))
    if (uid) {
      await db.insertInto('transaction').values({
        usuario_id: uid, fecha: new Date(), tipo: 'scholarship', crypto: 'usdt', cantidad: amt, impacto_balance: amt,
        hash: txHash, wallet: student.toLowerCase(), metadata: { source: 'sync', courseId: Number(courseId), guideNum: Number(guideNumber) }
      }).execute()
      console.log(`   [FIX] Insertada beca USDT para usuario ${uid}`)
    }
  } else if (event.eventName === 'Claimed') {
    const { recipient, amount } = event.args
    const uid = walletToUserMap.get(recipient.toLowerCase())
    const amt = Number(formatUnits(amount, 18))
    if (uid) {
      await db.insertInto('transaction').values({
        usuario_id: uid, fecha: new Date(), tipo: 'ubi-claim', crypto: 'celo', cantidad: amt, impacto_balance: amt,
        hash: txHash, wallet: recipient.toLowerCase(), metadata: { source: 'sync' }
      }).execute()
      console.log(`   [FIX] Insertado reclamo UBI para usuario ${uid}`)
    }
  } else if (event.eventName === 'Deposit' || event.eventName === 'DepositCcop') {
    const { amount, courseId } = event.args
    const crypto = event.eventName === 'Deposit' ? 'usdt' : 'ccop'
    const amt = Number(formatUnits(amount, crypto === 'usdt' ? 6 : 18))
    const uid = walletToUserMap.get(sender)
    if (uid) {
      await db.insertInto('transaction').values({
        usuario_id: uid, fecha: new Date(), tipo: 'donation', crypto, cantidad: amt, impacto_balance: amt,
        hash: txHash, wallet: sender, metadata: { source: 'sync', courseId: Number(courseId) }
      }).execute()
      const lp = (amt * 22) / 10
      await db.insertInto('transaction').values({
        usuario_id: uid, fecha: new Date(), tipo: 'scholarship', crypto: 'learningpoints', cantidad: lp, impacto_balance: lp,
        hash: `${txHash}-lp`, wallet: sender, metadata: { source: 'sync-lp-reward', donationHash: txHash }
      }).execute()
      console.log(`   [FIX] Insertada donación y LP para usuario ${uid}`)
    }
  }
}

main()
