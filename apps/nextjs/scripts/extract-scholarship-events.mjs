#!/usr/bin/env node
/**
 * Extract all ScholarshipPaid events from V2, V3, V4 using Blockscout API.
 * Outputs CSV to stdout.
 */

import pg from 'pg'
import * as dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const V2_ADDRESS = '0x4AE346f9B640653b246eDd8205EDAdf4965333D7'
const V3_ADDRESS = '0x34B04781546Db02b008aE3A066b9512A52914728'
const V4_ADDRESS = '0x42DC9a547D98cD6891F38C8e6134D52a83580479'

const API = 'https://celo.blockscout.com/api/v2'

async function fetchTx(hash) {
  const u = API + '/transactions/' + hash
  const r = await fetch(u)
  if (!r.ok) return null
  return r.json()
}

async function main() {
  const client = new pg.Client({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432'),
    database: process.env.PGDATABASE || 'learntg_des',
    user: process.env.PGUSER || 'learntg',
    password: process.env.PGPASSWORD || '',
  })
  await client.connect()
  console.error('Connected to DB')

  // Query transactions table for all USDT scholarship hashes
  const txRes = await client.query(
    "SELECT id, usuario_id, hash, metadata FROM transaction WHERE type = 'scholarship' AND crypto = 'usdt' AND hash IS NOT NULL"
  )
  console.error('Found ' + txRes.rows.length + ' USDT scholarship TXs with hashes')

  // Wallet -> user mapping
  const walletRes = await client.query('SELECT usuario_id, billetera FROM billetera_usuario')
  const userToWallet = new Map()
  for (const w of walletRes.rows) {
    userToWallet.set(w.usuario_id, w.billetera.toLowerCase())
  }

  // Guide mapping
  const guideRes = await client.query(
    'SELECT id, proyectofinanciero_id, "sufijoRuta" FROM cor1440_gen_actividadpf WHERE "sufijoRuta" IS NOT NULL AND "sufijoRuta" != \'\''
  )
  const guideNumToId = new Map()
  for (const g of guideRes.rows) {
    const num = parseInt(g.sufijoRuta.replace(/[^0-9]/g, ''), 10)
    if (num > 0) guideNumToId.set(g.proyectofinanciero_id + ':' + num, g.id)
  }

  // For each hash, fetch blockchain data to get timestamp and decoded input
  const results = []
  let done = 0
  for (const row of txRes.rows) {
    done++
    try {
      const tx = await fetchTx(row.hash)
      if (!tx || !tx.decoded_input) {
        if (done % 20 === 0) console.error('  progress: ' + done + '/' + txRes.rows.length)
        continue
      }
      const di = tx.decoded_input
      const method = di.method_call
      if (!method || !method.includes('submitGuideResult') && !method.includes('payScholarship')) {
        if (done % 20 === 0) console.error('  progress: ' + done + '/' + txRes.rows.length)
        continue
      }
      const courseId = di.parameters.find(p => p.name === 'courseId')?.value
      const guideIdOrNum = di.parameters.find(p => p.name === 'guideId' || p.name === 'guideNumber')?.value
      const timestamp = tx.timestamp
      const to = tx.to?.hash?.toLowerCase()
      const from = tx.from?.hash?.toLowerCase()
      const student = di.parameters.find(p => p.name === 'student')?.value?.toLowerCase()

      // Determine guideId (actividadpf_id)
      let guideId = null
      let guideNum = null
      let contract = null
      if (to === V2_ADDRESS.toLowerCase()) {
        contract = 'V2'
        guideNum = Number(guideIdOrNum)
        guideId = guideNumToId.get(Number(courseId) + ':' + guideNum) || null
      } else if (to === V3_ADDRESS.toLowerCase()) {
        contract = 'V3'
        guideId = Number(guideIdOrNum)
      } else if (to === V4_ADDRESS.toLowerCase()) {
        contract = 'V4'
        guideId = Number(guideIdOrNum)
      }

      // Get USDT amount from token transfers
      const transfer = (tx.token_transfers || []).find(t => t.token?.symbol === 'USDT')
      const usdt = transfer ? transfer.total.value / 1e6 : '?'

      results.push({
        db_id: row.id,
        usuario_id: row.usuario_id,
        wallet: student,
        contract: contract || '?',
        course_id: Number(courseId),
        guide_id: guideId,
        guide_num: guideNum,
        usdt: String(usdt),
        hash: row.hash,
        timestamp: timestamp,
        block: tx.block_number,
      })
    } catch (e) {
      // skip
    }
    if (done % 20 === 0) console.error('  progress: ' + done + '/' + txRes.rows.length + ' (' + results.length + ' matched)')
  }

  // CSV
  console.log('db_id,contract,usuario_id,wallet,course_id,guide_id,guide_num,usdt,hash,timestamp,block')
  for (const r of results) {
    console.log([r.db_id, r.contract, r.usuario_id, r.wallet, r.course_id, r.guide_id || '', r.guide_num || '', r.usdt, r.hash, r.timestamp, r.block].join(','))
  }

  console.error('\nDone. ' + results.length + ' transactions decoded out of ' + txRes.rows.length)
  await client.end()
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
