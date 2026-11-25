#!/usr/bin/env node
// Devuelve a la billetera de apps/.env lo que quede en billeteras efímeras de los
// specs. Uso:
//
//   node e2e/sweep-funds.mjs                    # todas las del registro local
//   node e2e/sweep-funds.mjs --since 2026-11-25 # sólo las creadas desde ese día
//   node e2e/sweep-funds.mjs --dry-run          # sólo lista
//   node e2e/sweep-funds.mjs --key 0x…          # una billetera concreta
//
// Nunca imprime claves. Sólo testnet (Celo Sepolia).

import { sweepRegistry, sweepToTestWallet, summarizeSweep } from './helpers/ephemeral-funds.mjs'

function arg(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const dryRun = process.argv.includes('--dry-run')
const since = arg('--since')
const key = arg('--key')

if (key) {
  const result = await sweepToTestWallet(key, { waitReceipt: !dryRun })
  for (const line of summarizeSweep(result)) console.log(line)
  if (result.returned.length === 0) console.log(`[INFO] ${result.from}: sin saldos que devolver`)
  process.exit(0)
}

const result = await sweepRegistry({ since, dryRun })
for (const item of result.swept) {
  if (item.dryRun) {
    console.log(`[DRY] ${item.from}`)
    continue
  }
  for (const line of summarizeSweep(item)) console.log(line)
}
for (const warning of result.warnings) console.log(`[WARN] ${warning}`)
console.log(`[INFO] billeteras barridas: ${result.swept.length}${dryRun ? ' (dry-run)' : ''}`)
