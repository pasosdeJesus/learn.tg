
import { createPublicClient, http, decodeEventLog, formatUnits, Log } from 'viem'
import { celo, celoSepolia } from 'viem/chains'
import { newKyselyPostgresql } from '../.config/kysely.config'
import LearnTGVaultsAbi from '../abis/LearnTGVaults.json'
import CeloUbiAbi from '../abis/CeloUbi.json'
import * as dotenv from 'dotenv'
import path from 'path'
import { sql } from 'kysely'
import { refreshUserLearningScore } from '../lib/scores'
import axios from 'axios'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL
const VAULTS_ADDRESS = process.env.NEXT_PUBLIC_DEPLOYED_AT as `0x${string}`
const CELOUBI_ADDRESS = process.env.NEXT_PUBLIC_CELOUBI_ADDRESS as `0x${string}`
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || ''

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Método 1: Escaneo por bloques vía RPC (Lento)
async function getLogsInBatches(client: any, options: any) {
  const { fromBlock, toBlock, address, batchSize: customBatchSize } = options
  const batchSize = customBatchSize || 5n 
  let allLogs: any[] = []
  for (let current = fromBlock; current <= toBlock; current += batchSize) {
    const end = current + (batchSize - 1n) > toBlock ? toBlock : current + (batchSize - 1n);
    if (current % (batchSize * 50n) === 0n) console.log(`   Escaneando bloques ${current}...`);
    try {
      const logs = await client.getLogs({ address, fromBlock: current, toBlock: end })
      allLogs = [...allLogs, ...logs]
    } catch (e) { console.error(`      Error en bloque ${current}:`, (e as any).message) }
    if (batchSize < 100n) await sleep(150);
  }
  return allLogs
}

// Método 2: Etherscan V2 API (Rápido y Exhaustivo)
async function getLogsFromEtherscan(address: string, fromBlock: bigint) {
  const baseUrl = 'https://api.etherscan.io/v2/api'
  const chainId = IS_PRODUCTION ? '42220' : '11142220'
  console.log(`   Consultando Etherscan V2 para ${address} (Chain ${chainId})...`)
  try {
    const response = await axios.get(baseUrl, {
      params: {
        chainid: chainId,
        module: 'logs',
        action: 'getLogs',
        fromBlock: fromBlock.toString(),
        toBlock: 'latest',
        address: address,
        apikey: ETHERSCAN_API_KEY
      }
    })
    if (response.data.status !== '1') {
      if (response.data.result === 'No logs found' || response.data.message === 'No records found') return []
      throw new Error(response.data.message || 'Error en Etherscan API')
    }
    return response.data.result.map((l: any) => ({
      address: l.address, data: l.data, topics: l.topics,
      transactionHash: l.transactionHash, blockNumber: BigInt(l.blockNumber)
    }))
  } catch (e: any) {
    console.error('   Error en Etherscan:', e.message)
    return []
  }
}

async function main() {
  const args = process.argv.slice(2)
  const fix = args.includes('--fix'), scanMissing = args.includes('--scan')
  const deepScan = args.includes('--deep-scan'), useCeloscan = args.includes('--celoscan')
  
  const fromBlockArgIndex = args.indexOf('--from-block')
  let manualFromBlock = fromBlockArgIndex !== -1 ? BigInt(args[fromBlockArgIndex + 1]) : 0n

  console.log(`>>> INICIANDO AUDITORÍA ${fix ? '(CON REPARACIÓN)' : '(DRY RUN)'}...`)

  const client = createPublicClient({ chain: IS_PRODUCTION ? celo : celoSepolia, transport: http(RPC_URL) })
  const db = newKyselyPostgresql()

  try {
    const wallets = await db.selectFrom('billetera_usuario').select(['usuario_id', 'billetera']).execute()
    const walletToUserMap = new Map(wallets.map(w => [w.billetera.toLowerCase(), w.usuario_id]))

    // --- FASE 1: Verificación de Hashes existentes ---
    console.log('\n--- FASE 1: Verificación de Hashes existentes ---')
    const dbTransactions = await db.selectFrom('transaction').where('hash', 'is not', null).selectAll().execute()
    let verifiedCount = 0, fakeRecords = 0
    for (const tx of dbTransactions) {
      try {
        const receipt = await client.getTransactionReceipt({ hash: tx.hash as `0x${string}` })
        if (receipt.status === 'success') verifiedCount++
        else { console.log(`[CRITICAL] Tx fallida: ID ${tx.id}, Hash ${tx.hash}`); fakeRecords++ }
      } catch (e: any) {
        if (e.message.includes('could not be found')) { console.log(`[ALERT] Registro FALSO: ID ${tx.id}, Hash ${tx.hash}`); fakeRecords++ }
      }
    }

    // --- FASE 2: Descubrimiento de Faltantes ---
    if (scanMissing || useCeloscan) {
      console.log('\n--- FASE 2: Descubrimiento de transacciones faltantes ---')
      let vaultLogs: any[] = [], ubiLogs: any[] = []
      if (useCeloscan) {
        vaultLogs = await getLogsFromEtherscan(VAULTS_ADDRESS, manualFromBlock)
        await sleep(250) // Respetar límite 5 calls/sec
        ubiLogs = await getLogsFromEtherscan(CELOUBI_ADDRESS, manualFromBlock)
      } else {
        const currentBlock = await client.getBlockNumber()
        const fromBlock = manualFromBlock || currentBlock - 500n
        vaultLogs = await getLogsInBatches(client, { address: VAULTS_ADDRESS, fromBlock, toBlock: currentBlock })
        ubiLogs = await getLogsInBatches(client, { address: CELOUBI_ADDRESS, fromBlock, toBlock: currentBlock })
      }
      
      const hashesInDb = new Set(dbTransactions.map(t => t.hash?.toLowerCase()))
      for (const log of [...vaultLogs, ...ubiLogs]) {
        if (!log.transactionHash || hashesInDb.has(log.transactionHash.toLowerCase())) continue
        try {
          const eventData = decodeEventLog({ abi: log.address.toLowerCase() === VAULTS_ADDRESS.toLowerCase() ? LearnTGVaultsAbi : CeloUbiAbi, data: log.data, topics: log.topics })
          console.log(`[ALERT] Faltante: ${log.transactionHash} (${eventData.eventName})`)
          if (fix) await handleMissingTransaction(db, log, eventData, walletToUserMap, client)
        } catch (e) {}
      }
    }

    // --- FASE 4: Auditoría Estructural ---
    if (deepScan) {
      console.log('\n--- FASE 4: Auditoría Estructural (Cursos -> Guías -> Usuarios) ---')
      const courses = await db.selectFrom('cor1440_gen_proyectofinanciero').select(['id']).execute()
      const CONCURRENCY = 3
      for (const course of courses) {
        const guides = await db.selectFrom('cor1440_gen_actividadpf').where('proyectofinanciero_id', '=', course.id).where('sufijoRuta', 'is not', null).select(['id', 'nombrecorto']).orderBy('nombrecorto', 'asc').execute()
        console.log(`   Curso ${course.id}: Auditando ${guides.length} guías...`)
        for (let i = 0; i < guides.length; i++) {
          const guideNum = BigInt(i + 1)
          for (let j = 0; j < wallets.length; j += CONCURRENCY) {
            const batch = wallets.slice(j, j + CONCURRENCY)
            await Promise.all(batch.map(async (uw) => {
              try {
                const status: any = await client.readContract({ address: VAULTS_ADDRESS, abi: LearnTGVaultsAbi, functionName: 'getStudentGuideStatus', args: [BigInt(course.id), guideNum, uw.billetera as `0x${string}`] })
                if (Number(status[0]) > 0) {
                  const tx = await db.selectFrom('transaction').where('usuario_id', '=', uw.usuario_id).where('crypto', '=', 'usdt').where(sql`metadata->>'guideId'`, '=', guides[i].id.toString()).executeTakeFirst()
                  if (!tx) {
                    console.log(`      [ALERT] Beca faltante: Usuario ${uw.usuario_id}, Guía ${guides[i].id}`)
                    if (fix) {
                      const amount = Number(formatUnits(status[0], 6))
                      await db.insertInto('transaction').values({ usuario_id: uw.usuario_id, fecha: new Date(), tipo: 'scholarship', crypto: 'usdt', cantidad: amount, impacto_balance: amount, wallet: uw.billetera, metadata: { source: 'deep-scan', courseId: course.id, guideId: guides[i].id } }).execute()
                    }
                  }
                }
              } catch (e) {}
            }))
            await sleep(150)
          }
        }
      }
    }

    // --- FASE 5: Consistencia Donación -> LP ---
    console.log('\n--- FASE 5: Consistencia Donación -> Recompensa LP ---')
    const donations = await db.selectFrom('transaction').where('tipo', '=', 'donation').selectAll().execute()
    let missingRewards = 0
    for (const d of donations) {
      const reward = await db.selectFrom('transaction').where('usuario_id', '=', d.usuario_id).where('crypto', '=', 'learningpoints').where(sql`metadata->>'donationHash'`, '=', d.hash || '').executeTakeFirst()
      if (!reward) {
        console.log(`[ALERT] Donación sin puntos: Usuario ${d.usuario_id}, Hash ${d.hash}`)
        missingRewards++
        if (fix && d.hash) {
          const lp = (Number(d.cantidad) * 22) / 10
          await db.insertInto('transaction').values({ usuario_id: d.usuario_id, fecha: new Date(), tipo: 'scholarship', crypto: 'learningpoints', cantidad: lp, impacto_balance: lp, wallet: d.wallet, metadata: { source: 'sync-lp-reward-fix', donationHash: d.hash } }).execute()
          console.log(`   [FIX] Recompensa LP insertada.`)
        }
      }
    }

    // --- FASE 3: Auditoría de Score ---
    console.log('\n--- FASE 3: Auditoría de learningscore ---')
    const users = await db.selectFrom('usuario').select(['id', 'learningscore']).execute()
    let scoreAlerts = 0
    for (const user of users) {
      const gPoints = await db.selectFrom('guide_usuario').where('usuario_id', '=', user.id).select(db.fn.sum('points').as('t')).executeTakeFirst().then(r => Number(r?.t) || 0)
      const dAmt = await db.selectFrom('transaction').where('usuario_id', '=', user.id).where('tipo', '=', 'donation').select(db.fn.sum('cantidad').as('t')).executeTakeFirst().then(r => Number(r?.t) || 0)
      const justified = gPoints + ((dAmt * 22) / 10), actual = Number(user.learningscore)
      if (Math.abs(actual - justified) > 0.01) { console.log(`[ALERT] Usuario ${user.id}: Score ${actual} vs Justificado ${justified.toFixed(2)}`); scoreAlerts++ }
      if (fix) await refreshUserLearningScore(db, user.id)
    }

    console.log('\n=== RESUMEN FINAL ===')
    console.log(`Verificados: ${verifiedCount} | Falsos: ${fakeRecords} | Score Mismatch: ${scoreAlerts} | Recompensas LP faltantes: ${missingRewards}`)

  } catch (error) { console.error('Error fatal:', error) } finally { await db.destroy() }
}

async function handleMissingTransaction(db: any, log: Log, event: any, walletToUserMap: Map<string, number>, client: any) {
  const txHash = log.transactionHash!
  const receipt = await client.getTransactionReceipt({ hash: txHash })
  const sender = receipt.from.toLowerCase()
  if (event.eventName === 'ScholarshipPaid') {
    const { student, actualAmount, courseId, guideNumber } = event.args
    const uid = walletToUserMap.get(student.toLowerCase()), amt = Number(formatUnits(actualAmount, 6))
    if (uid) {
      await db.insertInto('transaction').values({ usuario_id: uid, fecha: new Date(), tipo: 'scholarship', crypto: 'usdt', cantidad: amt, impacto_balance: amt, hash: txHash, wallet: student.toLowerCase(), metadata: { source: 'sync', courseId: Number(courseId), guideNum: Number(guideNumber) } }).execute()
      console.log(`   [FIX] Beca USDT insertada para usuario ${uid}`)
    }
  } else if (event.eventName === 'Claimed') {
    const { recipient, amount } = event.args
    const uid = walletToUserMap.get(recipient.toLowerCase()), amt = Number(formatUnits(amount, 18))
    if (uid) {
      await db.insertInto('transaction').values({ usuario_id: uid, fecha: new Date(), tipo: 'ubi-claim', crypto: 'celo', cantidad: amt, impacto_balance: amt, hash: txHash, wallet: recipient.toLowerCase(), metadata: { source: 'sync' } }).execute()
      console.log(`   [FIX] Reclamo UBI insertado para usuario ${uid}`)
    }
  } else if (event.eventName === 'Deposit' || event.eventName === 'DepositCcop') {
    const { amount, courseId } = event.args
    const crypto = event.eventName === 'Deposit' ? 'usdt' : 'ccop'
    const amt = Number(formatUnits(amount, crypto === 'usdt' ? 6 : 18)), uid = walletToUserMap.get(sender)
    if (uid) {
      await db.insertInto('transaction').values({ usuario_id: uid, fecha: new Date(), tipo: 'donation', crypto, cantidad: amt, impacto_balance: amt, hash: txHash, wallet: sender, metadata: { source: 'sync', courseId: Number(courseId) } }).execute()
      const lp = (amt * 22) / 10
      await db.insertInto('transaction').values({ usuario_id: uid, fecha: new Date(), tipo: 'scholarship', crypto: 'learningpoints', cantidad: lp, impacto_balance: lp, hash: `${txHash}-lp`, wallet: sender, metadata: { source: 'sync-lp-reward', donationHash: txHash } }).execute()
      console.log(`   [FIX] Donación y LP insertados para usuario ${uid}`)
    }
  }
}

main()
