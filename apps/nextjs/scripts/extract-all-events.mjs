#!/usr/bin/env node
/**
 * Extract ALL ScholarshipPaid/submitGuideResult/payScholarship transactions
 * from V2, V3, V4 on Celo mainnet via Blockscout API (paginated).
 * Outputs CSV to stdout.
 */

import pg from 'pg'
import * as dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const API = 'https://celo.blockscout.com/api/v2'
const V2 = '0x4AE346f9B640653b246eDd8205EDAdf4965333D7'
const V3 = '0x34B04781546Db02b008aE3A066b9512A52914728'
const V4 = '0x42DC9a547D98cD6891F38C8e6134D52a83580479'

async function fetchAllTxs(address, label) {
  const all = []
  let url = API + '/addresses/' + address + '/transactions?filter=to'
  let page = 0

  while (url) {
    page++
    const r = await fetch(url)
    if (!r.ok) {
      console.error('  ERROR page ' + page + ': ' + r.status)
      break
    }
    const data = await r.json()
    const items = data.items || []
    all.push(...items)
    if (page % 5 === 0 || page === 1) {
      console.error('  ' + label + ' page ' + page + ': ' + items.length + ' txs, total ' + all.length)
    }

    // Pagination
    const next = data.next_page_params
    if (next) {
      const params = new URLSearchParams(next).toString()
      url = API + '/addresses/' + address + '/transactions?filter=to&' + params
    } else {
      url = null
    }
  }
  return all
}

async function main() {
  // DB connection for wallet/user/guide mapping
  const client = new pg.Client({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432'),
    database: process.env.PGDATABASE || 'learntg_des',
    user: process.env.PGUSER || 'learntg',
    password: process.env.PGPASSWORD || '',
  })
  await client.connect()
  console.error('Connected to DB')

  const walletRes = await client.query('SELECT usuario_id, billetera FROM billetera_usuario')
  const walletToUser = new Map()
  for (const w of walletRes.rows) walletToUser.set(w.billetera.toLowerCase(), w.usuario_id)

  const guideRes = await client.query(
    'SELECT id, proyectofinanciero_id, "sufijoRuta" FROM cor1440_gen_actividadpf WHERE "sufijoRuta" IS NOT NULL AND "sufijoRuta" != \'\''
  )
  const guideNumToId = new Map()
  for (const g of guideRes.rows) {
    const num = parseInt(g.sufijoRuta.replace(/[^0-9]/g, ''), 10)
    if (num > 0) guideNumToId.set(g.proyectofinanciero_id + ':' + num, g.id)
  }

  const results = []

  for (const [addr, label] of [[V2, 'V2'], [V3, 'V3'], [V4, 'V4']]) {
    console.error('\n=== ' + label + ' ===')
    const txs = await fetchAllTxs(addr, label)
    console.error('  ' + label + ' total: ' + txs.length + ' txs')

    for (const tx of txs) {
      const di = tx.decoded_input
      if (!di || !di.method_call) continue
      const method = di.method_call
      if (!method.includes('submitGuideResult') && !method.includes('payScholarship')) continue

      const courseId = di.parameters.find(p => p.name === 'courseId')?.value
      const guideIdOrNum = di.parameters.find(p => p.name === 'guideId' || p.name === 'guideNumber')?.value
      const student = di.parameters.find(p => p.name === 'student')?.value?.toLowerCase()
      const isPerfect = di.parameters.find(p => p.name === 'isPerfect')?.value
      const profileScore = di.parameters.find(p => p.name === 'profileScore')?.value
      const usuarioId = walletToUser.get(student) || null

      const toAddr = tx.to?.hash?.toLowerCase()
      let contract = '?'
      let guideId = null
      let guideNum = null
      if (toAddr === V2.toLowerCase()) {
        contract = 'V2'
        guideNum = Number(guideIdOrNum)
        guideId = guideNumToId.get(Number(courseId) + ':' + guideNum) || null
      } else if (toAddr === V3.toLowerCase()) {
        contract = 'V3'
        guideId = Number(guideIdOrNum)
      } else if (toAddr === V4.toLowerCase()) {
        contract = 'V4'
        guideId = Number(guideIdOrNum)
      }

      const transfer = (tx.token_transfers || []).find(t => t.token?.symbol === 'USDT')
      const usdt = transfer ? transfer.total.value / 1e6 : '0'

      results.push({
        contract, usuario_id: usuarioId || '', wallet: student || '',
        course_id: Number(courseId), guide_id: guideId, guide_num: guideNum,
        usdt: String(usdt), is_perfect: isPerfect, profile_score: profileScore,
        hash: tx.hash, timestamp: tx.timestamp, block: tx.block_number,
        status: tx.result,
      })
    }
  }

  // CSV
  console.log('contract,usuario_id,wallet,course_id,guide_id,guide_num,usdt,is_perfect,profile_score,status,hash,timestamp,block')
  for (const r of results) {
    console.log([
      r.contract, r.usuario_id, r.wallet, r.course_id, r.guide_id || '', r.guide_num || '',
      r.usdt, r.is_perfect, r.profile_score, r.status, r.hash, r.timestamp, r.block
    ].join(','))
  }

  console.error('\nDone. ' + results.length + ' total ScholarshipPaid events.')
  await client.end()
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
