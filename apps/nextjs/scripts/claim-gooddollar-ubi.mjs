#!/usr/bin/env node
// Reclama el UBI diario de GoodDollar directamente al contrato (sin citizen-sdk),
// que es lo que hace la billetera oficial GoodWallet:
//
//   UBIScheme.checkEntitlement(root)  → cuánto hay hoy (0 = ya reclamado)
//   UBIScheme.claim()                 → firma y difunde la transacción
//
// No abre la verificación de GoodID: si la dirección ya está whitelisteada en Celo
// (lo comprueba antes), el contrato paga. Es la vía para cron.
//
// Requisitos: la dirección whitelisteada y CELO para gas.
// Uso:
//   GOODDOLLAR_PRIVATE_KEY=0x... node scripts/claim-gooddollar-ubi.mjs            # reclama
//   GOODDOLLAR_PRIVATE_KEY=0x... node scripts/claim-gooddollar-ubi.mjs --dry-run  # solo lee
//
// Salidas: 0 = pagado, ya reclamado hoy o nada que hacer; 1 = problema real.

import { createPublicClient, createWalletClient, http, parseAbi, zeroAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo } from 'viem/chains'

// Direcciones del SDK oficial (chainConfigs[42220].contracts.production), la misma
// fuente que usa GoodWallet.
const IDENTITY = '0xC361A6E67822a0EDc17D899227dd9FC50BD62F42'
const UBISCHEME = '0x43d72Ff17701B2DA814620735C39C620Ce0ea4A1'
const RPC = process.env.CELO_RPC_URL || 'https://forno.celo.org'

const identityAbi = parseAbi([
  'function getWhitelistedRoot(address) view returns (address)',
])
const ubiAbi = parseAbi([
  'function checkEntitlement(address) view returns (uint256)',
  'function claim()',
])

const dryRun = process.argv.includes('--dry-run')

async function main() {
  const rawPk = process.env.GOODDOLLAR_PRIVATE_KEY
  if (!rawPk) {
    console.error('[FAIL] falta GOODDOLLAR_PRIVATE_KEY')
    process.exit(1)
  }
  const account = privateKeyToAccount(rawPk.startsWith('0x') ? rawPk : `0x${rawPk}`)
  const publicClient = createPublicClient({ chain: celo, transport: http(RPC) })
  console.log(`Dirección: ${account.address} | RPC: ${RPC}`)

  let root
  try {
    root = await publicClient.readContract({
      address: IDENTITY, abi: identityAbi, functionName: 'getWhitelistedRoot', args: [account.address],
    })
  } catch (e) {
    console.error(`[FAIL] no se pudo leer la whitelist: ${e.shortMessage || e.message}`)
    process.exit(1)
  }
  if (root === zeroAddress) {
    console.error('[FAIL] la dirección no está whitelisteada en Celo: verifícala una vez (FaceTec) y reintenta')
    process.exit(1)
  }
  console.log(`Whitelisted (root ${root})`)

  const entitled = await publicClient.readContract({
    address: UBISCHEME, abi: ubiAbi, functionName: 'checkEntitlement', args: [root],
  })
  console.log(`Entitlement hoy: ${entitled} (unidades mínimas)`)
  if (entitled === 0n) {
    console.log('[OK] ya se reclamó hoy: nada que hacer')
    process.exit(0)
  }

  const balance = await publicClient.getBalance({ address: account.address })
  if (balance === 0n) {
    console.error('[FAIL] sin CELO para el gas')
    process.exit(1)
  }

  if (dryRun) {
    console.log('[OK] dry-run: hay UBI y hay gas; se habría enviado claim()')
    process.exit(0)
  }

  const walletClient = createWalletClient({ account, chain: celo, transport: http(RPC) })
  let hash
  try {
    hash = await walletClient.writeContract({
      address: UBISCHEME, abi: ubiAbi, functionName: 'claim', args: [],
    })
  } catch (e) {
    console.error(`[FAIL] claim() falló: ${e.shortMessage || e.message}`)
    process.exit(1)
  }
  console.log(`tx enviada: ${hash}`)
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 })
  if (receipt.status !== 'success') {
    console.error(`[FAIL] la transacción no fue exitosa (${receipt.status})`)
    process.exit(1)
  }
  const after = await publicClient.readContract({
    address: UBISCHEME, abi: ubiAbi, functionName: 'checkEntitlement', args: [root],
  })
  console.log(`[OK] reclamado en el bloque ${receipt.blockNumber} (entitlement ahora ${after})`)
  console.log(`  https://celoscan.io/tx/${hash}`)
}

main().catch((e) => { console.error('[FATAL]', e?.message || e); process.exit(1) })
