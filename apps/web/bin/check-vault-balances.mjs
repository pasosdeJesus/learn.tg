#!/usr/bin/env node
// Revisión de solo lectura del invariante de la bóveda de becas (LearnTGVaultsV5).
//
// `payScholarship` comprueba el saldo **registrado de un curso** contra el saldo **total**
// del contrato, nunca la suma. Los saldos por curso son contabilidad sobre un pool único de
// tokens, así que si la suma registrada supera lo que el contrato realmente tiene, las
// últimas becas de la cola se pagan parcialmente o no se pagan
// (`ScholarshipInsufficientFunds`), y una beca de un curso puede salir de dinero recaudado
// para otro. El hueco se abre sin ningún bug de pago: `emergencyWithdrawUSDT/SLEARN` son
// `onlyOwner` y **no** ajustan `vaults[].balance*`, y `setVaultBalance` puede dejar saldos
// "fantasma" (p. ej. un curso retirado).
// Antecedente: https://github.com/pasosdeJesus/learn.tg/issues/221
//
// También avisa si `SLEARN.learnTGVault != learnTGVaultSLEARN`: el código transfiere el
// USDT a la primera y acuña el SLEARN en la segunda, pero registra ambos importes en la
// primera; si las direcciones se separan, el SLEARN registrado no está donde se registra.
//
// Solo lecturas: no firma ni mueve nada.
//
// Uso, desde apps/web:
//   node bin/check-vault-balances.mjs
//   node bin/check-vault-balances.mjs --network celo --rpc https://forno.celo.org
//   node bin/check-vault-balances.mjs --vault 0x... --max-course-id 200
//   node bin/check-vault-balances.mjs --json
//
// Variables: NEXT_PUBLIC_NETWORK (celo | celoSepolia), NEXT_PUBLIC_RPC_URL,
// NEXT_PUBLIC_DEPLOYED_AT_V5 (prioridad sobre deployments/LearnTGVaults/V5/<red>.json).
//
// Código de salida: 0 si todo cuadra, 1 si la suma registrada supera el saldo real o si las
// direcciones de SLEARN no coinciden, 2 si no se pudo resolver la configuración.

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createPublicClient, http, formatUnits, isAddress } from 'viem'
import { celo, celoSepolia } from 'viem/chains'

const __dirname = dirname(fileURLToPath(import.meta.url))
const APP_DIR = join(__dirname, '..')
const DEPLOYMENTS_DIR = join(APP_DIR, '..', 'contracts', 'deployments')

const CHAINS = { celo, celoSepolia }

// Residuo aceptado. Los saldos por curso vienen de migraciones manuales
// (`setVaultBalance`) y de pagos con importes fraccionarios: unos centavos de
// diferencia no significan que falte dinero para nadie. Por encima de esto sí:
// significa que la suma de lo prometido no cabe en lo que el contrato tiene y las
// últimas becas de la cola pueden quedar sin pagar. Forma parte del script a
// propósito: no es un parámetro que se suba para que pase.
const TOLERANCE = {
  usdt: 50_000n,  // 0.05 USDT (6 decimales)
  slearn: 50n,    // 0.50 SLEARN (2 decimales)
}

/** Env del archivo apps/.env, sin pisar lo ya exportado y sin imprimir valores. */
function loadEnvFile() {
  for (const candidate of [join(APP_DIR, '..', '.env'), join(APP_DIR, '.env')]) {
    if (!existsSync(candidate)) continue
    const text = readFileSync(candidate, 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
      if (!match) continue
      const value = match[2].replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
      if (process.env[match[1]] === undefined) process.env[match[1]] = value
    }
    return candidate
  }
  return null
}

function parseArgs(argv) {
  const args = { maxCourseId: 120, json: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--json') args.json = true
    else if (arg === '--network') args.network = argv[++i]
    else if (arg === '--rpc') args.rpc = argv[++i]
    else if (arg === '--vault') args.vault = argv[++i]
    else if (arg === '--max-course-id') args.maxCourseId = parseInt(argv[++i], 10)
    else if (arg === '--help' || arg === '-h') args.help = true
    else {
      console.error(`Argumento desconocido: ${arg}`)
      process.exit(2)
    }
  }
  return args
}

function usage() {
  console.log(`Uso: node bin/check-vault-balances.mjs [opciones]

  --network <celo|celoSepolia>   red (por defecto NEXT_PUBLIC_NETWORK)
  --rpc <url>                    RPC (por defecto NEXT_PUBLIC_RPC_URL o forno)
  --vault <address>              bóveda a revisar (por defecto la V5 desplegada)
  --max-course-id <n>            último id de curso a mirar (por defecto 120)
  --json                         salida JSON

Solo lecturas. Sale con 1 si la suma registrada supera el saldo real.`)
}

const VAULT_ABI = [
  { name: 'VERSION', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'usdtToken', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    name: 'accountingState', type: 'function', stateMutability: 'view', inputs: [],
    outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'bool' }],
  },
  { name: 'slearnToken', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    name: 'vaults', type: 'function', stateMutability: 'view', inputs: [{ type: 'uint256' }],
    outputs: [
      { name: 'courseId', type: 'uint256' },
      { name: 'balanceUsdt', type: 'uint256' },
      { name: 'balanceSlearn', type: 'uint256' },
      { name: 'amountPerGuideUsdt', type: 'uint256' },
      { name: 'amountPerGuideSlearn', type: 'uint256' },
      { name: 'exists', type: 'bool' },
    ],
  },
]

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
]

const SLEARN_ABI = [
  { name: 'learnTGVault', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'learnTGVaultSLEARN', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
]

function resolveNetwork(args) {
  const network = args.network || process.env.NEXT_PUBLIC_NETWORK || 'celoSepolia'
  if (!CHAINS[network]) {
    console.error(`Red desconocida: ${network} (usa celo o celoSepolia)`)
    process.exit(2)
  }
  const defaultRpc = network === 'celo'
    ? 'https://forno.celo.org'
    : 'https://forno.celo-sepolia.celo-testnet.org'
  // `NEXT_PUBLIC_RPC_URL` de apps/.env apunta a la red de desarrollo: solo se usa
  // cuando se revisa esa misma red. Si no, se pisaría Celo con un RPC de Sepolia (y el
  // contrato "no tendría código").
  const envNetwork = process.env.NEXT_PUBLIC_NETWORK
  const envRpc = process.env.NEXT_PUBLIC_RPC_URL
  const rpc = args.rpc || (envRpc && (!envNetwork || envNetwork === network) ? envRpc : defaultRpc)
  return { network, rpc }
}

function resolveVault(args, network) {
  if (args.vault) {
    if (!isAddress(args.vault)) {
      console.error(`Dirección de bóveda inválida: ${args.vault}`)
      process.exit(2)
    }
    return { address: args.vault, source: 'argumento' }
  }
  const fromEnv = process.env.NEXT_PUBLIC_DEPLOYED_AT_V5
  if (fromEnv && isAddress(fromEnv)) return { address: fromEnv, source: 'NEXT_PUBLIC_DEPLOYED_AT_V5' }

  const file = join(DEPLOYMENTS_DIR, 'LearnTGVaults', 'V5', `${network}.json`)
  if (existsSync(file)) {
    const data = JSON.parse(readFileSync(file, 'utf8'))
    if (isAddress(data.address)) return { address: data.address, source: file.replace(APP_DIR, 'apps/web/..') }
  }
  console.error(`No se pudo resolver la bóveda V5 para ${network}: pasa --vault o define NEXT_PUBLIC_DEPLOYED_AT_V5`)
  process.exit(2)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) { usage(); return }
  loadEnvFile()

  const { network, rpc } = resolveNetwork(args)
  const vault = resolveVault(args, network)
  const publicClient = createPublicClient({ chain: CHAINS[network], transport: http(rpc) })

  const chainId = await publicClient.getChainId()
  const expectedChainId = CHAINS[network].id
  if (chainId !== expectedChainId) {
    console.error(`El RPC ${rpc} responde chainId ${chainId}, pero se pidió ${network} (${expectedChainId})`)
    process.exit(2)
  }
  const [blockNumber, version] = await Promise.all([
    publicClient.getBlockNumber(),
    publicClient.readContract({ address: vault.address, abi: VAULT_ABI, functionName: 'VERSION' }).catch(() => null),
  ])
  if (version !== null && ![5, 6].includes(Number(version))) {
    console.error(`El contrato ${vault.address} no es una bóveda LearnTGVaults V5/V6 (VERSION=${version})`)
    process.exit(2)
  }

  const [usdtAddress, slearnAddress] = await Promise.all([
    publicClient.readContract({ address: vault.address, abi: VAULT_ABI, functionName: 'usdtToken' }),
    publicClient.readContract({ address: vault.address, abi: VAULT_ABI, functionName: 'slearnToken' }),
  ])
  const [usdtDecimals, slearnDecimals] = await Promise.all([
    publicClient.readContract({ address: usdtAddress, abi: ERC20_ABI, functionName: 'decimals' }),
    publicClient.readContract({ address: slearnAddress, abi: ERC20_ABI, functionName: 'decimals' }),
  ])

  const courses = []
  for (let id = 1; id <= args.maxCourseId; id++) {
    const vaultRow = await publicClient.readContract({
      address: vault.address, abi: VAULT_ABI, functionName: 'vaults', args: [BigInt(id)], blockNumber,
    })
    if (!vaultRow[5]) continue
    courses.push({
      courseId: id,
      recordedUsdt: vaultRow[1],
      recordedSlearn: vaultRow[2],
      perGuideUsdt: vaultRow[3],
      perGuideSlearn: vaultRow[4],
    })
  }

  const [heldUsdt, heldSlearn] = await Promise.all([
    publicClient.readContract({ address: usdtAddress, abi: ERC20_ABI, functionName: 'balanceOf', args: [vault.address], blockNumber }),
    publicClient.readContract({ address: slearnAddress, abi: ERC20_ABI, functionName: 'balanceOf', args: [vault.address], blockNumber }),
  ])

  const recordedUsdt = courses.reduce((sum, c) => sum + c.recordedUsdt, 0n)
  const recordedSlearn = courses.reduce((sum, c) => sum + c.recordedSlearn, 0n)

  // V6 keeps the totals itself; they must match the per-course scan (otherwise the
  // contract is buggy or the scan is short) and the contract must not be broken.
  let accounting = null
  if (version !== null && Number(version) >= 6) {
    try {
      const [aHeldUsdt, aHeldSlearn, aRecordedUsdt, aRecordedSlearn, broken] = await publicClient.readContract({
        address: vault.address, abi: VAULT_ABI, functionName: 'accountingState', blockNumber,
      })
      accounting = {
        heldUsdt: aHeldUsdt,
        heldSlearn: aHeldSlearn,
        recordedUsdt: aRecordedUsdt,
        recordedSlearn: aRecordedSlearn,
        broken,
        matchesScan: aRecordedUsdt === recordedUsdt && aRecordedSlearn === recordedSlearn,
      }
    } catch {
      accounting = null
    }
  }
  const accountingOk = accounting === null || (!accounting.broken && accounting.matchesScan)

  // Si SLEARN apunta a direcciones distintas, el SLEARN acuñado no está donde se registra.
  let slearnVaultCheck = null
  try {
    const [vaultA, vaultB] = await Promise.all([
      publicClient.readContract({ address: slearnAddress, abi: SLEARN_ABI, functionName: 'learnTGVault', blockNumber }),
      publicClient.readContract({ address: slearnAddress, abi: SLEARN_ABI, functionName: 'learnTGVaultSLEARN', blockNumber }),
    ])
    slearnVaultCheck = {
      learnTGVault: vaultA,
      learnTGVaultSLEARN: vaultB,
      same: vaultA.toLowerCase() === vaultB.toLowerCase(),
      pointsHere: vaultA.toLowerCase() === vault.address.toLowerCase(),
    }
  } catch {
    slearnVaultCheck = null
  }

  const usdtGap = recordedUsdt - heldUsdt
  const slearnGap = recordedSlearn - heldSlearn
  const usdtOver = usdtGap > TOLERANCE.usdt
  const slearnOver = slearnGap > TOLERANCE.slearn
  const ok = !usdtOver && !slearnOver && accountingOk
  const addressesOk = !slearnVaultCheck || (slearnVaultCheck.same && slearnVaultCheck.pointsHere)

  const report = {
    network,
    rpc,
    chainId,
    blockNumber: Number(blockNumber),
    vault: { address: vault.address, source: vault.source, version: version !== null ? Number(version) : null },
    tokens: {
      usdt: { address: usdtAddress, decimals: Number(usdtDecimals) },
      slearn: { address: slearnAddress, decimals: Number(slearnDecimals) },
    },
    courses: courses.map(c => ({
      courseId: c.courseId,
      recordedUsdt: formatUnits(c.recordedUsdt, Number(usdtDecimals)),
      recordedSlearn: formatUnits(c.recordedSlearn, Number(slearnDecimals)),
      perGuideUsdt: formatUnits(c.perGuideUsdt, Number(usdtDecimals)),
      perGuideSlearn: formatUnits(c.perGuideSlearn, Number(slearnDecimals)),
    })),
    totals: {
      recordedUsdt: formatUnits(recordedUsdt, Number(usdtDecimals)),
      heldUsdt: formatUnits(heldUsdt, Number(usdtDecimals)),
      usdtGap: formatUnits(usdtGap, Number(usdtDecimals)),
      recordedSlearn: formatUnits(recordedSlearn, Number(slearnDecimals)),
      heldSlearn: formatUnits(heldSlearn, Number(slearnDecimals)),
      slearnGap: formatUnits(slearnGap, Number(slearnDecimals)),
    },
    slearnVault: slearnVaultCheck,
    accounting: accounting && {
      heldUsdt: formatUnits(accounting.heldUsdt, Number(usdtDecimals)),
      heldSlearn: formatUnits(accounting.heldSlearn, Number(slearnDecimals)),
      recordedUsdt: formatUnits(accounting.recordedUsdt, Number(usdtDecimals)),
      recordedSlearn: formatUnits(accounting.recordedSlearn, Number(slearnDecimals)),
      broken: accounting.broken,
      matchesScan: accounting.matchesScan,
    },
    tolerance: {
      usdt: formatUnits(TOLERANCE.usdt, Number(usdtDecimals)),
      slearn: formatUnits(TOLERANCE.slearn, Number(slearnDecimals)),
    },
    ok,
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log(`Red ${network} (chainId ${chainId}), bloque ${blockNumber}`)
    console.log(`Bóveda ${vault.address} (${vault.source}), VERSION ${version ?? '?'}`)
    console.log(`  USDT   ${usdtAddress} (${usdtDecimals} decimales)`)
    console.log(`  SLEARN ${slearnAddress} (${slearnDecimals} decimales)`)
    console.log('')
    console.log('Curso   registrado USDT        registrado SLEARN     por guía (USDT/SLEARN)')
    for (const c of report.courses) {
      console.log(
        `${String(c.courseId).padEnd(7)} ${c.recordedUsdt.padStart(20)} ${c.recordedSlearn.padStart(21)}     ` +
        `${c.perGuideUsdt}/${c.perGuideSlearn}`,
      )
    }
    console.log('')
    console.log(`Σ registrado USDT   ${report.totals.recordedUsdt.padStart(20)}   real ${report.totals.heldUsdt.padStart(20)}   diferencia ${report.totals.usdtGap}`)
    console.log(`Σ registrado SLEARN ${report.totals.recordedSlearn.padStart(20)}   real ${report.totals.heldSlearn.padStart(20)}   diferencia ${report.totals.slearnGap}`)
    console.log('')
    if (slearnVaultCheck) {
      console.log(`SLEARN.learnTGVault        ${slearnVaultCheck.learnTGVault}`)
      console.log(`SLEARN.learnTGVaultSLEARN  ${slearnVaultCheck.learnTGVaultSLEARN}`)
      console.log(slearnVaultCheck.same
        ? '  [OK] las dos direcciones coinciden'
        : '  [FALLA] el SLEARN se acuña en otra dirección de la que registra el importe')
      if (slearnVaultCheck.same && !slearnVaultCheck.pointsHere) {
        console.log('  [AVISO] SLEARN apunta a otra bóveda, no a la que se está revisando')
      }
    }
    if (accounting) {
      console.log('')
      console.log(`Contrato (accountingState)  registrado ${report.accounting.recordedUsdt} USDT / ${report.accounting.recordedSlearn} SLEARN`)
      if (accounting.broken) {
        console.log('  [FALLA] accountingBroken: un retiro de emergencia forzado dejó la contabilidad rota')
      } else if (!accounting.matchesScan) {
        console.log('  [FALLA] el acumulador del contrato no coincide con la suma por curso escaneada (¿subir --max-course-id?)')
      } else {
        console.log('  [OK] el acumulador del contrato coincide con la suma por curso')
      }
    }
    console.log('')
    console.log(`Tolerancia aceptada: ${report.tolerance.usdt} USDT / ${report.tolerance.slearn} SLEARN`)
    if (ok) {
      const residueUsdt = usdtGap > 0n ? ` (residuo ${formatUnits(usdtGap, Number(usdtDecimals))} USDT)` : ''
      const residueSlearn = slearnGap > 0n ? ` (residuo ${formatUnits(slearnGap, Number(slearnDecimals))} SLEARN)` : ''
      console.log(`[OK] la suma registrada cabe en el saldo real${residueUsdt}${residueSlearn}`)
    } else if (usdtOver || slearnOver) {
      console.log('[FALLA] la suma registrada supera el saldo real: las últimas becas de la cola pueden quedar sin pagar')
    }
  }

  if (!ok || !addressesOk) process.exit(1)
}

main().catch(error => {
  console.error('Error:', error?.shortMessage || error?.message || error)
  process.exit(2)
})
